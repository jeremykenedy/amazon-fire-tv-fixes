import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { missingDependencies, ensureDependencies } from '../src/setup-deps.js';
import { setProjectRootForTesting, runDeleteRepoFlow, unlinkCommands, wipeEnvToTemplate, repoParentDir, PROJECT_ROOT } from '../src/app-teardown.js';
import { installAdbStep } from '../src/steps/install-adb.js';
import { setEnvPathForTesting, getEnvPath } from '../src/device-config.js';
import { fakeBinDir, fakeCheckout, isUnderTmp } from './helpers/setup-fakes.js';
import { captured, installFakeAdb } from './helpers/fake-adb.js';
import { drive, ENTER } from './helpers/drive.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let fakeAdbPath;
const realPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

let fake;

test.before(() => {
  fake = installFakeAdb();
  fakeAdbPath = process.env.PATH;
});

test.after(() => fake.restore());

afterEach(() => {
  process.env.PATH = fakeAdbPath;
  Object.defineProperty(process, 'platform', realPlatform);
  setProjectRootForTesting(null);
  setEnvPathForTesting(null);
  process.exitCode = undefined;
});

// The repo must never be the target of anything below.
function assertRepoIntact() {
  assert.ok(fs.existsSync(path.join(ROOT, 'package.json')), 'the real repository must still exist');
}

function packageWithDeps(deps, installed = []) {
  const dir = fakeCheckout({ packageJson: JSON.stringify({ name: 'fire-tv-toolkit', dependencies: deps }) });
  for (const name of installed) {
    fs.mkdirSync(path.join(dir, 'node_modules', name), { recursive: true });
  }
  return dir;
}

function answerWith(text) {
  const input = new PassThrough();
  setTimeout(() => input.write(text), 20);
  return input;
}

test('missingDependencies lists only the dependencies with no node_modules folder', () => {
  const dir = packageWithDeps({ chalk: '1', boxen: '1' }, ['chalk']);
  assert.deepEqual(missingDependencies(dir), ['boxen']);
  assert.deepEqual(missingDependencies(fakeCheckout({ packageJson: '{"name":"x"}' })), []);
});

test('ensureDependencies does nothing when everything is installed', async () => {
  const dir = packageWithDeps({ chalk: '1' }, ['chalk']);
  assert.equal(await ensureDependencies(dir), true);
});

test('ensureDependencies runs npm install after a yes, and reports a failed install', async () => {
  const dir = packageWithDeps({ chalk: '1' });
  const calls = [];
  const ok = await captured(() =>
    ensureDependencies(dir, { input: answerWith('\n'), output: new PassThrough(), exit: () => {}, run: (cmd, args) => calls.push([cmd, ...args]) })
  );
  assert.equal(ok.result, true);
  assert.deepEqual(calls, [['npm', 'install']]);

  const exits = [];
  const failed = await captured(() =>
    ensureDependencies(dir, {
      input: answerWith('y\n'),
      output: new PassThrough(),
      exit: (code) => exits.push(code),
      run: () => {
        throw new Error('boom');
      },
    })
  );
  assert.equal(failed.result, false);
  assert.deepEqual(exits, [1]);
  assert.match(failed.out, /npm install failed/);
});

test('ensureDependencies declines on n and q, cancels on Esc and on closed input', async () => {
  const dir = packageWithDeps({ chalk: '1' });
  for (const answer of ['n\n', 'q\n']) {
    const exits = [];
    const r = await captured(() => ensureDependencies(dir, { input: answerWith(answer), output: new PassThrough(), exit: (c) => exits.push(c), run: () => assert.fail('must not install') }));
    assert.equal(r.result, false);
    assert.deepEqual(exits, [0]);
    assert.match(r.out, /No changes were made/);
  }

  const escInput = new PassThrough();
  const escExits = [];
  setTimeout(() => escInput.emit('keypress', '', { name: 'escape' }), 20);
  const esc = await captured(() => ensureDependencies(dir, { input: escInput, output: new PassThrough(), exit: (c) => escExits.push(c), run: () => assert.fail('must not install') }));
  assert.equal(esc.result, false);
  assert.equal(escExits[0], 0);

  const closed = new PassThrough();
  const closedExits = [];
  setTimeout(() => closed.end(), 20);
  const r = await captured(() => ensureDependencies(dir, { input: closed, output: new PassThrough(), exit: (c) => closedExits.push(c), run: () => assert.fail('must not install') }));
  assert.equal(r.result, false);
  assert.deepEqual(closedExits, [130]);
});

