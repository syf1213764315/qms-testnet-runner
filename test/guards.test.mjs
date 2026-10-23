import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { parseEther } from 'ethers';
import { assertTestnet, amountQms, minimum, checkBudget, safeError } from '../scripts/lib.mjs';
import { verifyQubo } from '../scripts/qubo.mjs';

test('mainnet and other testnets are rejected before signing', () => {
  for (const chain of [1n, 11155111n, 424242n, 19481n]) assert.throws(() => assertTestnet(chain));
  assert.doesNotThrow(() => assertTestnet('0x4c18'));
});
test('spending cannot exceed test limit or accept ambiguous amounts', () => {
  for (const amount of ['0', '-1', '1.000000000000000001', '1e-2', 'NaN', '0.0000000000000000001'])
    assert.throws(() => amountQms(amount));
  assert.equal(amountQms('0.1'), 100000000000000000n);
});
test('gas and reserve are counted together at exact balance boundary', () => {
  const value = parseEther('0.1'), gasLimit = 100000n, price = 1000000000n;
  const required = value + gasLimit * price + parseEther('0.1');
  assert.throws(() => checkBudget(required - 1n, value, gasLimit, price));
  assert.equal(checkBudget(required, value, gasLimit, price), gasLimit * price);
  assert.throws(() => checkBudget(parseEther('10'), value, gasLimit, 10000000000000n));
});
test('slippage cannot disable output protection', () => {
  for (const bps of [0, -1, 501, 10000, NaN, 1.5]) assert.throws(() => minimum(1000000n, bps));
  assert.throws(() => minimum(1n, 100));
  assert.equal(minimum(104953n, 100), 103903n);
});
test('error formatting does not leak keys, signed payloads or nested requests', () => {
  const secret = 'ab'.repeat(32);
  const payload = '0x' + 'ff'.repeat(120);
  const error = { message: `bad key 0x${secret} signed ${payload}`, transaction: { secret }, info: { payload } };
  const message = safeError(error);
  assert.ok(!message.includes(secret));
  assert.ok(!message.includes(payload));
  assert.ok(message.length <= 450);
});
test('QUBO reconstruction counts symmetric off-diagonal entries twice', () => {
  const bytes = gzipSync('%%MatrixMarket matrix array integer symmetric\n% example\n2 2\n-2\n-1\n3\n');
  const metadata = { solution: '11', problem_size: 2, solution_length: 2, objective_value: '-1' };
  assert.equal(verifyQubo(bytes, metadata).computedObjective, '-1');
  assert.throws(() => verifyQubo(bytes, { ...metadata, objective_value: '0' }));
  assert.throws(() => verifyQubo(bytes, { ...metadata, solution: '12' }));
  assert.throws(() => verifyQubo(bytes, { ...metadata, problem_size: 3 }));
});
