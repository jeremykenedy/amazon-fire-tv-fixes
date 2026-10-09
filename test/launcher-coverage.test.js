import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installFakeAdb, captured, AERIAL } from './helpers/fake-adb.js';
import { drive, DOWN, ENTER } from './helpers/drive.js';
import { launcherFetch, useDroppingAdb } from './helpers/launcher-fakes.js';
import { AT4K, HOME_REDIRECT, FIRE_TV_UI } from '../src/launcher-registry.js';
import {
  parseServices,
  servicesFor,
  launcherState,
  explainInstallFailure,
  installLauncherApp,
  useHome,
  removeLauncherApp,
} from '../src/apply/launcher.js';
import { manageLauncher } from '../src/steps/launcher.js';

const ip = '192.168.1.49';
const SERVICES = 'enabled_accessibility_services';
const FETCH_PRELOAD = path.join(path.dirname(fileURLToPath(import.meta.url)), 'helpers', 'launcher-fetch-preload.js');

let fake;
let undoAdb;
let realFetch;

before(() => {
  fake = installFakeAdb();
  undoAdb = useDroppingAdb(fake);
  realFetch = globalThis.fetch;
  globalThis.fetch = launcherFetch();
});

beforeEach(() => {
  fake.reset();
  process.exitCode = undefined;
});

after(() => {
  globalThis.fetch = realFetch;
  undoAdb();
  fake.restore();
  process.exitCode = undefined;
});

const secure = (extra) => ({ ...fake.readState().secure, ...extra });
const bothInstalled = (extra = {}) => fake.setState({ installed: [AERIAL, AT4K.pkg, HOME_REDIRECT.pkg], ...extra });

test('parseServices treats an unset value as empty and drops blanks', () => {
  assert.deepEqual(parseServices(null), []);
  assert.deepEqual(parseServices('null'), []);
  assert.deepEqual(parseServices(' a: b::'), ['a', 'b']);
});

test('servicesFor keeps other services and only adds AT4K once', () => {
  assert.deepEqual(servicesFor(['x', HOME_REDIRECT.service], 'amazon'), ['x']);
  assert.deepEqual(servicesFor(['x'], 'at4k'), ['x', AT4K.service, HOME_REDIRECT.service]);
  assert.deepEqual(servicesFor([AT4K.service, HOME_REDIRECT.service], 'at4k'), [AT4K.service, HOME_REDIRECT.service]);
});

test('explainInstallFailure explains a signature clash and passes anything else through', () => {
  assert.match(explainInstallFailure({ stderr: 'Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE: x]' }), /signed by someone else/);
  assert.equal(explainInstallFailure({ stderr: 'something else broke' }), 'something else broke');
});

test('installLauncherApp installs, re-enables and grants permissions', async () => {
  fake.setState({ disabled: [AT4K.pkg] });
  fake.setState({ installed: [AERIAL, AT4K.pkg] });
  assert.deepEqual(await installLauncherApp(ip, { ...AT4K, sha256: undefined }), { ok: true });
  assert.deepEqual(await installLauncherApp(ip, HOME_REDIRECT), { ok: true });
  const s = fake.readState();
  assert.ok(s.installed.includes(HOME_REDIRECT.pkg));
  assert.deepEqual(s.disabled, []);
  assert.deepEqual(s.grants[HOME_REDIRECT.pkg], HOME_REDIRECT.grants);
});

test('installLauncherApp reports a download that fails its pinned checksum', async () => {
  const r = await installLauncherApp(ip, AT4K);
  assert.equal(r.ok, false);
  assert.match(r.error, /Checksum mismatch/);
  assert.ok(!fake.readState().installed.includes(AT4K.pkg));
});

test('installLauncherApp reports an install the TV refused', async () => {
  fake.setState({ installFail: 'Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE: signatures do not match]' });
  const r = await installLauncherApp(ip, HOME_REDIRECT);
  assert.equal(r.ok, false);
  assert.match(r.error, /signed by someone else/);
});

