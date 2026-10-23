import { readFileSync, existsSync, mkdirSync, openSync, closeSync, unlinkSync, appendFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { getAddress, parseEther, formatEther } from 'ethers';
import { config, root, save, connect, loadWallet, childEnvironment, safeError, gasReserveWei } from './lib.mjs';
import { createOutputParser, parseOutput } from './workflow.mjs';
import { createLogger } from './logger.mjs';
import { campaign, streakWindow, streakProgress, turkeyTime as formatLocalTime } from './streak-calendar.mjs';
import { err, log, phaseLabel, streakStatusLabel, streakBonusLabel } from './messages.mjs';
import { inspectStreakEvidence } from './streak-evidence.mjs';
import { runDailyStreak } from './streak-workflow.mjs';

const bindingPath = resolve(root, '.cache/streak-wallet.json');
const binding = existsSync(bindingPath) ? JSON.parse(readFileSync(bindingPath, 'utf8')) : {};
const credentials = Object.fromEntries(['QMS_PRIVATE_KEY', 'QMS_KEYSTORE_PASSWORD'].filter(k => process.env[k] !== undefined).map(k => [k, process.env[k]]));
let provider, descriptor, lockPath, child;
let interrupted = false;
let logger = createLogger();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { interrupted = true; child?.kill(signal); });
function show(progress, status) {
  const label = streakStatusLabel[status] ?? phaseLabel[status] ?? status;
  logger.note(log.streakProgress(label, progress.completedDays, progress.missedDays));
  logger.note(log.streakRange(formatLocalTime(progress.campaignStart), formatLocalTime(progress.campaignEnd)));
  if (progress.day) logger.note(log.streakDayLine(progress.day, formatLocalTime(progress.endsAt)));
  logger.note(log.streakQuanta(progress.estimatedQuanta, streakBonusLabel(progress)));
  logger.note(log.streakOfficialDisclaimer);
}
try {
  const { values } = parseArgs({ options: {
    broadcast: { type: 'boolean', default: false }, 'dry-run': { type: 'boolean', default: false },
    prepare: { type: 'boolean', default: false }, status: { type: 'boolean', default: false },
    address: { type: 'string' }, role: { type: 'string' }, help: { type: 'boolean', default: false },
    'no-color': { type: 'boolean', default: false },
  } });
  if (values.help) {
    console.log(log.streakHelp);
  } else {
    const window = streakWindow();
    const addressHint = values.address ?? binding.address;
    const hintedStateFile = addressHint ? resolve(root, `reports/streak-${campaign.id}/${getAddress(addressHint).toLowerCase()}.json`) : null;
    const cachedState = hintedStateFile && existsSync(hintedStateFile) ? JSON.parse(readFileSync(hintedStateFile, 'utf8')) : {};
    if (values.status || (window.phase !== 'active' && !values.prepare)) {
      const progress = streakProgress({ ...cachedState, role: values.role ?? cachedState.role ?? binding.role ?? campaign.role });
      show(progress, values.status ? phaseLabel['local-status'] : window.phase);
      if (window.phase === 'before-start') logger.note(log.streakBeforeStart);
    } else {
      const expected = values.address ?? binding.address;
      if (expected) process.env.QMS_EXPECTED_ADDRESS = getAddress(expected);
      const address = loadWallet().address;
      const role = values.role ?? cachedState.role ?? binding.role ?? campaign.role;
      streakProgress({ role });
      const stateRelative = `reports/streak-${campaign.id}/${address.toLowerCase()}.json`;
      const stateFile = resolve(root, stateRelative);
      let state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : { address, campaignId: campaign.id, chainId: config.chainId, days: {}, role };
      if (state.address?.toLowerCase() !== address.toLowerCase()) throw new Error(err.streakWrongWallet);
      const cache = resolve(root, '.cache'); mkdirSync(cache, { recursive: true });
      // Shares the all-workflow lock so the two runners cannot overlap in the same checkout.
      lockPath = resolve(cache, 'run-all.lock');
      try { descriptor = openSync(lockPath, 'wx', 0o600); }
      catch { throw new Error(err.streakLock); }
      writeFileSync(descriptor, JSON.stringify({ pid: process.pid, campaignId: campaign.id, address }));
      const logFile = resolve(root, `reports/streak-${campaign.id}/run-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
      mkdirSync(resolve(logFile, '..'), { recursive: true });
      logger = createLogger({ color: Boolean(process.stdout.isTTY) && !values['no-color'] && !('NO_COLOR' in process.env),
        record: line => appendFileSync(logFile, line + '\n', { encoding: 'utf8', mode: 0o600 }) });
      logger.note(log.streakWalletPhase(address, phaseLabel[window.phase] ?? window.phase));
      provider = await connect();
      async function execute(args, context) {
        if (interrupted) throw new Error(err.streakInterrupted);
        const env = childEnvironment(args[0], address);
        for (const key of ['QMS_OPERATION_ID', 'QMS_TASK_NOT_BEFORE', 'QMS_TASK_NOT_AFTER']) delete env[key];
        if (context) {
          Object.assign(env, credentials, { QMS_OPERATION_ID: context.operationId,
            QMS_TASK_NOT_BEFORE: context.notBefore, QMS_TASK_NOT_AFTER: context.notAfter });
          const amount = parseEther(context.operationId.endsWith(':swap') ? campaign.swapAmountQms : campaign.liquidityAmountQms);
          const remaining = args[0] === 'swap' ? amount + parseEther(campaign.liquidityAmountQms) : amount;
          const needed = remaining + parseEther(config.reserveQms) + BigInt(args[0] === 'swap' ? 3 : 2) * gasReserveWei();
          if (await provider.getBalance(address) < needed) throw new Error(err.streakDailyNeed(formatEther(needed)));
        }
        logger.note(log.streakCmd(args[0], Boolean(context)));
        return new Promise((accept, reject) => {
          let stdout = '', stderr = '', parseError;
          const parser = createOutputParser(result => logger.result(result));
          child = spawn(process.execPath, [resolve(root, 'scripts/qms.mjs'), ...args],
            { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
          const timer = setInterval(() => logger.note(log.streakWaiting), 15000);
          child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
          child.stdout.on('data', text => { stdout += text; if (!parseError) try { parser.push(text); } catch (e) { parseError = e; } });
          child.stderr.on('data', text => { stderr += text; });
          child.once('error', () => { clearInterval(timer); reject(new Error(err.streakChildStart)); });
          child.once('close', code => {
            clearInterval(timer); child = null;
            if (code !== 0 || interrupted) reject(new Error(safeError({ message: stderr || err.streakChildStop })));
            else if (parseError) reject(parseError);
            else { try { accept(parseOutput(stdout)); } catch (error) { reject(error); } }
          });
          delete env.QMS_PRIVATE_KEY; delete env.QMS_KEYSTORE_PASSWORD;
        });
      }
      if (values.prepare) {
        await execute(['status'], null);
        await execute(['wallet', '--address', address], null);
        const perDay = parseEther(campaign.swapAmountQms) + parseEther(campaign.liquidityAmountQms) + 3n * gasReserveWei();
        state = { ...state, role, preparedAt: new Date().toISOString() };
        save(stateRelative, state);
        save('.cache/streak-wallet.json', { campaignId: campaign.id, address, role });
        show(streakProgress(state), streakStatusLabel.ready);
        logger.note(log.streakBudget(
          formatEther(perDay + parseEther(config.reserveQms)),
          formatEther(7n * perDay + parseEther(config.reserveQms))));
        logger.note(log.streakPrepareDone);
      } else {
        const dry = values['dry-run'] || !values.broadcast;
        const result = await runDailyStreak({ address, state, role, broadcast: !dry,
          inspect: current => inspectStreakEvidence(provider, root, address, campaign, current), execute,
          log: text => logger.note(text), checkpoint: current => save(dry ? `reports/streak-${campaign.id}/preview-latest.json` : stateRelative, current) });
        if (!dry) save('.cache/streak-wallet.json', { campaignId: campaign.id, address, role });
        show(result.progress, streakStatusLabel[result.status] ?? result.status);
        if (result.reason) logger.note(result.reason);
        logger.note(log.streakStateFile(stateFile));
        if (['waiting', 'day-changed'].includes(result.status)) process.exitCode = 2;
      }
    }
  }
} catch (error) { logger.failure(error); process.exitCode = 1; }
finally {
  provider?.destroy();
  if (descriptor !== undefined) { closeSync(descriptor); unlinkSync(lockPath); }
  for (const key of Object.keys(credentials)) delete credentials[key];
  delete process.env.QMS_KEYSTORE_PASSWORD; delete process.env.QMS_PRIVATE_KEY;
}
