import { test, before, beforeEach, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installFakeAdb, captured } from './helpers/fake-adb.js';
import { drive, DOWN, ENTER } from './helpers/drive.js';
import { fakeBinDir } from './helpers/setup-fakes.js';
import { launcherFetch } from './helpers/launcher-fakes.js';
import { AT4K, HOME_REDIRECT } from '../src/launcher-registry.js';
import { setEnvPathForTesting, saveIp, getEnvPath } from '../src/device-config.js';
import { parseBaselineFromEnv } from '../src/timeout-config.js';
import { findTimeoutById, getTimeoutMs } from '../src/apply/timeouts.js';

const IP = '192.168.1.49';
let fakeAdbPath;
const realPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
let fake;

before(() => {
  fake = installFakeAdb();
  fakeAdbPath = process.env.PATH;
});
beforeEach(() => {
  fake.reset();
  process.exitCode = undefined;
});
afterEach(() => {
  process.env.PATH = fakeAdbPath;
  Object.defineProperty(process, 'platform', realPlatform);
  setEnvPathForTesting(fake.envFile);
});
after(() => {
  fake.restore();
  process.exitCode = undefined;
});

const installedEnv = () => fs.writeFileSync(fake.envFile, `FIRE_TV_IP=${IP}\nINSTALLED=true\n`);
const fakePath = () => path.dirname(process.env.FAKE_ADB_STATE);
const CONTINUE = { expect: 'Nothing has been changed yet. Continue?', send: ENTER };

async function withFetch(fn, body) {
  const real = globalThis.fetch;
  globalThis.fetch = fn;
  try {
    return await body();
  } finally {
    globalThis.fetch = real;
  }
}

test('updating the launcher apps puts Home back on AT4K when Android drops the service', async () => {
  const s = fake.readState();
  fake.setState({
    installed: [...s.installed, AT4K.pkg, HOME_REDIRECT.pkg],
    secure: { ...s.secure, enabled_accessibility_services: `${AT4K.service}:${HOME_REDIRECT.service}` },
    dropServicesOnInstall: true,
  });
  const { manageLauncher } = await import('../src/steps/launcher.js');
  const r = await withFetch(launcherFetch(), () => captured(() => manageLauncher(IP, { install: true })));
  assert.equal(fake.readState().secure.enabled_accessibility_services, `${AT4K.service}:${HOME_REDIRECT.service}`, r.out);
});

test('ensureConnected exits 1 with no saved IP and no terminal to ask on', async () => {
  const r = await drive('test/helpers/ss-ensure-connected.js', [], []);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /no terminal to ask for one/);
});

test('ensureConnected explains an unreachable TV, with what adb said, and exits 1 without a terminal', async () => {
  installedEnv();
  fake.setState({ offline: true });
  const r = await drive('test/helpers/ss-ensure-connected.js', [], []);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /Couldn't reach a Fire TV/);
  assert.match(r.out, /adb said:/);
});

test('ensureConnected asks for an IP in a terminal, and quitting at the retry exits cleanly', async () => {
  const ok = await drive('test/helpers/ss-ensure-connected.js', ['--tty'], [{ expect: 'IP address', send: `${IP}${ENTER}` }]);
  assert.match(ok.out, new RegExp(`Resolved ${IP.replace(/\./g, '\\.')}`), ok.out);

  installedEnv();
  fake.setState({ offline: true });
  const quit = await drive('test/helpers/ss-ensure-connected.js', ['--tty'], [{ expect: /IP address/, send: `q${ENTER}` }]);
  assert.equal(quit.code, 0, quit.out);
  assert.match(quit.out, /No changes were made/);
});

test('saving the IP uses a .env.example template beside the .env, and reports a .env it cannot write', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'firetv-env-'));
  fs.writeFileSync(path.join(dir, '.env.example'), '# template\nFIRE_TV_IP=\n');
  setEnvPathForTesting(path.join(dir, '.env'));
  saveIp(IP);
  assert.match(fs.readFileSync(getEnvPath(), 'utf8'), /# template\nFIRE_TV_IP=192\.168\.1\.49/);

  setEnvPathForTesting(path.join(dir, 'no-such-folder', '.env'));
  assert.throws(() => saveIp(IP), /Could not save/);
});