test('useHome switches to AT4K, re-enabling a disabled app, and back again', async () => {
  bothInstalled({ disabled: [HOME_REDIRECT.pkg] });
  fake.setState({ secure: secure({ [SERVICES]: 'other/svc' }) });
  assert.equal((await launcherState(ip)).home, 'amazon');
  assert.equal(await useHome(ip, 'at4k'), true);
  let s = fake.readState();
  assert.equal(s.secure[SERVICES], `other/svc:${AT4K.service}:${HOME_REDIRECT.service}`);
  assert.equal(s.secure.accessibility_enabled, '1');
  assert.deepEqual(s.disabled, []);
  assert.deepEqual(await launcherState(ip), {
    installed: ['at4k', 'home-redirect'],
    disabled: [],
    services: ['other/svc', AT4K.service, HOME_REDIRECT.service],
    home: 'at4k',
  });

  assert.equal(await useHome(ip, 'amazon'), true);
  s = fake.readState();
  assert.equal(s.secure[SERVICES], `other/svc:${AT4K.service}`);
});

test('useHome clears the setting when no service is left', async () => {
  fake.setState({ secure: secure({ [SERVICES]: HOME_REDIRECT.service, accessibility_enabled: '1' }) });
  assert.equal(await useHome(ip, 'amazon'), true);
  const s = fake.readState();
  assert.equal(s.secure[SERVICES], undefined);
  assert.equal(s.secure.accessibility_enabled, '0');
});

test('useHome reports false when the TV keeps its old value', async () => {
  bothInstalled({ dropWrites: [SERVICES] });
  assert.equal(await useHome(ip, 'at4k'), false);
});

test('removeLauncherApp drops the app and its service, and reports a stuck app', async () => {
  assert.equal(await removeLauncherApp(ip, AT4K), false);

  bothInstalled();
  fake.setState({ secure: secure({ [SERVICES]: `${AT4K.service}:other/svc` }) });
  assert.equal(await removeLauncherApp(ip, AT4K), true);
  assert.equal(fake.readState().secure[SERVICES], 'other/svc');

  assert.equal(await removeLauncherApp(ip, HOME_REDIRECT), true);
  const s = fake.readState();
  assert.equal(s.secure[SERVICES], 'other/svc');
  assert.deepEqual(s.installed, [AERIAL]);
});

test('firetv-launcher --yes alone refuses to guess', async () => {
  const { out } = await captured(() => manageLauncher(ip, { yes: true }));
  assert.match(out, /--yes alone does not pick anything/);
  assert.equal(process.exitCode, 1);
});

test('firetv-launcher --install reports each app and fails when AT4K could not be installed', async () => {
  const { out } = await captured(() => manageLauncher(ip, { install: true }));
  assert.match(out, /AT4K Launcher: Checksum mismatch/);
  assert.match(out, /Home Redirect and Screensaver Picker installed/);
  assert.equal(process.exitCode, 1);
  assert.ok(fake.readState().installed.includes(HOME_REDIRECT.pkg));
});

test('firetv-launcher --install --use=at4k stops before switching when the install failed', async () => {
  const { out } = await captured(() => manageLauncher(ip, { install: true, use: 'at4k' }));
  assert.equal(process.exitCode, 1);
  assert.doesNotMatch(out, /Home button/);
  assert.equal(fake.readState().secure[SERVICES], undefined);
});

test('firetv-launcher --install --use=amazon still checks the Home button after a failed install', async () => {
  const { out } = await captured(() => manageLauncher(ip, { install: true, use: 'amazon' }));
  assert.equal(process.exitCode, 1);
  assert.match(out, /already goes to the Amazon menu/);
});

test('firetv-launcher --install passes when a failed update leaves both apps installed', async () => {
  bothInstalled();
  const { out } = await captured(() => manageLauncher(ip, { install: true, use: 'at4k' }));
  assert.match(out, /Checksum mismatch/);
  assert.match(out, /now goes to AT4K/);
  assert.notEqual(process.exitCode, 1);
  assert.match(fake.readState().secure[SERVICES], /HomeRedirectService/);
});

test('firetv-launcher --use=at4k needs both apps first', async () => {
  const { out } = await captured(() => manageLauncher(ip, { use: 'at4k' }));
  assert.match(out, /both need to be installed first/);
  assert.equal(process.exitCode, 1);
});

