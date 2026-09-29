import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeoutRevertOptions } from '../src/steps/uninstall.js';

const sleep = { id: 'sleep', label: 'Sleep timeout' };
const screensaver = { id: 'screensaver', label: 'Screensaver timeout' };

test('offers to reset only the timeouts whose current value differs from the first-observed baseline', () => {
  const options = buildTimeoutRevertOptions([
    { def: sleep, possible: true, currentMs: 900000, baselineMs: 840000 },
    { def: screensaver, possible: true, currentMs: 300000, baselineMs: 300000 },
  ]);
  assert.equal(options.length, 1);
  assert.equal(options[0].value, 'timeout:sleep');
  assert.match(options[0].name, /Sleep timeout/);
  assert.match(options[0].name, /14 min/);
  assert.match(options[0].name, /15 min/);
});

test('offers nothing for timeouts that are unreadable or have no recorded baseline', () => {
  assert.deepEqual(
    buildTimeoutRevertOptions([
      { def: sleep, possible: false, reason: 'unreadable' },
      { def: screensaver, possible: true, currentMs: 1000, baselineMs: null },
    ]),
    []
  );
});