test('unlinkCommands reports success and failure from npm, using only a fake npm', async () => {
  const checkout = fakeCheckout();
  setProjectRootForTesting(checkout);
  process.env.PATH = fakeBinDir({ npm: { uninstall: 0 } });
  assert.deepEqual(await unlinkCommands(), { ok: true });
  process.env.PATH = fakeBinDir({ npm: { uninstall: 1 } });
  const failed = await unlinkCommands();
  assert.equal(failed.ok, false);
  assert.match(failed.error, /fake npm failed/);
});

test('wipeEnvToTemplate falls back to an empty file when there is no .env.example', () => {
  const checkout = fakeCheckout();
  const envFile = path.join(checkout, '.env');
  fs.writeFileSync(envFile, 'FIRE_TV_IP=1.2.3.4\n');
  setProjectRootForTesting(checkout);
  setEnvPathForTesting(envFile);
  wipeEnvToTemplate();
  assert.equal(fs.readFileSync(getEnvPath(), 'utf8'), '');
  assert.equal(repoParentDir(), path.dirname(checkout));
});

test('the delete flow refuses anything that does not look like a fire-tv-toolkit checkout', async () => {
  const cases = [
    fakeCheckout({ name: 'something-else' }),
    fakeCheckout({ packageJson: null }),
    fakeCheckout({ packageJson: '{not json' }),
    path.parse(ROOT).root,
    process.env.HOME,
  ];
  for (const dir of cases) {
    setProjectRootForTesting(dir);
    const r = await captured(() => runDeleteRepoFlow());
    assert.match(r.out, /Refusing to delete/);
    assert.equal(process.exitCode, 1);
    process.exitCode = undefined;
  }
  assertRepoIntact();
});

test('the delete flow removes a throwaway checkout after "confirm", and says how to leave the folder', async () => {
  const checkout = fakeCheckout();
  assert.ok(isUnderTmp(checkout) && checkout !== PROJECT_ROOT);
  const r = await drive('test/helpers/setup-delete-runner.js', [checkout], [{ expect: 'Type "confirm"', send: `confirm${ENTER}` }]);
  assertRepoIntact();
  assert.equal(fs.existsSync(checkout), false, r.out);
  assert.match(r.out, /Could not unlink the commands first/);
  assert.match(r.out, /Deleted\./);
  assert.match(r.out, new RegExp(`cd ${path.dirname(checkout).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
});

test('delete and remove cancel on anything but "confirm" and leave the checkout alone', async () => {
  for (const bin of ['bin/delete.js', 'bin/remove.js']) {
    const checkout = fakeCheckout();
    const preload = path.join(ROOT, 'test', 'helpers', 'setup-root-preload.js');
    const r = await drive(bin, [], [{ expect: 'Type "confirm"', send: `nope${ENTER}` }], {
      env: { NODE_OPTIONS: `--import=${preload}`, FIRE_TV_TEST_PROJECT_ROOT: checkout },
    });
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /Cancelled\. Nothing was deleted/);
    assert.ok(fs.existsSync(checkout));
    assertRepoIntact();
  }
});

test('installAdbStep explains a manual install on a platform with no package manager', async () => {
  process.env.PATH = fakeBinDir();
  Object.defineProperty(process, 'platform', { value: 'win32' });
  const r = await captured(() => installAdbStep({ yes: true }));
  assert.equal(r.result, false);
  assert.match(r.out, /Install adb manually/);
  assert.equal(process.exitCode, 1);
});

test('installAdbStep runs the package manager install, and reports a failed one', async () => {
  Object.defineProperty(process, 'platform', { value: 'darwin' });
  process.env.PATH = fakeBinDir({ brew: { install: 0 } });
  const ok = await captured(() => installAdbStep({ yes: true }));
  assert.equal(ok.result, true);
  assert.match(ok.out, /adb installed/);

  process.env.PATH = fakeBinDir({ brew: { install: 1 } });
  const failed = await captured(() => installAdbStep({ yes: true }));
  assert.equal(failed.result, false);
  assert.match(failed.out, /fake brew failed/);
  assert.equal(process.exitCode, 1);
});

test('installAdbStep on Linux shows the apt command and its Fedora note', async () => {
  Object.defineProperty(process, 'platform', { value: 'linux' });
  process.env.PATH = fakeBinDir({ sudo: { 'apt-get': 0 } });
  const r = await captured(() => installAdbStep({ yes: true }));
  assert.equal(r.result, true);
  assert.match(r.out, /dnf install android-tools/);
});
