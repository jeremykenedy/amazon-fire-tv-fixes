import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidIp, parseIpFromEnv, mergeIpIntoEnv, parseInstalledFromEnv, mergeInstalledIntoEnv, computeInstalled, isQuitInput } from '../src/device-config.js';

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

test('parseInstalledFromEnv reads INSTALLED as a strict boolean', () => {
  assert.equal(parseInstalledFromEnv('INSTALLED=true\n'), true);
  assert.equal(parseInstalledFromEnv('INSTALLED=false\n'), false);
});

test('parseInstalledFromEnv defaults to false when missing, empty, or not exactly "true"', () => {
  assert.equal(parseInstalledFromEnv('FIRE_TV_IP=192.168.1.49\n'), false);
  assert.equal(parseInstalledFromEnv(''), false);
  assert.equal(parseInstalledFromEnv(null), false);
  assert.equal(parseInstalledFromEnv('INSTALLED=yes\n'), false);
});

test('mergeInstalledIntoEnv appends the key when the file has no INSTALLED line yet', () => {
  const result = mergeInstalledIntoEnv('FIRE_TV_IP=192.168.1.49\n', true);
  assert.match(result, /FIRE_TV_IP=192\.168\.1\.49/);
  assert.match(result, /INSTALLED=true/);
});

test('mergeInstalledIntoEnv replaces an existing INSTALLED line in place, keeping other lines', () => {
  const raw = '# a comment\nINSTALLED=false\nFIRE_TV_IP=192.168.1.49\n';
  const result = mergeInstalledIntoEnv(raw, true);
  assert.match(result, /# a comment/);
  assert.match(result, /FIRE_TV_IP=192\.168\.1\.49/);
  assert.match(result, /INSTALLED=true/);
  assert.doesNotMatch(result, /INSTALLED=false/);
  assert.equal((result.match(/INSTALLED=/g) || []).length, 1);
});

test('mergeInstalledIntoEnv starts a fresh file when raw is null', () => {
  const result = mergeInstalledIntoEnv(null, true);
  assert.equal(result.trim(), 'INSTALLED=true');
});

test('computeInstalled is true only when INSTALLED=true and FIRE_TV_IP is a valid IP', () => {
  assert.equal(computeInstalled('INSTALLED=true\nFIRE_TV_IP=192.168.1.49\n'), true);
});

test('computeInstalled is false when INSTALLED is not true, even with a valid IP', () => {
  assert.equal(computeInstalled('INSTALLED=false\nFIRE_TV_IP=192.168.1.49\n'), false);
  assert.equal(computeInstalled('FIRE_TV_IP=192.168.1.49\n'), false);
});

test('computeInstalled is false when INSTALLED=true but FIRE_TV_IP is missing or empty', () => {
  assert.equal(computeInstalled('INSTALLED=true\n'), false);
  assert.equal(computeInstalled('INSTALLED=true\nFIRE_TV_IP=\n'), false);
});

test('computeInstalled is false when INSTALLED=true but FIRE_TV_IP is the .env.example placeholder', () => {
  assert.equal(computeInstalled('INSTALLED=true\nFIRE_TV_IP=192.168.1.XXX\n'), false);
});

test('computeInstalled is false for a missing or empty file', () => {
  assert.equal(computeInstalled(null), false);
  assert.equal(computeInstalled(''), false);
});

test('isQuitInput accepts q and quit in any case, with whitespace, and nothing else', () => {
  assert.equal(isQuitInput('q'), true);
  assert.equal(isQuitInput(' Q '), true);
  assert.equal(isQuitInput('quit'), true);
  assert.equal(isQuitInput('192.168.1.49'), false);
  assert.equal(isQuitInput(''), false);
  assert.equal(isQuitInput('quiet'), false);
});

test('a placeholder or malformed FIRE_TV_IP never counts as a saved IP', async () => {
  const { isValidIp } = await import('../src/device-config.js');
  assert.equal(isValidIp('192.168.1.XXX'), false);
  assert.equal(isValidIp('192.168.1.49'), true);
});
