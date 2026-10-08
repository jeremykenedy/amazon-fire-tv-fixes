import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { installFakeAdb, captured, AERIAL } from './helpers/fake-adb.js';
import { AMAZON_DEFAULT } from '../src/screensaver-registry.js';

let fake;
let ip;

before(() => {
  fake = installFakeAdb();
  ip = '192.168.1.49';
});

beforeEach(() => {
  fake.reset();
  process.exitCode = undefined;
});

after(() => {
  fake.restore();
  process.exitCode = undefined;
});

const alexa = () => import('../src/steps/alexa-fix.js');
const timeouts = () => import('../src/apply/timeouts.js');

test('adb helpers read and write the fake device', async () => {
  const adb = await import('../src/adb.js');
  assert.equal(await adb.isAdbInstalled(), true);
  assert.equal(await adb.isReachable(ip), true);
  assert.equal(await adb.getSetting(ip, 'secure', 'sleep_timeout'), '840000');
  await adb.putSetting(ip, 'secure', 'sleep_timeout', 60000);
  assert.equal(fake.readState().secure.sleep_timeout, '60000');
  assert.ok((await adb.listSettings(ip, 'system')).some((l) => l.startsWith('screen_off_timeout=')));
  assert.deepEqual(await adb.listPackages(ip), [AERIAL]);
  assert.equal(await adb.isPackageInstalled(ip, AERIAL), true);
  assert.equal(await adb.uninstallPackage(ip, AERIAL), true);
  assert.equal(await adb.uninstallPackage(ip, AERIAL), false);
});

test('connectAndCheck reports an unreachable TV with the reason', async () => {
  const adb = await import('../src/adb.js');
  fake.setState({ offline: true });
  const { result } = await captured(() => adb.connectAndCheck(ip));
  assert.equal(result, false);
  assert.match(adb.getLastAdbError(), /not found/);
});

test('enable and disable the Alexa fix through the step flags', async () => {
  const { enableAlexaFix, disableAlexaFix } = await alexa();
  fake.setState({ secure: { ...fake.readState().secure, 'str.auto_wake_up_enabled': '0' } });
  const on = await captured(() => enableAlexaFix(ip, { yes: true }));
  assert.equal(fake.readState().secure['str.auto_wake_up_enabled'], '1');
  assert.match(on.out, /fix/i);
  await captured(() => disableAlexaFix(ip, { yes: true, force: true }));
  assert.equal(fake.readState().secure['str.auto_wake_up_enabled'], '0');
  assert.notEqual(process.exitCode, 1);
});

test('enabling an already-enabled Alexa fix changes nothing and does not fail', async () => {
  const { enableAlexaFix } = await alexa();
  await captured(() => enableAlexaFix(ip, { yes: true }));
  assert.equal(fake.readState().secure['str.auto_wake_up_enabled'], '1');
  assert.notEqual(process.exitCode, 1);
});

test('set-screensaver switches between an installed fork and the Amazon default', async () => {
  const { setScreensaver } = await import('../src/steps/set-screensaver.js');
  await captured(() => setScreensaver(ip, { set: 'amazon' }));
  assert.match(fake.readState().secure.screensaver_components, /amazon/);
  await captured(() => setScreensaver(ip, { set: 'aerial' }));
  assert.match(fake.readState().secure.screensaver_components, /aerialviews/);
});

test('set-screensaver refuses a fork that is not installed', async () => {
  const { setScreensaver } = await import('../src/steps/set-screensaver.js');
  const { out } = await captured(() => setScreensaver(ip, { set: 'snoozy' }));
  assert.equal(process.exitCode, 1);
  assert.match(out, /not installed|install/i);
});

test('firetv-screensavers removes an installed screensaver and reports a stuck one', async () => {
  const { manageScreensavers } = await import('../src/steps/screensavers.js');
  await captured(() => manageScreensavers(ip, { uninstall: 'aerial', yes: true, force: true }));
  assert.deepEqual(fake.readState().installed, []);
  fake.setState({ installed: [AERIAL], stuck: true });
  await captured(() => manageScreensavers(ip, { uninstall: 'aerial', yes: true, force: true }));
  assert.equal(process.exitCode, 1);
  assert.deepEqual(fake.readState().installed, [AERIAL]);
});

test('timeouts: current and possible reports capture baselines in .env', async () => {
  const { currentTimeoutsReport } = await import('../src/steps/timeout-current.js');
  const { possibleTimeoutsReport } = await import('../src/steps/timeout-possible.js');
  const cur = await captured(() => currentTimeoutsReport(ip));
  assert.match(cur.out, /14 min|840000/);
  await captured(() => possibleTimeoutsReport(ip));
  const env = fs.readFileSync(fake.envFile, 'utf8');
  assert.match(env, /FIRE_TV_TIMEOUT_SLEEP_FACTORY_MS=840000/);
  assert.match(env, /FIRE_TV_TIMEOUT_SCREENSAVER_FACTORY_MS=300000/);
});

