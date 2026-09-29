import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBaselineFromEnv, mergeBaselineIntoEnv } from '../src/timeout-config.js';

test('parseBaselineFromEnv reads a captured baseline for the given id', () => {
  const raw = 'FIRE_TV_IP=192.168.1.49\nFIRE_TV_TIMEOUT_SLEEP_FACTORY_MS=1200000\n';
  assert.equal(parseBaselineFromEnv('sleep', raw), 1200000);
});

test('parseBaselineFromEnv returns null when nothing has been captured yet', () => {
  assert.equal(parseBaselineFromEnv('sleep', 'FIRE_TV_IP=192.168.1.49\n'), null);
  assert.equal(parseBaselineFromEnv('sleep', ''), null);
  assert.equal(parseBaselineFromEnv('sleep', null), null);
});

test('parseBaselineFromEnv keys are per-id, not shared', () => {
  const raw = 'FIRE_TV_TIMEOUT_SLEEP_FACTORY_MS=1200000\n';
  assert.equal(parseBaselineFromEnv('screensaver', raw), null);
});

test('mergeBaselineIntoEnv appends the key when the file has no baseline line yet', () => {
  const result = mergeBaselineIntoEnv('sleep', 'FIRE_TV_IP=192.168.1.49\n', 1200000);
  assert.match(result, /FIRE_TV_IP=192\.168\.1\.49/);
  assert.match(result, /FIRE_TV_TIMEOUT_SLEEP_FACTORY_MS=1200000/);
});

test('mergeBaselineIntoEnv replaces an existing baseline line in place, keeping other lines', () => {
  const raw = '# a comment\nFIRE_TV_TIMEOUT_SLEEP_FACTORY_MS=1200000\nFIRE_TV_IP=192.168.1.49\n';
  const result = mergeBaselineIntoEnv('sleep', raw, 900000);
  assert.match(result, /# a comment/);
  assert.match(result, /FIRE_TV_IP=192\.168\.1\.49/);
  assert.match(result, /FIRE_TV_TIMEOUT_SLEEP_FACTORY_MS=900000/);
  assert.doesNotMatch(result, /=1200000/);
  assert.equal((result.match(/FIRE_TV_TIMEOUT_SLEEP_FACTORY_MS=/g) || []).length, 1);
});

test('mergeBaselineIntoEnv does not disturb a different id\'s line', () => {
  const raw = 'FIRE_TV_TIMEOUT_SLEEP_FACTORY_MS=1200000\n';
  const result = mergeBaselineIntoEnv('screensaver', raw, 300000);
  assert.match(result, /FIRE_TV_TIMEOUT_SLEEP_FACTORY_MS=1200000/);
  assert.match(result, /FIRE_TV_TIMEOUT_SCREENSAVER_FACTORY_MS=300000/);
});

test('mergeBaselineIntoEnv starts a fresh file when raw is null', () => {
  const result = mergeBaselineIntoEnv('sleep', null, 1200000);
  assert.equal(result.trim(), 'FIRE_TV_TIMEOUT_SLEEP_FACTORY_MS=1200000');
});
