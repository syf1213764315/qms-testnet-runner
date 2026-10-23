import { parseEther, parseUnits, formatEther } from 'ethers';
import { config, amountQms, minimum, safeError, gasReserveWei } from './lib.mjs';
import { err, skipReason, step as steps } from './messages.mjs';

// Each existing CLI action verifies its own receipt and state changes before returning.
// Keep actions sequential: a failed action must never allow the next broadcast.
export async function runWorkflow({ execute, checkpoint, broadcast = false,
  swapAmount = '0.2', liquidityAmount = '0.1', slippageBps = config.slippageBps }) {
  const swapWei = amountQms(swapAmount);
  const liquidityWei = amountQms(liquidityAmount);
  minimum(swapWei, slippageBps);
  minimum(liquidityWei, slippageBps);
  const report = { chainId: config.chainId, startedAt: new Date().toISOString(),
    mode: broadcast ? 'broadcast' : 'preflight', status: 'running',
    swapAmountQms: swapAmount, liquidityAmountQms: liquidityAmount, slippageBps, steps: [] };
  const persist = async () => checkpoint?.(report);
  async function step(name, args, validate) {
    const started = Date.now();
    const item = { name, command: args, status: 'running', startedAt: new Date(started).toISOString() };
    report.steps.push(item);
    await persist();
    try {
      item.results = await execute(args, name);
      if (validate) await validate(item.results);
      item.status = 'passed';
      item.finishedAt = new Date().toISOString();
      item.durationMs = Date.now() - started;
      await persist();
      return item.results;
    } catch (error) {
      item.status = 'failed';
      item.finishedAt = new Date().toISOString();
      item.durationMs = Date.now() - started;
      if (error.results) item.results = error.results;
      item.error = safeError(error);
      throw error;
    }
  }
  const last = results => results.at(-1);
  const ensureConfirmed = results => {
    if (!results.some(r => r.status === 'confirmed')) throw new Error(err.noConfirmedReceipt);
  };
  const modeFlags = broadcast ? ['--broadcast'] : [];
  try {
    await step(steps.networkQwap, ['status'], results => {
      const status = results.find(r => r.network);
      if (status?.chainId !== config.chainId || status.dexVerified !== true)
        throw new Error(err.networkQwap);
    });
    // Allow for deploy, increment, swap, approval and liquidity, each at its configured cap.
    const required = swapWei + liquidityWei + parseEther(config.reserveQms) + 5n * gasReserveWei();
    const before = last(await step(steps.walletBudget, ['wallet'], results => {
      if (parseEther(last(results).qms) < required)
        throw new Error(err.workflowMinQms(formatEther(required)));
    }));
    report.address = before.address;
    report.before = before;
    const deploy = await step(steps.deploy, ['deploy', ...modeFlags], results => {
      if (broadcast) {
        ensureConfirmed(results);
        const deployed = last(results);
        if (!deployed.address || deployed.bytecodeVerified !== true || deployed.count !== '0')
          throw new Error(err.deployVerify);
      }
    });
    const deployment = broadcast ? last(deploy) : null;
    if (broadcast) {
      report.contract = deployment.address;
      await step(steps.incrementEvent, ['increment', '--contract', deployment.address, '--broadcast'], results => {
        ensureConfirmed(results);
        const increment = last(results);
        if (increment.eventVerified !== true || increment.before !== '0' || increment.after !== '1')
          throw new Error(err.incrementVerify);
      });
    } else {
      report.steps.push({ name: steps.increment, status: 'skipped',
        reason: skipReason.increment });
      await persist();
    }
    await step(steps.swap, ['swap', '--amount', swapAmount, '--slippage-bps', String(slippageBps), ...modeFlags], results => {
      if (broadcast) {
        ensureConfirmed(results);
        const swap = last(results);
        if (parseUnits(swap.usdcAfter, 18) <= parseUnits(swap.usdcBefore, 18))
          throw new Error(err.swapUsdc);
      }
    });
    if (broadcast) {
      await step(steps.liquidityFull, ['liquidity', '--amount', liquidityAmount,
        '--slippage-bps', String(slippageBps), '--broadcast'], results => {
        ensureConfirmed(results);
        const lp = last(results);
        if (BigInt(lp.mintedLp ?? 0) <= 0n) throw new Error(err.lpMint);
      });
    } else {
      // A dry swap does not create USDC. Do not claim a dependent deposit was simulated.
      report.steps.push({ name: steps.liquidityShort, status: 'skipped',
        reason: skipReason.liquidity });
      await persist();
    }
    report.after = last(await step(steps.finalWallet, ['wallet']));
    if (report.after.address?.toLowerCase() !== report.address?.toLowerCase())
      throw new Error(err.walletSwitch);
    const blockArgs = deployment ? ['--number', String(deployment.blockNumber)] : [];
    await step(steps.blockQubo, ['block', ...blockArgs, '--download'], results => {
      if (last(results)?.objectiveVerification?.verified !== true) throw new Error(err.quboObjective);
    });
    report.status = broadcast ? 'completed' : 'preflight-passed';
    report.finishedAt = new Date().toISOString();
    await persist();
    return report;
  } catch (error) {
    report.status = 'failed';
    report.error = safeError(error);
    report.finishedAt = new Date().toISOString();
    await persist();
    throw error;
  }
}

// CLI emits JSON objects separated by whitespace; braces inside strings must stay intact.
export function parseOutput(text) {
  const values = [];
  const parser = createOutputParser(value => values.push(value));
  parser.push(text);
  parser.finish();
  return values;
}

export function createOutputParser(onValue) {
  let frame = '', depth = 0, string = false, escaped = false, count = 0;
  return {
    push(chunk) {
      for (const c of chunk) {
        if (depth === 0) {
          if (/\s/.test(c)) continue;
          if (c !== '{') throw new Error(err.unexpectedCli);
          frame = c; depth = 1; continue;
        }
        frame += c;
        if (string) {
          if (escaped) escaped = false;
          else if (c === '\\') escaped = true;
          else if (c === '"') string = false;
        } else if (c === '"') string = true;
        else if (c === '{') depth++;
        else if (c === '}') {
          depth--;
          if (depth === 0) {
            const value = JSON.parse(frame);
            frame = ''; count++;
            onValue(value);
          }
        }
      }
    },
    finish() { if (depth !== 0 || count === 0) throw new Error(err.cliJsonIncomplete); },
  };
}
