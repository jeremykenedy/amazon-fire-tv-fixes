import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { installFakeAdb, captured, AERIAL } from './helpers/fake-adb.js';
import { useDroppingAdb } from './helpers/launcher-fakes.js';
import { fireTvUiFetch } from './helpers/fire-tv-ui-fetch-preload.js';
import { drive, DOWN, ENTER } from './helpers/drive.js';
import { FIRE_TV_UI, AT4K, HOME_REDIRECT } from '../src/launcher-registry.js';
import { AMAZON_DEFAULT } from '../src/screensaver-registry.js';
import { servicesFor, useHome, launcherState } from '../src/apply/launcher.js';
import {
  validateBackup, TV_BACKUP, TV_IMPORT, retrieveBackup, placeBackup,
  installFireTvUi, uninstallFireTvUi, configureScreensaver, UI_SCREENSAVERS,
  readBackup, grantBackupAccess, saveTvBackup,
} from '../src/apply/fire-tv-ui.js';
import { manageFireTvUi, optionsFromFlags, planSummary } from '../src/steps/fire-tv-ui.js';
import { buildLauncherRevertOptions } from '../src/steps/uninstall.js';
import { uninstallEverything } from '../src/steps/uninstall.js';
import { getSetting, putSetting } from '../src/adb.js';
import { setTimeoutMs, findTimeoutById } from '../src/apply/timeouts.js';
import { setAlexaFix } from '../src/apply/alexa-fix.js';
import { turnGuardOn, turnGuardOff, unlockGroup, lockGroup } from '../src/apply/guard.js';

const ip = '192.168.1.49';
const SERVICES = 'enabled_accessibility_services';
const FETCH_PRELOAD = fileURLToPath(new URL('./helpers/fire-tv-ui-fetch-preload.js', import.meta.url));
const CONTINUE = { expect: 'Nothing has been changed yet. Continue?', send: ENTER };
let fake;
let undo;
let realFetch;

before(() => {
  fake = installFakeAdb();
  undo = useDroppingAdb(fake);
  realFetch = globalThis.fetch;
  globalThis.fetch = fireTvUiFetch();
});
beforeEach(() => { fake.reset(); process.exitCode = undefined; });
after(() => { globalThis.fetch = realFetch; undo(); fake.restore(); process.exitCode = undefined; });

function installed(extra = {}) {
  fake.setState({ installed: [AERIAL, FIRE_TV_UI.pkg], preferences: { apps_per_row: 7 },
    secure: { ...fake.readState().secure, [SERVICES]: `reader/Service:${FIRE_TV_UI.controls}:${FIRE_TV_UI.service}`, accessibility_enabled: '1' }, ...extra });
}
function flags(extra = {}) { return optionsFromFlags({ install: true, ...extra }); }
function source(data = { apps_per_row: 4 }) {
  const filename = path.join(fake.dir, 'incoming.json');
  fs.writeFileSync(filename, JSON.stringify(data));
  return filename;
}
function installedEnv() { fs.writeFileSync(fake.envFile, `FIRE_TV_IP=${ip}\nINSTALLED=true\n`); }

test('invalid or conflicting Fire TV UI options refuse to guess', () => {
  for (const value of [{ yes: true }, { install: true, uninstall: true }, { setup: 'simple' },
    { install: true, setup: 'import' }, { uninstall: true, home: 'amazon' },
    { install: true, apk: 'a.apk' }, { install: true, file: 'x' }, { file: 'x', export: 'y' }]) {
    assert.throws(() => optionsFromFlags(value));
  }
  assert.equal(flags().setup, 'keep');
  assert.equal(flags().home, 'keep');
  assert.equal(optionsFromFlags({ uninstall: true }).backup, 'keep');
});

test('backup validation preserves portable settings and rejects malformed or nested values', () => {
  const valid = { apps_per_row: 5, white_border: false, mode: 'custom', favorites: ['tv'] };
  assert.deepEqual(validateBackup(Buffer.from(JSON.stringify(valid))), valid);
  for (const value of ['invalid', '{}', '[]', '{"mode":null}', '{"mode":{}}', '{"favorites":[5]}', '{"count":9007199254740993}']) {
    assert.throws(() => validateBackup(Buffer.from(value)));
  }
  assert.throws(() => validateBackup(Buffer.alloc(8 * 1024 * 1024 + 1)));
});

