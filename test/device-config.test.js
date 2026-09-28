import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidIp, parseIpFromEnv, mergeIpIntoEnv } from '../src/device-config.js';

test('isValidIp accepts well-formed IPv4 addresses', () => {
  assert.equal(isValidIp('192.168.1.49'), true);
  assert.equal(isValidIp('0.0.0.0'), true);
  assert.equal(isValidIp('255.255.255.255'), true);
});

test('isValidIp rejects malformed input', () => {
  assert.equal(isValidIp('256.1.1.1'), false);
  assert.equal(isValidIp('192.168.1'), false);
  assert.equal(isValidIp('192.168.1.1.1'), false);
  assert.equal(isValidIp('not an ip'), false);
  assert.equal(isValidIp(''), false);
});

test('isValidIp tolerates surrounding whitespace', () => {
  assert.equal(isValidIp('  192.168.1.49  '), true);
});

test('parseIpFromEnv reads FIRE_TV_IP from raw .env contents', () => {
  const raw = 'FIRE_TV_IP=192.168.1.49\nOTHER_VAR=hello\n';
  assert.equal(parseIpFromEnv(raw), '192.168.1.49');
});

test('parseIpFromEnv returns null when the key is missing or file is empty', () => {
  assert.equal(parseIpFromEnv('OTHER_VAR=hello\n'), null);
  assert.equal(parseIpFromEnv(''), null);
  assert.equal(parseIpFromEnv(null), null);
});

test('mergeIpIntoEnv appends the key when the file has no FIRE_TV_IP line yet', () => {
  const result = mergeIpIntoEnv('OTHER_VAR=hello\n', '192.168.1.49');
  assert.match(result, /OTHER_VAR=hello/);
  assert.match(result, /FIRE_TV_IP=192\.168\.1\.49/);
});

test('mergeIpIntoEnv replaces an existing FIRE_TV_IP line in place, keeping other lines', () => {
  const raw = '# a comment\nFIRE_TV_IP=10.0.0.1\nOTHER_VAR=hello\n';
  const result = mergeIpIntoEnv(raw, '192.168.1.49');
  assert.match(result, /# a comment/);
  assert.match(result, /OTHER_VAR=hello/);
  assert.match(result, /FIRE_TV_IP=192\.168\.1\.49/);
  assert.doesNotMatch(result, /10\.0\.0\.1/);
  // Only one FIRE_TV_IP line should exist after the merge.
  assert.equal((result.match(/FIRE_TV_IP=/g) || []).length, 1);
});

test('mergeIpIntoEnv falls back to the given template when the file does not exist yet', () => {
  const result = mergeIpIntoEnv(null, '192.168.1.49', 'FIRE_TV_IP=192.168.1.XXX\n');
  assert.equal(result.trim(), 'FIRE_TV_IP=192.168.1.49');
});
