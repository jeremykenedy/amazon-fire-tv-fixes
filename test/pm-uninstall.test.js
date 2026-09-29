import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPmSuccess } from '../src/adb.js';

test('pm uninstall counts as success only when it printed Success', () => {
  assert.equal(isPmSuccess('Success\n'), true);
  assert.equal(isPmSuccess('Failure [DELETE_FAILED_INTERNAL_ERROR]'), false);
  assert.equal(isPmSuccess(''), false);
  assert.equal(isPmSuccess(null), false);
});

test('describeAdbError names the cause instead of a generic failure', async () => {
  const { describeAdbError } = await import('../src/adb.js');
  assert.match(describeAdbError({ code: 'ENOENT' }), /not found/);
  assert.match(describeAdbError({ killed: true }), /timed out/);
  assert.equal(describeAdbError({ stderr: 'Cloning into x...\nfatal: could not read Username' }), 'fatal: could not read Username');
  assert.equal(describeAdbError({}), 'adb failed with no message');
});