test('Fire TV UI Home replaces conflicting launcher services and preserves unrelated services', async () => {
  fake.setState({ installed: [FIRE_TV_UI.pkg, AT4K.pkg, HOME_REDIRECT.pkg],
    secure: { [SERVICES]: `reader/Service:${AT4K.service}:${HOME_REDIRECT.service}`, accessibility_enabled: '1' } });
  assert.equal(await useHome(ip, FIRE_TV_UI.id), true);
  assert.equal((await launcherState(ip)).home, FIRE_TV_UI.id);
  assert.equal(fake.readState().secure[SERVICES], `reader/Service:${FIRE_TV_UI.controls}:${FIRE_TV_UI.service}`);
  assert.equal(await useHome(ip, 'amazon'), true);
  assert.equal(fake.readState().secure[SERVICES], 'reader/Service');
  assert.deepEqual(servicesFor([FIRE_TV_UI.service, FIRE_TV_UI.controls, 'reader/Service'], 'at4k'),
    ['reader/Service', AT4K.service, HOME_REDIRECT.service]);
});

test('a partially rejected Home change restores the previous services and enabled setting', async () => {
  fake.setState({ installed: [FIRE_TV_UI.pkg], secure: { [SERVICES]: 'reader/Service', accessibility_enabled: '0' },
    dropWrites: ['accessibility_enabled'] });
  assert.equal(await useHome(ip, FIRE_TV_UI.id), false);
  assert.equal(fake.readState().secure[SERVICES], 'reader/Service');
  assert.equal(fake.readState().secure.accessibility_enabled, '0');
});

test('intentional CLI timer and screensaver changes update the protected settings', async () => {
  installed();
  assert.deepEqual(await setTimeoutMs(ip, findTimeoutById('sleep'), 600000),
    { applied: true, readBackMs: 600000 });
  await putSetting(ip, 'system', 'screen_off_timeout', 300000);
  await putSetting(ip, 'secure', 'screensaver_components', `${AERIAL}/.AerialDream`);
  await putSetting(ip, 'secure', 'screensaver_enabled', 0);
  const prefs = fake.readState().preferences;
  assert.equal(prefs.fire_tv_ui_sleep, 600000);
  assert.equal(prefs.fire_tv_ui_idle, 300000);
  assert.equal(prefs.fire_tv_ui_dream, `${AERIAL}/.AerialDream`);
  assert.equal(prefs.fire_tv_ui_dream_enabled, false);
  assert.equal(await setAlexaFix(ip, false), false);
  assert.equal(fake.readState().preferences.fire_tv_ui_auto_wake, 0);
  assert.equal(await setAlexaFix(ip, true), true);
  assert.equal(fake.readState().preferences.fire_tv_ui_auto_wake, 1);
});

test('a rejected protected timer returns its unchanged read-back value', async () => {
  installed({ rejectOverMax: true });
  const before = Number(await getSetting(ip, 'system', 'screen_off_timeout'));
  assert.deepEqual(await setTimeoutMs(ip, findTimeoutById('screensaver'), 2147483648),
    { applied: false, readBackMs: before });
});

test('a disconnected TV raises a timer communication failure instead of reporting a rejected value', async () => {
  fake.setState({ offline: true });
  const before = fake.readState();
  await assert.rejects(setTimeoutMs(ip, findTimeoutById('sleep'), 600000), /not found/);
  assert.deepEqual(fake.readState(), before);
});

test('revert cannot claim factory defaults when the TV timers are unreadable', async () => {
  fake.setState({ installed: [], secure: { 'str.auto_wake_up_enabled': '0',
    screensaver_components: AMAZON_DEFAULT.dreamComponent }, system: {} });
  const result = await captured(() => uninstallEverything(ip, { all: true, force: true }));
  assert.equal(result.result, 'failed');
  assert.match(result.out, /cannot confirm the TV is at factory defaults/);
  assert.equal(process.exitCode, 1);
});

test('simple install applies the preset and sets up Home and backup access', async () => {
  await installFireTvUi(ip, flags({ setup: 'simple', home: FIRE_TV_UI.id }));
  const state = fake.readState();
  assert.ok(state.installed.includes(FIRE_TV_UI.pkg));
  assert.equal(state.preferences.apps_per_row, 5);
  assert.equal(state.appops[FIRE_TV_UI.pkg].MANAGE_EXTERNAL_STORAGE, 'allow');
  assert.ok(state.grants[FIRE_TV_UI.pkg].includes('android.permission.WRITE_SECURE_SETTINGS'));
  assert.equal((await launcherState(ip)).home, FIRE_TV_UI.id);
  assert.equal(fs.existsSync(state.lastInstallPath), false);
});

