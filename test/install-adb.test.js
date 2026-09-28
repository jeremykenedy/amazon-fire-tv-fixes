import { test } from 'node:test';
import assert from 'node:assert/strict';
import { platformInstallCommand } from '../src/apply/install-adb.js';

test('platformInstallCommand returns a brew command on darwin', () => {
  const result = platformInstallCommand('darwin');
  assert.equal(result.cmd, 'brew');
  assert.deepEqual(result.args, ['install', 'android-platform-tools']);
});

test('platformInstallCommand returns an apt command on linux', () => {
  const result = platformInstallCommand('linux');
  assert.equal(result.cmd, 'sudo');
  assert.deepEqual(result.args, ['apt-get', 'install', '-y', 'android-tools-adb']);
  assert.match(result.note, /dnf/);
});

test('platformInstallCommand returns null on an unsupported platform', () => {
  assert.equal(platformInstallCommand('win32'), null);
});