test('timeouts: set, reject an out-of-range value, then reset to the baseline', async () => {
  const { setOneTimeoutStep } = await import('../src/steps/timeout-set.js');
  const { resetTimeoutsStep } = await import('../src/steps/timeout-reset.js');
  const { findTimeoutById } = await timeouts();
  const sleep = findTimeoutById('sleep');
  const screensaver = findTimeoutById('screensaver');

  await captured(() => setOneTimeoutStep(ip, sleep, { minutes: '5' }));
  assert.equal(fake.readState().secure.sleep_timeout, '300000');

  fake.setState({ rejectOverMax: true });
  const bad = await captured(() => setOneTimeoutStep(ip, screensaver, { ms: '99999999999' }));
  assert.equal(process.exitCode, 1);
  assert.match(bad.out, /did not accept/);
  process.exitCode = undefined;

  await captured(() => resetTimeoutsStep(ip, { all: true, yes: true }));
  assert.equal(fake.readState().secure.sleep_timeout, '840000');
  assert.notEqual(process.exitCode, 1);
});

test('timeouts: reset rejects bad flag combinations', async () => {
  const { resetTimeoutsStep } = await import('../src/steps/timeout-reset.js');
  const { currentTimeoutsReport } = await import('../src/steps/timeout-current.js');
  await captured(() => currentTimeoutsReport(ip));
  await captured(() => resetTimeoutsStep(ip, { all: true, only: 'sleep' }));
  assert.equal(process.exitCode, 1);
  process.exitCode = undefined;
  await captured(() => resetTimeoutsStep(ip, { yes: true }));
  assert.equal(process.exitCode, 1);
  process.exitCode = undefined;
  await captured(() => resetTimeoutsStep(ip, { only: 'sleep', yes: true }));
  assert.notEqual(process.exitCode, 1);
});

test('uninstall --all reverts the fix, screensaver and installed apps together', async () => {
  const { uninstallEverything } = await import('../src/steps/uninstall.js');
  const { currentTimeoutsReport } = await import('../src/steps/timeout-current.js');
  await captured(() => currentTimeoutsReport(ip));
  fake.setState({ system: { screen_off_timeout: '900000' } });
  const { result } = await captured(() => uninstallEverything(ip, { all: true, force: true }));
  assert.equal(result, 'reverted');
  const s = fake.readState();
  assert.equal(s.secure['str.auto_wake_up_enabled'], '0');
  assert.match(s.secure.screensaver_components, /amazon/);
  assert.equal(s.system.screen_off_timeout, '300000');
  assert.deepEqual(s.installed, []);
});

test('uninstall reports failure when a package cannot be removed', async () => {
  const { uninstallEverything } = await import('../src/steps/uninstall.js');
  fake.setState({ stuck: true });
  const { result } = await captured(() => uninstallEverything(ip, { all: true, force: true }));
  assert.equal(result, 'failed');
  assert.equal(process.exitCode, 1);
});

test('uninstall says nothing to undo on a factory-state TV, and refuses --yes alone', async () => {
  const { uninstallEverything } = await import('../src/steps/uninstall.js');
  fake.setState({
    secure: { 'str.auto_wake_up_enabled': '0', sleep_timeout: '840000', screensaver_components: AMAZON_DEFAULT.dreamComponent },
    installed: [],
  });
  const nothing = await captured(() => uninstallEverything(ip, {}));
  assert.equal(nothing.result, 'nothing');
  fake.setState({ installed: [AERIAL] });
  const yes = await captured(() => uninstallEverything(ip, { yes: true }));
  assert.equal(yes.result, 'failed');
});

test('.env helpers save the IP and installed flag to the throwaway file', async () => {
  const dc = await import('../src/device-config.js');
  assert.equal(dc.isInstalled(), false);
  dc.saveIp(ip);
  dc.setInstalled(true);
  assert.equal(dc.getSavedIp(), ip);
  assert.equal(dc.isInstalled(), true);
  assert.match(fs.readFileSync(fake.envFile, 'utf8'), /INSTALLED=true/);
});

test('unreadable .env gives a specific error, not "not installed"', async () => {
  const dc = await import('../src/device-config.js');
  fs.mkdirSync(fake.envFile);
  assert.throws(() => dc.readEnvFile(), /Could not read/);
  fs.rmdirSync(fake.envFile);
});

test('app teardown wipes .env to its template', async () => {
  const dc = await import('../src/device-config.js');
  const td = await import('../src/app-teardown.js');
  dc.saveIp(ip);
  td.wipeEnvToTemplate();
  assert.equal(dc.getSavedIp(), null);
  assert.equal(td.repoParentDir(), path.dirname(td.PROJECT_ROOT));
});

test('local screensaver clones are detected and removed', async () => {
  const sv = await import('../src/apply/screensavers.js');
  assert.equal(sv.hasLocalClones(), false);
  fs.mkdirSync(`${sv.getScreensaversDir()}/aerial`, { recursive: true });
  assert.equal(sv.hasLocalClones(), true);
  const un = await import('../src/apply/uninstall.js');
  un.removeLocalClones();
  assert.equal(sv.hasLocalClones(), false);
});