test('an update preserves the current layout and restores Home dropped by Android', async () => {
  installed({ dropServicesOnInstall: true });
  await installFireTvUi(ip, flags());
  assert.equal(fake.readState().preferences.apps_per_row, 7);
  assert.equal(JSON.parse(fake.readState().files[TV_BACKUP]).apps_per_row, 7);
  assert.equal((await launcherState(ip)).home, FIRE_TV_UI.id);
});

test('an update reports a rejected Home rebind and keeps the saved layout', async () => {
  installed({ dropServicesOnInstall: true, dropWrites: [SERVICES] });
  await assert.rejects(installFireTvUi(ip, flags()), /restore its Home button after the update/);
  assert.equal(fake.readState().preferences.apps_per_row, 7);
  assert.equal(JSON.parse(fake.readState().files[TV_BACKUP]).apps_per_row, 7);
  assert.ok(fake.readState().installed.includes(FIRE_TV_UI.pkg));
  assert.equal(fs.existsSync(fake.readState().lastInstallPath), false);
});

test('an existing toolkit guard is upgraded before Fire TV UI is configured', async () => {
  installed({ installed: [AERIAL, FIRE_TV_UI.pkg, HOME_REDIRECT.pkg],
    versions: { [HOME_REDIRECT.pkg]: '1.2.1' } });
  const progress = [];
  await installFireTvUi(ip, flags(), (message) => progress.push(message));
  assert.ok(progress.includes('Updating the toolkit guard for Fire TV UI'));
  assert.ok(fake.readState().grants[HOME_REDIRECT.pkg].includes('android.permission.WRITE_SECURE_SETTINGS'));
  assert.equal(fake.readState().preferences.apps_per_row, 7);
});

test('a failed toolkit guard upgrade stops before replacing Fire TV UI', async () => {
  installed({ installed: [AERIAL, FIRE_TV_UI.pkg, HOME_REDIRECT.pkg],
    versions: { [HOME_REDIRECT.pkg]: '1.2.1' }, installFail: 'not enough storage' });
  await assert.rejects(installFireTvUi(ip, flags()), /Could not update the toolkit guard/);
  assert.equal(fake.readState().preferences.apps_per_row, 7);
  assert.equal(fake.readState().opened, undefined);
});

test('toolkit guard controls the native protector and preserves screensaver unlock and lock behavior', async () => {
  installed({ installed: [AERIAL, FIRE_TV_UI.pkg, HOME_REDIRECT.pkg],
    versions: { [HOME_REDIRECT.pkg]: '1.2.2' } });
  const on = await turnGuardOn(ip);
  assert.ok(on.every((result) => result.ok));
  assert.equal(fake.readState().preferences.fire_tv_ui_protect_settings, true);
  await unlockGroup(ip, 'screensaver');
  assert.equal(fake.readState().preferences.fire_tv_ui_dream_unlocked, true);
  await lockGroup(ip, 'screensaver');
  assert.equal(fake.readState().preferences.fire_tv_ui_dream_unlocked, false);
  await turnGuardOff(ip);
  assert.equal(fake.readState().preferences.fire_tv_ui_protect_settings, false);
  assert.equal(fake.readState().guard.locked, false);
});

test('a TV backup chosen for installation is restored even when the current layout is backed up first', async () => {
  installed({ files: { [TV_BACKUP]: '{"apps_per_row":3}' } });
  await installFireTvUi(ip, flags({ setup: 'tv' }));
  assert.equal(fake.readState().preferences.apps_per_row, 3);
  assert.equal(JSON.parse(fake.readState().files[TV_BACKUP]).apps_per_row, 7);
});

test('a failed download or unsupported TV cannot replace the app or its settings', async () => {
  fake.setState({ sdk: 26 });
  await assert.rejects(installFireTvUi(ip, flags()), /Android 8.1/);
  assert.equal(fake.readState().lastInstallPath, undefined);
  fake.reset();
  globalThis.fetch = async () => Response.json({ assets: [], body: '' });
  try { await assert.rejects(installFireTvUi(ip, flags()), /No .*asset/); }
  finally { globalThis.fetch = fireTvUiFetch(); }
  assert.equal(fake.readState().lastInstallPath, undefined);
});

test('backup transfer round trips without overwriting the saved TV backup or an existing computer file', async () => {
  installed({ files: { [TV_BACKUP]: '{"apps_per_row":9}' } });
  const filename = source();
  await placeBackup(ip, filename);
  assert.equal(fake.readState().files[TV_BACKUP], '{"apps_per_row":9}');
  assert.equal(fake.readState().preferences.apps_per_row, 7);
  await placeBackup(ip, filename, { restore: true });
  assert.equal(fake.readState().preferences.apps_per_row, 4);
  const destination = path.join(fake.dir, 'retrieved.json');
  await retrieveBackup(ip, destination);
  assert.deepEqual(JSON.parse(fs.readFileSync(destination)), { apps_per_row: 4 });
  await assert.rejects(retrieveBackup(ip, destination), /already exists/);
  assert.deepEqual(JSON.parse(fs.readFileSync(destination)), { apps_per_row: 4 });
  if (process.platform !== 'win32') assert.equal(fs.statSync(destination).mode & 0o777, 0o600);
});