test('launcher Fire TV UI choice requires installation and preserves unrelated services', async () => {
  const missing = await captured(() => manageLauncher(ip, { use: FIRE_TV_UI.id }));
  assert.match(missing.out, /Run firetv-ui --install/);
  assert.equal(process.exitCode, 1);
  assert.equal(fake.readState().secure[SERVICES], undefined);

  process.exitCode = undefined;
  installedEnv();
  fake.setState({ installed: [FIRE_TV_UI.pkg], secure: secure({ [SERVICES]: 'reader/Service' }) });
  const switched = await drive('bin/launcher.js', ['--use=fire-tv-ui', '--yes'], []);
  assert.equal(switched.code, 0, switched.out);
  assert.match(switched.out, /now goes to Fire TV UI/);
  assert.equal(fake.readState().secure[SERVICES], `reader/Service:${FIRE_TV_UI.controls}:${FIRE_TV_UI.service}`);

  const back = await captured(() => manageLauncher(ip, { use: 'amazon' }));
  assert.match(back.out, /now goes to the Amazon menu/);
  assert.equal(fake.readState().secure[SERVICES], 'reader/Service');
});

test('launcher menu offers installed Fire TV UI before applying the reviewed choice', async () => {
  installedEnv();
  fake.setState({ installed: [FIRE_TV_UI.pkg] });
  const on = await drive('bin/launcher.js', [], [
    { expect: 'What would you like to do?', send: `${DOWN}${DOWN}${ENTER}` },
    CONTINUE,
  ], withFetchStub);
  assert.equal(on.code, 0, on.out);
  assert.match(on.out, /Use Fire TV UI as the home screen/);
  assert.equal(fake.readState().secure[SERVICES], `${FIRE_TV_UI.controls}:${FIRE_TV_UI.service}`);
});

test('firetv-launcher --use switches and goes back', async () => {
  bothInstalled();
  const on = await captured(() => manageLauncher(ip, { use: 'at4k' }));
  assert.match(on.out, /now goes to AT4K/);
  const again = await captured(() => manageLauncher(ip, { use: 'at4k' }));
  assert.match(again.out, /already goes to AT4K/);
  const off = await captured(() => manageLauncher(ip, { use: 'amazon' }));
  assert.match(off.out, /now goes to the Amazon menu/);
  assert.notEqual(process.exitCode, 1);
});

test('firetv-launcher --use reports a TV that did not switch', async () => {
  bothInstalled({ dropWrites: [SERVICES] });
  const { out } = await captured(() => manageLauncher(ip, { use: 'at4k' }));
  assert.match(out, /The TV did not switch to AT4K/);
  assert.equal(process.exitCode, 1);
});

function installedEnv() {
  fs.writeFileSync(fake.envFile, `FIRE_TV_IP=${ip}\nINSTALLED=true\n`);
}

const CONTINUE = { expect: 'Nothing has been changed yet. Continue?', send: ENTER };
const withFetchStub = { env: { NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --import=${FETCH_PRELOAD}`.trim() } };

test('firetv-launcher menu: install from a fresh TV', async () => {
  installedEnv();
  const r = await drive('bin/firetv-launcher.js', [], [
    { expect: 'What would you like to do?', send: ENTER },
    CONTINUE,
  ], withFetchStub);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /Right now the Home button goes to the Amazon menu/);
  assert.match(r.out, /Install AT4K and the Home Redirect app/);
  assert.match(r.out, /Checksum mismatch/);
  assert.ok(fake.readState().installed.includes(HOME_REDIRECT.pkg), r.out);
});

test('launcher menu: switch the Home button to AT4K, then back with firetv-launcher', async () => {
  installedEnv();
  bothInstalled();
  const on = await drive('bin/launcher.js', [], [
    { expect: 'What would you like to do?', send: `${DOWN}${ENTER}` },
    CONTINUE,
  ], withFetchStub);
  assert.equal(on.code, 0, on.out);
  assert.match(on.out, /Update AT4K and the Home Redirect app/);
  assert.match(on.out, /now goes to AT4K/);
  assert.match(fake.readState().secure[SERVICES], /HomeRedirectService/);

  const off = await drive('bin/firetv-launcher.js', [], [
    { expect: 'What would you like to do?', send: `${DOWN}${ENTER}` },
    CONTINUE,
  ], withFetchStub);
  assert.equal(off.code, 0, off.out);
  assert.match(off.out, /Go back to the Amazon home screen/);
  assert.match(off.out, /now goes to the Amazon menu/);
  assert.doesNotMatch(fake.readState().secure[SERVICES], /HomeRedirectService/);
});
