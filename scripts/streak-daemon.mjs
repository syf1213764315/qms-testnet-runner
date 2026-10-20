import { readFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { getAddress } from 'ethers';
import { root } from './lib.mjs';
import { campaign, streakWindow } from './streak-calendar.mjs';
import { hasStoredKey, keystoreFile, dpapiFile } from './key-manager.mjs';
import { readSecret } from './secret-input.mjs';
import { err, log, phaseLabel, formatLocalTime, prompts } from './messages.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const defaultConfigPath = resolve(projectRoot, 'config/daemon.json');
const bindingPath = resolve(projectRoot, '.cache/streak-wallet.json');
const optionalEnvFile = resolve(projectRoot, '.secrets/daemon.env');

export function loadDaemonConfig(path = defaultConfigPath) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const intervalMinutes = Number(raw.intervalMinutes ?? 1440);
  if (!Number.isFinite(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 1440)
    throw new Error(err.daemonInterval);
  return {
    intervalMinutes,
    intervalMs: intervalMinutes * 60_000,
    exitWhenCampaignEnded: raw.exitWhenCampaignEnded !== false,
    logSubdir: String(raw.logSubdir ?? 'reports/streak-daemon'),
  };
}

function loadOptionalEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

function daemonLog(write, text) {
  const line = `[${new Date().toISOString()}] ${text}`;
  write(line);
  console.log(line);
}

function sleep(ms, signal) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((accept, reject) => {
    const timer = setTimeout(accept, ms);
    const onAbort = () => { clearTimeout(timer); reject(new Error(err.daemonStopped)); };
    if (signal?.aborted) return onAbort();
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function runStreakChild({ address, broadcast, password, logPaths }) {
  const env = { ...process.env };
  if (password !== undefined) env.QMS_KEYSTORE_PASSWORD = password;
  const args = [resolve(projectRoot, 'scripts/run-streak.mjs'), '--address', address];
  if (broadcast) args.push('--broadcast');
  return new Promise((accept, reject) => {
    const stdout = [], stderr = [];
    const child = spawn(process.execPath, args, { cwd: projectRoot, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => stdout.push(chunk));
    child.stderr.on('data', chunk => stderr.push(chunk));
    child.once('error', () => reject(new Error(err.streakChildStart)));
    child.once('close', code => {
      if (logPaths) {
        appendFileSync(logPaths.out, stdout.join(''), 'utf8');
        appendFileSync(logPaths.err, stderr.join(''), 'utf8');
      }
      accept(code ?? 1);
    });
    delete env.QMS_KEYSTORE_PASSWORD;
  });
}

async function resolveKeystorePassword(needsPassword) {
  if (!needsPassword) return undefined;
  if (process.env.QMS_KEYSTORE_PASSWORD || process.env.QMS_PRIVATE_KEY) return process.env.QMS_KEYSTORE_PASSWORD;
  return readSecret(prompts.keystoreUnlock);
}

export async function runDaemonLoop({
  config = loadDaemonConfig(),
  binding = existsSync(bindingPath) ? JSON.parse(readFileSync(bindingPath, 'utf8')) : null,
  signal = undefined,
  now = () => new Date(),
  sleepFn = sleep,
  runChild = runStreakChild,
  logWrite = line => {},
  maxIterations = Infinity,
} = {}) {
  if (!binding?.address) throw new Error(err.daemonNoPrepare);
  if (binding.campaignId !== campaign.id) throw new Error(err.daemonWrongCampaign);
  const address = getAddress(binding.address);
  const logDir = resolve(projectRoot, config.logSubdir);
  mkdirSync(logDir, { recursive: true });
  const needsPassword = existsSync(keystoreFile)
    && !(process.platform === 'win32' && existsSync(dpapiFile))
    && !process.env.QMS_PRIVATE_KEY;
  let password = await resolveKeystorePassword(needsPassword);
  daemonLog(logWrite, log.daemonStarted(config.intervalMinutes, address));
  try {
    let iterations = 0;
    while (!signal?.aborted && iterations < maxIterations) {
      iterations++;
      const window = streakWindow(now());
      const phase = phaseLabel[window.phase] ?? window.phase;
      const stamp = now().toISOString().replace(/[:.]/g, '-');
      const paths = {
        out: resolve(logDir, `${stamp}.out.log`),
        err: resolve(logDir, `${stamp}.err.log`),
      };
      appendFileSync(paths.out, '', 'utf8');
      appendFileSync(paths.err, '', 'utf8');
      daemonLog(logWrite, log.daemonTick(phase));
      const broadcast = window.phase === 'active';
      const code = await runChild({ address, broadcast, password, logPaths: paths });
      daemonLog(logWrite, log.daemonChildExit(code));
      if (config.exitWhenCampaignEnded && window.phase === 'ended') {
        daemonLog(logWrite, log.daemonCampaignEnded(formatLocalTime(window.campaignEnd)));
        break;
      }
      if (iterations >= maxIterations) break;
      await sleepFn(config.intervalMs, signal);
    }
  } finally {
    password = undefined;
    delete process.env.QMS_KEYSTORE_PASSWORD;
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  loadOptionalEnvFile(optionalEnvFile);
  const { values } = parseArgs({
    options: {
      help: { type: 'boolean', default: false },
      'interval-minutes': { type: 'string' },
      'once': { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    console.log(log.daemonHelp);
    process.exit(0);
  }
  if (!hasStoredKey() && !existsSync(bindingPath)) {
    console.error(log.daemonNeedSetup);
    process.exitCode = 1;
  } else {
    const controller = new AbortController();
    for (const name of ['SIGINT', 'SIGTERM']) process.on(name, () => controller.abort());
    try {
      const config = loadDaemonConfig();
      if (values['interval-minutes'] !== undefined) {
        const minutes = Number(values['interval-minutes']);
        if (!Number.isFinite(minutes) || minutes < 1) throw new Error(err.daemonInterval);
        config.intervalMinutes = minutes;
        config.intervalMs = minutes * 60_000;
      }
      const logFile = resolve(projectRoot, config.logSubdir, 'daemon.log');
      mkdirSync(resolve(logFile, '..'), { recursive: true });
      await runDaemonLoop({
        config,
        signal: controller.signal,
        maxIterations: values.once ? 1 : Infinity,
        logWrite: line => appendFileSync(logFile, line + '\n', 'utf8'),
      });
    } catch (error) {
      if (error?.message !== err.daemonStopped) {
        console.error(log.errorPrefix + (error?.message ?? String(error)));
        process.exitCode = 1;
      }
    }
  }
}