test('a corrupt transfer and invalid import cannot apply settings', async () => {
  installed({ transferMismatch: true });
  await assert.rejects(placeBackup(ip, source(), { restore: true }), /did not match/);
  assert.equal(fake.readState().preferences.apps_per_row, 7);
  const invalid = source({ mode: null });
  const before = fake.readState();
  await assert.rejects(placeBackup(ip, invalid, { restore: true }), /Invalid value/);
  assert.deepEqual(fake.readState(), before);
});

test('uninstall saves the layout, keeps the TV backup, and sends Home back to Amazon', async () => {
  installed();
  await uninstallFireTvUi(ip);
  const state = fake.readState();
  assert.ok(!state.installed.includes(FIRE_TV_UI.pkg));
  assert.equal(JSON.parse(state.files[TV_BACKUP]).apps_per_row, 7);
  assert.equal(state.secure[SERVICES], 'reader/Service');
  const destination = path.join(fake.dir, 'after-uninstall.json');
  await retrieveBackup(ip, destination, { refresh: false });
  assert.equal(JSON.parse(fs.readFileSync(destination)).apps_per_row, 7);
});

test('uninstall aborts if it cannot save the requested backup', async () => {
  installed({ backupFail: true });
  const before = fake.readState();
  await assert.rejects(uninstallFireTvUi(ip), /backup failed/);
  assert.deepEqual(fake.readState().installed, before.installed);
  assert.equal(fake.readState().secure[SERVICES], before.secure[SERVICES]);
});

test('uninstall keeps the app when the backup receiver reports success without creating a file', async () => {
  installed({ backupMissing: true });
  await assert.rejects(uninstallFireTvUi(ip), /did not create the backup/);
  assert.equal((await launcherState(ip)).home, FIRE_TV_UI.id);
  assert.ok(fake.readState().installed.includes(FIRE_TV_UI.pkg));
});

test('an unreadable Android version refuses installation before downloading', async () => {
  fake.setState({ sdk: 'unknown' });
  await assert.rejects(installFireTvUi(ip, {}), /did not report its Android version/);
  assert.equal(fake.readState().lastInstallPath, undefined);
});

test('a local APK for another package cannot be configured as Fire TV UI', async () => {
  const apk = path.join(fake.dir, 'other.apk');
  const bytes = 'pkg:com.example.other';
  fs.writeFileSync(apk, bytes);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  await assert.rejects(installFireTvUi(ip, { apk, sha256 }), /did not install Fire TV UI/);
  assert.equal(fake.readState().grants, undefined);
  assert.equal(fake.readState().opened, undefined);
  assert.equal(fs.existsSync(fake.readState().lastInstallPath), false);
});

test('an acknowledged but ignored screensaver change restores the previous selection', async () => {
  fake.setState({ dropWrites: ['screensaver_components'],
    secure: { screensaver_components: 'old/Old', screensaver_enabled: '0' } });
  await assert.rejects(configureScreensaver(ip, 'aerial'), /did not save the selected screensaver/);
  assert.equal(fake.readState().secure.screensaver_components, 'old/Old');
  assert.equal(fake.readState().secure.screensaver_enabled, '0');
});

test('backup deletion only happens when explicitly selected', async () => {
  installed({ files: { [TV_BACKUP]: '{}', [TV_IMPORT]: '{}', '/sdcard/Download/other.txt': 'keep' } });
  await uninstallFireTvUi(ip, { backup: 'delete' });
  assert.equal(fake.readState().files?.[TV_BACKUP], undefined);
  assert.equal(fake.readState().files[TV_IMPORT], undefined);
  assert.equal(fake.readState().files['/sdcard/Download/other.txt'], 'keep');
});

test('screensaver selection rolls back when enabling it is rejected', async () => {
  const aerial = UI_SCREENSAVERS.find((entry) => entry.pkg === AERIAL);
  fake.setState({ secure: { screensaver_components: 'old/Old', screensaver_enabled: '0' }, lockedKeys: ['screensaver_enabled'] });
  await assert.rejects(configureScreensaver(ip, aerial.id), /did not save/);
  assert.equal(fake.readState().secure.screensaver_components, 'old/Old');
  assert.equal(fake.readState().secure.screensaver_enabled, '0');
});

