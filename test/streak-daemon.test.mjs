import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadDaemonConfig } from '../scripts/streak-daemon.mjs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const configPath = resolve(fileURLToPath(new URL('../config/daemon.json', import.meta.url)));

test('daemon config defaults to daily checks and campaign exit', () => {
  const config = loadDaemonConfig(configPath);
  assert.equal(config.intervalMinutes, 1440);
  assert.equal(config.intervalMs, 86_400_000);
  assert.equal(config.exitWhenCampaignEnded, true);
  assert.equal(config.logSubdir, 'reports/streak-daemon');
});

test('daemon config rejects invalid intervals', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'daemon-config-')), 'bad.json');
  writeFileSync(file, JSON.stringify({ intervalMinutes: 0 }));
  assert.throws(() => loadDaemonConfig(file), /间隔/);
});
