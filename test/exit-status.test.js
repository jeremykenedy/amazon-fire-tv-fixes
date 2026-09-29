import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markFailed } from '../src/exit-status.js';

test('markFailed sets a failing exit code without ending the process', () => {
  assert.notEqual(process.exitCode, 1);
  markFailed();
  assert.equal(process.exitCode, 1);
  process.exitCode = 0;
});