test('the global revert offers Fire TV UI removal with backup retention', () => {
  const options = buildLauncherRevertOptions({ home: FIRE_TV_UI.id, installed: [FIRE_TV_UI.id] });
  assert.deepEqual(options.map((option) => option.value), ['home', 'launcher:fire-tv-ui']);
  assert.match(options[1].name, /keep.*backup/);
});

test('firetv-ui refuses incomplete flags without changing anything', async () => {
  const before = fake.readState();
  const { out } = await captured(() => manageFireTvUi(ip, { yes: true }));
  assert.match(out, /Choose --install/);
  assert.deepEqual(fake.readState(), before);
});

test('the installer collects layout, Home and screensaver choices and cancellation changes nothing', async () => {
  installedEnv();
  const before = fake.readState();
  const result = await drive('bin/firetv-ui.js', [], [
    { expect: 'What would you like to do with Fire TV UI?', send: ENTER },
    { expect: 'How would you like to set up Fire TV UI?', send: ENTER },
    { expect: 'What should the Home button open?', send: `${DOWN}${ENTER}` },
    { expect: 'TV screensaver:', send: `${DOWN}${ENTER}` },
    { expect: 'Protect your device settings from system reversion?', send: `${DOWN}${ENTER}` },
    { expect: 'Nothing has been changed yet. Continue?', send: `${DOWN}${DOWN}${ENTER}` },
  ]);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /Apply the saved simple layout/);
  assert.match(result.out, /Cancelled/);
  assert.deepEqual(fake.readState(), before);
});

test('the guided installer applies the reviewed setup only after confirmation', async () => {
  installedEnv();
  const result = await drive('bin/firetv-ui.js', [], [
    { expect: 'What would you like to do with Fire TV UI?', send: ENTER },
    { expect: 'How would you like to set up Fire TV UI?', send: ENTER },
    { expect: 'What should the Home button open?', send: `${DOWN}${ENTER}` },
    { expect: 'TV screensaver:', send: `${DOWN}${ENTER}` },
    { expect: 'Protect your device settings from system reversion?', send: `${DOWN}${ENTER}` }, CONTINUE,
  ], { env: { NODE_OPTIONS: `--import=${FETCH_PRELOAD}` } });
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /Fire TV UI is ready/);
  assert.equal(fake.readState().preferences.apps_per_row, 5);
  assert.equal((await launcherState(ip)).home, FIRE_TV_UI.id);
});

test('invalid backup paths and oversized files fail before any transfer', () => {
  assert.throws(() => readBackup(fake.dir), /backup file/);
  const large = path.join(fake.dir, 'large.txt');
  fs.writeFileSync(large, Buffer.alloc(8 * 1024 * 1024 + 1));
  assert.throws(() => readBackup(large), /8 MB/);
});

test('legacy Android grants storage permissions and a rejected storage grant cannot save a backup', async () => {
  fake.setState({ sdk: 29 });
  await grantBackupAccess(ip);
  assert.deepEqual(fake.readState().grants[FIRE_TV_UI.pkg],
    ['android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE']);
  fake.reset();
  installed({ lockedKeys: ['MANAGE_EXTERNAL_STORAGE'] });
  await assert.rejects(saveTvBackup(ip), /persistent backup access/);
  assert.equal(fake.readState().files?.[TV_BACKUP], undefined);
});

test('local APKs require the exact checksum before installation and staged files are removed', async () => {
  const apk = path.join(fake.dir, 'ui.apk');
  const bytes = `pkg:${FIRE_TV_UI.pkg}`;
  fs.writeFileSync(apk, bytes);
  await assert.rejects(installFireTvUi(ip, { apk }), /requires its SHA-256/);
  await assert.rejects(installFireTvUi(ip, { apk, sha256: '0'.repeat(64) }), /does not match/);
  assert.equal(fake.readState().lastInstallPath, undefined);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  await installFireTvUi(ip, { apk, sha256: sha256.toUpperCase(), protection: 'off', screensaver: 'off' });
  assert.equal(fake.readState().secure.screensaver_enabled, '0');
  assert.equal(fake.readState().preferences.fire_tv_ui_protect_settings, false);
  assert.equal(fs.existsSync(fake.readState().lastInstallPath), false);
  assert.equal(fs.readFileSync(apk, 'utf8'), bytes);
});