test('start retries an unreachable TV and quitting at the IP prompt changes nothing', async () => {
  fake.setState({ offline: true });
  const r = await drive('bin/start.js', [], [
    { expect: 'Developer Mode and ADB debugging?', send: 'y' },
    { expect: 'IP address', send: `${IP}${ENTER}` },
    { expect: /Couldn't reach a Fire TV[\s\S]*IP address/, send: `q${ENTER}` },
  ]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /debugging-authorization prompt/);
});

test('installing adb can be declined, and a missing package manager is reported', async () => {
  installedEnv();
  const declined = await drive('bin/firetv-install-adb.js', [], [{ expect: 'Install it now?', send: 'n' }], { noAdb: true });
  assert.match(declined.out, /Cancelled\. Nothing was installed/, declined.out);

  const { installAdbStep } = await import('../src/steps/install-adb.js');
  Object.defineProperty(process, 'platform', { value: 'darwin' });
  process.env.PATH = fakeBinDir();
  const missing = await captured(() => installAdbStep({ yes: true }));
  process.env.PATH = fakeAdbPath;
  assert.equal(missing.result, false);
  assert.match(missing.out, /ENOENT|not found/);
});

test('setup says it is starting the guided setup after linking, and reports a silent npm link failure', async () => {
  const bin = fakeBinDir({ npm: { install: 0, link: 0 } });
  const started = await drive(
    'setup.js',
    [],
    [
      { expect: 'Start setting up Fire TV Toolkit?', send: 'y' },
      { expect: /Install\/Link firetv commands/, send: ENTER },
      CONTINUE,
      { expect: 'Developer Mode and ADB debugging?', send: 'n' },
    ],
    { env: { PATH: `${fakePath()}${path.delimiter}${bin}` } }
  );
  assert.match(started.out, /Starting the guided setup now\. Once it finishes/, started.out);

  const quiet = fs.mkdtempSync(path.join(os.tmpdir(), 'firetv-quiet-npm-'));
  fs.symlinkSync(process.execPath, path.join(quiet, 'node'));
  fs.writeFileSync(path.join(quiet, 'npm'), '#!/bin/sh\n[ "$1" = link ] && exit 3\nexit 0\n', { mode: 0o755 });
  const failed = await drive(
    'setup.js',
    [],
    [
      { expect: 'Start setting up Fire TV Toolkit?', send: 'y' },
      { expect: /Install\/Link firetv commands/, send: `${DOWN} ${ENTER}` },
      CONTINUE,
    ],
    { env: { PATH: `${fakePath()}${path.delimiter}${quiet}` } }
  );
  assert.match(failed.out, /npm link failed/);
  assert.match(failed.out, /Command failed/);
});

test('uninstall on a not-installed setup removes leftover commands with npm', async () => {
  const r = await drive('bin/uninstall.js', [], [{ expect: /remove the repo code/, send: 'n' }], {
    env: { PATH: `${fakePath()}${path.delimiter}${fakeBinDir({ npm: { uninstall: 0 } })}` },
  });
  assert.match(r.out, /Any leftover commands were removed from your PATH/, r.out);
  assert.match(r.out, /The repo was left in place/);
});

test('the interactive revert warns about removing screensavers and reports a stuck one', async () => {
  installedEnv();
  fake.setState({ stuck: true });
  const r = await drive('bin/firetv-revert.js', [], [
    { expect: 'What should be reverted?', send: ENTER },
    CONTINUE,
    { expect: 'Type "yes"', send: `yes${ENTER}` },
  ]);
  assert.match(r.out, /removes screensavers from the TV/);
  assert.match(r.out, /could not be removed/);
  assert.equal(r.code, 1, r.out);
});

test('timeout readers handle a missing, unreadable or unreachable value', async () => {
  const sleep = findTimeoutById('sleep');
  fake.setState({ secure: { sleep_timeout: 'abc' }, system: {} });
  assert.equal(await getTimeoutMs(IP, sleep), null);
  assert.equal(parseBaselineFromEnv('sleep', 'FIRE_TV_TIMEOUT_SLEEP_FACTORY_MS=abc\n'), null);

  const { currentTimeoutsReport } = await import('../src/steps/timeout-current.js');
  const { possibleTimeoutsReport } = await import('../src/steps/timeout-possible.js');
  const { manageAllTimeoutsStep } = await import('../src/steps/timeout-manage.js');
  const { resetTimeoutsStep } = await import('../src/steps/timeout-reset.js');
  assert.match((await captured(() => currentTimeoutsReport(IP))).out, /not available/);
  assert.match((await captured(() => possibleTimeoutsReport(IP))).out, /not possible/);
  assert.match((await captured(() => manageAllTimeoutsStep(IP))).out, /None of the known timeouts could be read/);
  assert.match((await captured(() => resetTimeoutsStep(IP, { all: true }))).out, /No timeouts have a captured baseline/);
  assert.equal(process.exitCode, 1);

  fake.setState({ offline: true });
  assert.match((await captured(() => currentTimeoutsReport(IP))).out, /not available \(Command failed[\s\S]*not found/);
});

test('timeout flags: conflicting values, --yes alone, a skipped id and a reset the TV refused', async () => {
  const { setOneTimeoutStep } = await import('../src/steps/timeout-set.js');
  const { resetTimeoutsStep } = await import('../src/steps/timeout-reset.js');
  const sleep = findTimeoutById('sleep');
  assert.match((await captured(() => setOneTimeoutStep(IP, sleep, { ms: '1000', minutes: '1' }))).out, /not both|one of/i);
  assert.match((await captured(() => setOneTimeoutStep(IP, sleep, { yes: true }))).out, /--yes alone does not set a value/);

  fake.setState({ system: {} });
  const skipped = await captured(() => resetTimeoutsStep(IP, { only: 'sleep,screensaver' }));
  assert.match(skipped.out, /screensaver has no captured baseline/);

  fake.reset();
  await captured(() => setOneTimeoutStep(IP, sleep, { minutes: '5' }));
  fake.setState({ lockedKeys: ['sleep_timeout'] });
  const refused = await captured(() => resetTimeoutsStep(IP, { all: true }));
  assert.match(refused.out, /did not accept the reset/);
  assert.equal(process.exitCode, 1);
});

test('interactive timeouts: nothing selected, and edits the TV refused', async () => {
  installedEnv();
  const nothing = await drive('bin/firetv-timeouts-reset.js', [], [{ expect: 'Reset which timeouts?', send: `i${ENTER}` }]);
  assert.match(nothing.out, /Nothing selected/, nothing.out);

  fake.setState({ lockedKeys: ['sleep_timeout'] });
  const one = await drive('bin/firetv-timeout-sleep.js', [], [{ expect: 'in minutes', send: `30${ENTER}` }, CONTINUE]);
  assert.match(one.out, /did not accept that value/, one.out);

  const many = await drive('bin/firetv-timeouts.js', [], [
    { expect: 'What would you like to do?', send: `${DOWN} ${ENTER}` },
    { expect: 'minutes', send: `20${ENTER}` },
    CONTINUE,
  ]);
  assert.match(many.out, /did not accept that value/, many.out);
});

test('ensureConnected retries in a terminal: a typo is rejected, an unreachable IP asks again', async () => {
  fs.writeFileSync(fake.envFile, 'FIRE_TV_IP=10.0.0.9\nINSTALLED=true\n');
  fake.setState({ offlineIps: ['10.0.0.9'] });
  const clear = '\x7f'.repeat(12);
  const r = await drive('test/helpers/ss-ensure-connected.js', ['--tty'], [
    { expect: /IP address/, send: `${clear}abc${ENTER}` },
    { expect: 'Enter a valid IPv4 address', send: `${'\x7f'.repeat(3)}${IP}${ENTER}` },
  ]);
  assert.match(r.out, /Couldn't reach a Fire TV at 10\.0\.0\.9/, r.out);
  assert.match(r.out, new RegExp(`Resolved ${IP.replace(/\./g, '\\.')}`), r.out);
});

test('the screensaver timeout runs interactively, and a revert with no apps warns only about settings', async () => {
  installedEnv();
  const timeout = await drive('bin/firetv-timeout-screensaver.js', [], [{ expect: 'in minutes', send: `10${ENTER}` }, CONTINUE]);
  assert.match(timeout.out, /practical ceiling/);
  assert.equal(fake.readState().system.screen_off_timeout, '600000', timeout.out);

  fake.setState({ installed: [] });
  const revert = await drive('bin/firetv-revert.js', [], [
    { expect: 'What should be reverted?', send: ENTER },
    CONTINUE,
    { expect: 'Type "yes"', send: `yes${ENTER}` },
  ]);
  assert.match(revert.out, /This reverts changes on the TV\./, revert.out);
  assert.equal(fake.readState().secure['str.auto_wake_up_enabled'], '0');
});
