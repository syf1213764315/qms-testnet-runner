import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { JsonRpcProvider, FetchRequest, Wallet, Transaction, getAddress, keccak256, parseEther, formatEther } from 'ethers';
import { writeAtomic } from './storage.mjs';
import { createJournal } from './tx-journal.mjs';
import { taskContext, assertTaskWindow } from './task-context.mjs';
import { err, safe as safeMsg } from './messages.mjs';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const config = JSON.parse(readFileSync(resolve(root, 'config/qms-testnet.json'), 'utf8'));
export function save(relative, data) {
  const file = resolve(root, relative);
  writeAtomic(file, JSON.stringify(data, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n');
  return file;
}
export function output(data) {
  console.log(JSON.stringify(data, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
}
export function assertTestnet(chainId) {
  if (BigInt(chainId) !== 19480n) throw new Error(err.chainId);
}
export async function connect() {
  const request = new FetchRequest(config.rpcUrl);
  request.timeout = 25000;
  const provider = new JsonRpcProvider(request, undefined, { batchMaxCount: 1, cacheTimeout: -1 });
  provider.pollingInterval = 3000;
  try { assertTestnet(await provider.send('eth_chainId', [])); }
  catch (e) { provider.destroy(); throw e; }
  return provider;
}
export function loadWallet(provider) {
  let key = process.env.QMS_PRIVATE_KEY;
  let password = process.env.QMS_KEYSTORE_PASSWORD;
  delete process.env.QMS_PRIVATE_KEY;
  delete process.env.QMS_KEYSTORE_PASSWORD;
  if (!key && process.platform === 'win32' && existsSync(resolve(root, '.secrets/qms-key.dpapi'))) {
    try {
      // stdout is captured in memory; never inherited by the terminal or logged.
      key = execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
        resolve(root, 'scripts/read-key.ps1')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 }).trim();
    } catch { throw new Error(err.encryptedKeyRead); }
  }
  if (!key && existsSync(resolve(root, '.secrets/qms-keystore.json'))) {
    if (!password) throw new Error(err.keystoreLocked);
    try {
      const wallet = Wallet.fromEncryptedJsonSync(readFileSync(resolve(root, '.secrets/qms-keystore.json'), 'utf8'), password);
      return assertWallet(provider ? wallet.connect(provider) : wallet);
    } catch { throw new Error(err.keystoreOpen); }
    finally { password = undefined; }
  }
  if (!key) throw new Error(err.noKey);
  key = key.trim().replace(/^0x/, '');
  if (!/^[a-fA-F0-9]{64}$/.test(key)) throw new Error(err.keyFormat);
  try { return assertWallet(new Wallet('0x' + key, provider)); }
  catch { throw new Error(err.keyInvalid); }
  finally { key = undefined; }
}
function assertWallet(wallet) {
  const expected = process.env.QMS_EXPECTED_ADDRESS;
  if (expected && wallet.address.toLowerCase() !== expected.toLowerCase())
    throw new Error(err.walletChanged);
  return wallet;
}
export function childEnvironment(command, expectedAddress) {
  const env = { ...process.env };
  if (['status', 'quote', 'block', 'compile', 'help'].includes(command)) {
    delete env.QMS_PRIVATE_KEY; delete env.QMS_KEYSTORE_PASSWORD;
  }
  if (expectedAddress) env.QMS_EXPECTED_ADDRESS = expectedAddress;
  return env;
}
export function amountQms(value) {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(value)) throw new Error(err.qmsAmount);
  const amount = parseEther(value);
  if (amount <= 0n || amount > parseEther(config.maxActionQms))
    throw new Error(err.qmsRange(config.maxActionQms));
  return amount;
}
export function minimum(amount, bps) {
  if (!Number.isInteger(bps) || bps < 1 || bps > 500) throw new Error(err.slippage);
  const value = amount * BigInt(10000 - bps) / 10000n;
  if (value <= 0n) throw new Error(err.minOutZero);
  return value;
}
export function gasReserveWei() {
  return parseEther(config.gasReserveQms ?? config.maxGasQms);
}
export function checkBudget(balance, value, gasLimit, gasPrice) {
  const maxFee = gasLimit * gasPrice;
  if (maxFee > parseEther(config.maxGasQms)) throw new Error(err.gasCap(config.maxGasQms));
  if (balance < value + maxFee + parseEther(config.reserveQms))
    throw new Error(err.balanceLow);
  return maxFee;
}
export function safeError(error) {
  // Ethers error objects can contain signed transactions or request bodies.
  // Only a short message is allowed to reach stdout/stderr.
  const message = error?.shortMessage ?? error?.message ?? err.unknown;
  return String(message)
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/(?:0x)?[a-fA-F0-9]{64,}/g, safeMsg.hexHidden).slice(0, 450);
}
export async function jsonFetch(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!res.ok) {
    const error = new Error(`HTTP ${res.status}: ${new URL(url).pathname}`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}
export async function submit(provider, wallet, tx, label, broadcast, journalRoot = root, emit = output) {
  const task = taskContext();
  assertTaskWindow(task);
  if (task && task.address.toLowerCase() !== wallet.address.toLowerCase()) throw new Error(err.streakWalletCtx);
  if ((tx.value ?? 0n) < 0n || (tx.value ?? 0n) > parseEther(config.maxActionQms))
    throw new Error(err.nativeCap);
  assertTestnet(await provider.send('eth_chainId', []));
  const transaction = { ...tx, from: wallet.address };
  const estimated = await provider.estimateGas(transaction);
  const gasLimit = (estimated * 120n + 99n) / 100n;
  const fees = await provider.getFeeData();
  if (fees.maxFeePerGas == null || fees.maxPriorityFeePerGas == null)
    throw new Error(err.eip1559);
  const maxFee = checkBudget(await provider.getBalance(wallet.address), tx.value ?? 0n, gasLimit, fees.maxFeePerGas);
  emit({ action: label, mode: broadcast ? 'broadcast' : 'simulation', from: wallet.address,
    to: tx.to ?? 'contract creation', valueQms: formatEther(tx.value ?? 0n), gasLimit,
    maxFeeQms: formatEther(maxFee), reserveQms: config.reserveQms });
  if (!broadcast) return null;
  const journal = createJournal(journalRoot, config.chainId, wallet.address);
  const release = journal.acquire();
  let raw;
  try {
    await journal.checkUnresolved(provider, config.confirmations);
    await journal.checkOperation(provider, task, label);
    if (task) {
      const head = await provider.getBlock('latest');
      if (!head) throw new Error(err.streakBlockTime);
      assertTaskWindow(task, head.timestamp * 1000);
    }
    assertTestnet(await provider.send('eth_chainId', []));
    checkBudget(await provider.getBalance(wallet.address), tx.value ?? 0n, gasLimit, fees.maxFeePerGas);
    const populated = await wallet.populateTransaction({ ...transaction, chainId: config.chainId, type: 2, gasLimit,
      maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas });
    raw = await wallet.signTransaction(populated);
    const decoded = Transaction.from(raw);
    assertTestnet(decoded.chainId);
    if (decoded.type !== 2 || decoded.from?.toLowerCase() !== wallet.address.toLowerCase()
        || decoded.to !== (tx.to ? getAddress(tx.to) : null) || decoded.value !== (tx.value ?? 0n)
        || decoded.gasLimit !== gasLimit || decoded.maxFeePerGas !== fees.maxFeePerGas)
      throw new Error(err.signedMismatch);
    const hash = keccak256(raw);
    const record = { action: label, chainId: config.chainId, hash, nonce: decoded.nonce,
      from: wallet.address, to: decoded.to, preparedAt: new Date().toISOString(), status: 'prepared',
      explorer: `${config.explorerUrl}/tx/${hash}` };
    if (task) record.operationId = task.id;
    // Persist the hash BEFORE any network send. Never persist the replayable signed payload.
    journal.write(record);
    try { assertTaskWindow(task); }
    catch (error) { journal.write({ ...record, status: 'not-broadcast' }); throw error; }
    try {
      await provider.broadcastTransaction(raw);
    } catch {
      journal.write({ ...record, status: 'broadcast-unknown' });
      emit({ hash, explorer: record.explorer, status: 'broadcast-unknown' });
      throw new Error(err.rpcUnknown);
    } finally { raw = undefined; }
    journal.write({ ...record, status: 'submitted', submittedAt: new Date().toISOString() });
    emit({ hash, explorer: record.explorer, status: 'submitted' });
    // Do not use safe/finalized: QMS currently returns genesis for those tags.
    let receipt;
    try { receipt = await provider.waitForTransaction(hash, config.confirmations, config.receiptTimeoutMs); }
    catch {
      journal.write({ ...record, status: 'receipt-timeout' });
      throw new Error(err.receiptUnknown);
    }
    if (!receipt) {
      journal.write({ ...record, status: 'receipt-timeout' });
      throw new Error(err.receiptMissing);
    }
    const status = receipt.status === 1 ? 'confirmed' : 'reverted';
    journal.write({ ...record, status, blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed, feeQms: formatEther(receipt.fee), contractAddress: receipt.contractAddress });
    if (status !== 'confirmed') throw new Error(err.reverted);
    emit({ status, blockNumber: receipt.blockNumber, confirmations: config.confirmations,
      feeQms: formatEther(receipt.fee) });
    return receipt;
  } finally { raw = undefined; release(); }
}