test('import installation restores the supplied layout and exports the prior layout', async () => {
  installed();
  const destination = path.join(fake.dir, 'previous.json');
  await installFireTvUi(ip, { setup: 'import', file: source(), export: destination,
    home: FIRE_TV_UI.id, screensaver: 'aerial', protection: 'on' });
  assert.equal(JSON.parse(fs.readFileSync(destination)).apps_per_row, 7);
  assert.equal(fake.readState().preferences.apps_per_row, 4);
  assert.equal(fake.readState().preferences.fire_tv_ui_protect_settings, true);
  assert.equal(fake.readState().secure.screensaver_components, UI_SCREENSAVERS[0].dreamComponent);
});

test('invalid or absent screensavers refuse the install before downloading the launcher', async () => {
  for (const screensaver of ['unknown', 'androsaver']) {
    await assert.rejects(installFireTvUi(ip, { screensaver }), /already installed/);
  }
  await assert.rejects(configureScreensaver(ip, 'unknown'), /supported/);
  await assert.rejects(configureScreensaver(ip, 'androsaver'), /not installed/);
  assert.equal(fake.readState().lastInstallPath, undefined);
});

test('screensaver changes preserve an existing disabled protection preference', async () => {
  installed({ preferences: { apps_per_row: 7, fire_tv_ui_protect_settings: false } });
  await installFireTvUi(ip, { screensaver: 'on', protection: 'keep' });
  assert.equal(fake.readState().preferences.fire_tv_ui_protect_settings, false);
  assert.equal(fake.readState().secure.screensaver_enabled, '1');
});

test('rejected usage access fails clearly and deletes the downloaded APK', async () => {
  fake.setState({ lockedKeys: ['GET_USAGE_STATS'] });
  await assert.rejects(installFireTvUi(ip, {}), /GET_USAGE_STATS/);
  assert.equal(fs.existsSync(fake.readState().lastInstallPath), false);
});

test('a failed Home change keeps the app and original Home state', async () => {
  installed({ dropWrites: [SERVICES] });
  await assert.rejects(installFireTvUi(ip, { home: 'amazon' }), /Home button choice/);
  assert.equal((await launcherState(ip)).home, FIRE_TV_UI.id);
  await assert.rejects(uninstallFireTvUi(ip), /kept installed/);
  assert.ok(fake.readState().installed.includes(FIRE_TV_UI.pkg));
});

test('failed removal restores Fire TV UI Home and retains its backup', async () => {
  installed({ stuck: true });
  await assert.rejects(uninstallFireTvUi(ip), /could not uninstall/);
  assert.equal((await launcherState(ip)).home, FIRE_TV_UI.id);
  assert.equal(JSON.parse(fake.readState().files[TV_BACKUP]).apps_per_row, 7);
});

test('uninstall can export a private copy before explicitly deleting the TV backup', async () => {
  installed();
  const destination = path.join(fake.dir, 'removed.json');
  await uninstallFireTvUi(ip, { backup: 'delete', export: destination });
  assert.equal(JSON.parse(fs.readFileSync(destination)).apps_per_row, 7);
  assert.equal(fake.readState().files[TV_BACKUP], undefined);
  assert.equal(fake.readState().preferences.fire_tv_ui_home_enabled, false);
});

test('flag-based backup transfer and removal report success and preflight invalid paths', async () => {
  installed();
  const before = fake.readState();
  const missingFolder = path.join(fake.dir, 'missing', 'new.txt');
  const failed = await captured(() => manageFireTvUi(ip, { export: missingFolder, yes: true }));
  assert.match(failed.out, /folder/);
  assert.equal(process.exitCode, 1);
  assert.deepEqual(fake.readState(), before);
  process.exitCode = undefined;
  const destination = path.join(fake.dir, 'flags.json');
  const exported = await captured(() => manageFireTvUi(ip, { export: destination, yes: true }));
  assert.match(exported.out, /Backup retrieved/);
  const imported = await captured(() => manageFireTvUi(ip, { file: source(), restore: true, yes: true }));
  assert.match(imported.out, /transferred and restored/);
  assert.equal(fake.readState().preferences.apps_per_row, 4);
  const placed = await captured(() => manageFireTvUi(ip, { file: source(), yes: true }));
  assert.match(placed.out, /transferred\. Open/);
  const removed = await captured(() => manageFireTvUi(ip, { uninstall: true, backup: 'delete', yes: true }));
  assert.match(removed.out, /TV backups were removed/);
});

test('export cannot invent a current layout on an uninstalled TV and execution failures return failure', async () => {
  const destination = path.join(fake.dir, 'missing.txt');
  const result = await captured(() => manageFireTvUi(ip, { install: true, export: destination, yes: true }));
  assert.match(result.out, /no installed/);
  assert.equal(fake.readState().lastInstallPath, undefined);
  assert.equal(process.exitCode, 1);
  process.exitCode = undefined;
  installed({ backupFail: true });
  const removed = await captured(() => manageFireTvUi(ip, { uninstall: true, yes: true }));
  assert.match(removed.out, /backup failed/);
  assert.ok(fake.readState().installed.includes(FIRE_TV_UI.pkg));
  assert.equal(process.exitCode, 1);
});

test('backup plans and invalid option combinations remain explicit', () => {
  assert.match(planSummary({ action: 'export', export: 'a.txt' })[0].detail, /a.txt/);
  assert.match(planSummary({ action: 'import', file: 'a.txt', restore: false })[1].label, /Leave it ready/);
  assert.match(planSummary({ action: 'uninstall', backup: 'keep', export: 'a.txt' })[2].label, /Retrieve/);
  assert.match(planSummary({ action: 'install', setup: 'keep', export: 'a.txt' }).at(-1).label, /Retrieve/);
  for (const value of [{ uninstall: true, backup: 'keep', file: 'a.txt' }, { install: true, file: 'a.txt' },
    { export: 'a.txt', backup: 'keep' }, { export: 'a.txt', restore: true }, { install: true, restore: true },
    { install: true, sha256: '0'.repeat(64) }, { export: 'a.txt', setup: 'simple' }]) assert.throws(() => optionsFromFlags(value));
});

test('explicit install flags still require review unless --yes was passed', async () => {
  installedEnv();
  const before = fake.readState();
  const result = await drive('bin/firetv-ui.js', ['--install', '--setup=simple'], [
    { expect: 'Nothing has been changed yet. Continue?', send: `${DOWN}${DOWN}${ENTER}` },
  ]);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /Apply the saved simple layout/);
  assert.deepEqual(fake.readState(), before);
});

test('the backup retrieval wizard validates empty and existing filenames before saving', async () => {
  installedEnv(); installed();
  const destination = path.join(fake.dir, 'wizard-retrieved.json');
  const result = await drive('bin/firetv-ui.js', [], [
    { expect: 'What would you like to do with Fire TV UI?', send: `${DOWN}${DOWN}${ENTER}` },
    { expect: 'Save the backup on this computer as:', send: ENTER },
    { expect: 'Enter a filename.', send: `${source()}${ENTER}` },
    { expect: 'That file already exists.', send: `\x15${destination}${ENTER}` },
    CONTINUE,
  ], { env: { TERM: 'xterm-256color' } });
  assert.equal(result.code, 0, result.out);
  assert.equal(JSON.parse(fs.readFileSync(destination)).apps_per_row, 7);
});

test('the import wizard validates a missing file and restores only after review', async () => {
  installedEnv(); installed();
  const incoming = source();
  const result = await drive('bin/firetv-ui.js', [], [
    { expect: 'What would you like to do with Fire TV UI?', send: `${DOWN.repeat(3)}${ENTER}` },
    { expect: 'Path to the settings backup:', send: `/missing/backup.txt${ENTER}` },
    { expect: 'ENOENT', send: `\x15${incoming}${ENTER}` },
    { expect: 'Apply the backup now?', send: `${DOWN}${DOWN}${ENTER}` },
    CONTINUE,
  ], { env: { TERM: 'xterm-256color' } });
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /Backup transferred and restored/);
  assert.equal(fake.readState().preferences.apps_per_row, 4);
});

test('the removal wizard can retrieve a backup before keeping it on the TV', async () => {
  installedEnv(); installed();
  const destination = path.join(fake.dir, 'wizard-removed.json');
  const result = await drive('bin/firetv-ui.js', [], [
    { expect: 'What would you like to do with Fire TV UI?', send: `${DOWN}${ENTER}` },
    { expect: 'Also save a copy on this computer?', send: `${DOWN}${ENTER}` },
    { expect: 'Save the backup on this computer as:', send: `${destination}${ENTER}` },
    { expect: 'Keep the backup after uninstalling?', send: `${DOWN}${ENTER}` },
    CONTINUE,
  ]);
  assert.equal(result.code, 0, result.out);
  assert.ok(!fake.readState().installed.includes(FIRE_TV_UI.pkg));
  assert.equal(JSON.parse(fs.readFileSync(destination)).apps_per_row, 7);
  assert.equal(JSON.parse(fake.readState().files[TV_BACKUP]).apps_per_row, 7);
});

test('the removal wizard makes backup deletion explicit and cancellation preserves the app and files', async () => {
  installedEnv(); installed({ files: { [TV_BACKUP]: '{"apps_per_row":7}' } });
  const before = fake.readState();
  const result = await drive('bin/firetv-ui.js', [], [
    { expect: 'What would you like to do with Fire TV UI?', send: `${DOWN}${ENTER}` },
    { expect: 'Also save a copy on this computer?', send: ENTER },
    { expect: 'Keep the backup after uninstalling?', send: `${DOWN.repeat(2)}${ENTER}` },
    { expect: 'Nothing has been changed yet. Continue?', send: `${DOWN.repeat(2)}${ENTER}` },
  ]);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /Delete the Fire TV UI backup files/);
  assert.deepEqual(fake.readState(), before);
});

test('the installer wizard restores a saved TV backup while retaining the prior layout', async () => {
  installedEnv(); installed({ files: { [TV_BACKUP]: '{"apps_per_row":3}' } });
  const result = await drive('bin/firetv-ui.js', [], [
    { expect: 'What would you like to do with Fire TV UI?', send: ENTER },
    { expect: 'How would you like to set up Fire TV UI?', send: `${DOWN.repeat(2)}${ENTER}` },
    { expect: 'Also save a copy on this computer?', send: `${DOWN}${ENTER}` },
    { expect: 'What should the Home button open?', send: `${DOWN.repeat(2)}${ENTER}` },
    { expect: 'TV screensaver:', send: `${DOWN}${ENTER}` },
    { expect: 'Protect your device settings from system reversion?', send: `${DOWN.repeat(2)}${ENTER}` },
    CONTINUE,
  ], { env: { NODE_OPTIONS: `--import=${FETCH_PRELOAD}` } });
  assert.equal(result.code, 0, result.out);
  assert.equal(fake.readState().preferences.apps_per_row, 3);
  assert.equal(JSON.parse(fake.readState().files[TV_BACKUP]).apps_per_row, 7);
});

test('a backup can be placed on a TV before Fire TV UI is installed without offering immediate restore', async () => {
  installedEnv();
  const incoming = source();
  const result = await drive('bin/firetv-ui.js', [], [
    { expect: 'What would you like to do with Fire TV UI?', send: `${DOWN}${ENTER}` },
    { expect: 'Path to the settings backup:', send: `${incoming}${ENTER}` },
    { expect: 'Apply the backup now?', send: `${DOWN}${ENTER}` },
    CONTINUE,
  ]);
  assert.equal(result.code, 0, result.out);
  assert.doesNotMatch(result.out, /Restore it now and reopen/);
  assert.equal(JSON.parse(fake.readState().files[TV_IMPORT]).apps_per_row, 4);
  assert.equal(fake.readState().preferences, undefined);
});

test('an installed launcher update supports backing out to choose another setup', async () => {
  installedEnv(); installed();
  const before = fake.readState();
  const result = await drive('bin/firetv-ui.js', [], [
    { expect: 'What would you like to do with Fire TV UI?', send: ENTER },
    { expect: 'How would you like to set up Fire TV UI?', send: `${DOWN}${ENTER}` },
    { expect: 'Also save a copy on this computer?', send: ENTER },
    { expect: 'How would you like to set up Fire TV UI?', send: `${DOWN.repeat(2)}${ENTER}` },
    { expect: 'Path to the settings backup:', send: `${source()}${ENTER}` },
    { expect: 'Also save a copy on this computer?', send: `${DOWN}${ENTER}` },
    { expect: 'What should the Home button open?', send: `${DOWN}${ENTER}` },
    { expect: 'TV screensaver:', send: `${DOWN}${ENTER}` },
    { expect: 'Protect your device settings from system reversion?', send: `${DOWN}${ENTER}` },
    { expect: 'Nothing has been changed yet. Continue?', send: `${DOWN}${DOWN}${ENTER}` },
  ]);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /Restore the supplied settings backup/);
  assert.deepEqual(fake.readState(), before);
});

test('the global revert removes Fire TV UI while retaining its layout and reports a failed removal', async () => {
  installed();
  const succeeded = await captured(() => uninstallEverything(ip, { all: true, force: true }));
  assert.equal(succeeded.result, 'reverted', succeeded.out);
  assert.match(succeeded.out, /layout backup remains/);
  assert.equal(JSON.parse(fake.readState().files[TV_BACKUP]).apps_per_row, 7);
  fake.reset(); installed({ stuck: true });
  const failed = await captured(() => uninstallEverything(ip, { all: true, force: true }));
  assert.equal(failed.result, 'failed', failed.out);
  assert.ok(fake.readState().installed.includes(FIRE_TV_UI.pkg));
});
