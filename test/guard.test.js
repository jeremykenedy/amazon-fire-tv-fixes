import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { installFakeAdb, captured, AERIAL } from './helpers/fake-adb.js';
import { drive, DOWN, ENTER } from './helpers/drive.js';
import { launcherFetch } from './helpers/launcher-fakes.js';
import { parseGuardEnv, mergeGuardEnv, guardState, isGuardedNow } from '../src/guard-config.js';
import { versionAtLeast, parseCheck, turnGuardOn, checkGuard, turnGuardOff, UPDATERS, BACKGROUND_BLOCKED } from '../src/apply/guard.js';
import { manageGuard, guardIfWanted } from '../src/steps/guard.js';
import { uninstallEverything } from '../src/steps/uninstall.js';
import { HOME_REDIRECT } from '../src/launcher-registry.js';

const IP = '192.168.1.49';
const [EASY, FORCED] = UPDATERS;
const [OTA, OVERRIDE] = BACKGROUND_BLOCKED;
let fake;
let realFetch;

// A TV like the one this was built on: Home Redirect 1.2.0, forcedotaupdater
// already disabled, and the main updater protected from being disabled.
const TV = {
  installed: [AERIAL, HOME_REDIRECT.pkg, EASY, FORCED, OTA, OVERRIDE],
  versions: { [HOME_REDIRECT.pkg]: '1.2.0' },
  disabled: [FORCED],
  protectedPkgs: [OTA, OVERRIDE],
};

before(() => {
  fake = installFakeAdb();
  realFetch = globalThis.fetch;
  globalThis.fetch = launcherFetch();
});
beforeEach(() => {
  fake.reset();
  fake.setState(TV);
  fs.writeFileSync(fake.envFile, `FIRE_TV_IP=${IP}\nINSTALLED=true\n`);
  process.exitCode = undefined;
});
after(() => {
  globalThis.fetch = realFetch;
  fake.restore();
  process.exitCode = undefined;
});

test('the native helper leaves Fire TV UI choices alone while protecting its other settings', () => {
  const dir = path.join(fake.dir, 'native-guard');
  fs.mkdirSync(dir);
  const source = path.join(dir, 'GuardTest.java');
  fs.writeFileSync(source, `package com.jeremykenedy.firetv.homeredirect;
import java.util.*;
public final class GuardTest {
  public static void main(String[] args) {
    Map<String,String> locked = new HashMap<>();
    locked.put("secure/screensaver_components", "old/.Dream");
    locked.put("secure/sleep_timeout", "840000");
    locked.put("secure/enabled_accessibility_services", "old/Service");
    locked.put("secure/screensaver_default_component", "old/.Default");
    locked.put("secure/amazon_ambient_enabled", "0");
    Map<String,String> current = new HashMap<>();
    for (String key : locked.keySet()) current.put(key, "changed");
    List<String> nativeOwned = Guard.drift(locked, current, true);
    if (!nativeOwned.equals(Arrays.asList("secure/screensaver_default_component", "secure/amazon_ambient_enabled")))
      throw new AssertionError(nativeOwned);
    if (Guard.drift(locked, current, false).size() != 5)
      throw new AssertionError("Classic guard stopped protecting its settings");
  }
}`);
  const guard = new URL('../android/home-redirect/src/com/jeremykenedy/firetv/homeredirect/Guard.java', import.meta.url);
  execFileSync('javac', ['-d', dir, source, guard.pathname]);
  execFileSync('java', ['-cp', dir, 'com.jeremykenedy.firetv.homeredirect.GuardTest']);
});

test('the native helper keeps ADB debugging on and never touches wireless debugging', () => {
  const dir = path.join(fake.dir, 'native-adb');
  fs.mkdirSync(dir);
  const source = path.join(dir, 'AdbTest.java');
  fs.writeFileSync(source, `package com.jeremykenedy.firetv.homeredirect;
import java.util.*;
public final class AdbTest {
  public static void main(String[] args) {
    Map<String,String> tv = new HashMap<>();
    tv.put("adb_enabled", "0");
    tv.put("adb_wifi_enabled", "0");
    if (!Guard.adbOff(tv).equals(Arrays.asList("adb_enabled")))
      throw new AssertionError("Only ADB debugging comes back on, never wireless debugging: " + Guard.adbOff(tv));
    tv.put("adb_enabled", "1");
    if (!Guard.adbOff(tv).isEmpty())
      throw new AssertionError("ADB debugging that is on is left alone");
    tv.put("adb_enabled", Guard.ABSENT);
    if (!Guard.adbOff(tv).isEmpty())
      throw new AssertionError("A missing switch is not an off switch");
  }
}`);
  const guard = new URL('../android/home-redirect/src/com/jeremykenedy/firetv/homeredirect/Guard.java', import.meta.url);
  execFileSync('javac', ['-d', dir, source, guard.pathname]);
  execFileSync('java', ['-cp', dir, 'com.jeremykenedy.firetv.homeredirect.AdbTest']);
});

test('the native helper opens AT4K unless told to open LTvLauncher', () => {
  const dir = path.join(fake.dir, 'native-home');
  fs.mkdirSync(dir);
  const source = path.join(dir, 'HomeTest.java');
  fs.writeFileSync(source, `package com.jeremykenedy.firetv.homeredirect;
public final class HomeTest {
  public static void main(String[] args) {
    if (!HomeTarget.packageFor("ltv").equals("com.leanbitlab.ltvL"))
      throw new AssertionError("ltv must open LTvLauncher");
    for (String other : new String[] {"at4k", null, "", "launcher"}) {
      if (!HomeTarget.packageFor(other).equals("com.overdevs.at4k"))
        throw new AssertionError("anything else must keep opening AT4K: " + other);
    }
    if (!HomeTarget.isKnown("at4k") || !HomeTarget.isKnown("ltv") || HomeTarget.isKnown("amazon") || HomeTarget.isKnown(null))
      throw new AssertionError("only AT4K and LTvLauncher are Home targets");
    if (!HomeTarget.DEFAULT.equals("at4k"))
      throw new AssertionError("AT4K stays the default");
  }
}`);
  const target = new URL('../android/home-redirect/src/com/jeremykenedy/firetv/homeredirect/HomeTarget.java', import.meta.url);
  execFileSync('javac', ['-d', dir, source, target.pathname]);
  execFileSync('java', ['-cp', dir, 'com.jeremykenedy.firetv.homeredirect.HomeTest']);
});

test('the guard state round-trips through .env and is removed when off', () => {
  const state = { on: true, disabled: [EASY], background: { [OTA]: 'default' }, unlocked: ['screensaver'] };
  const raw = mergeGuardEnv('FIRE_TV_IP=1.2.3.4\n', state);
  assert.deepEqual(parseGuardEnv(raw), state);
  assert.deepEqual(parseGuardEnv(mergeGuardEnv(null, state)), state);
  assert.equal(mergeGuardEnv(raw, { on: false, disabled: [], background: {} }), 'FIRE_TV_IP=1.2.3.4\n');
  assert.deepEqual(parseGuardEnv(null), { on: false, disabled: [], background: {}, unlocked: [] });
});

test('versionAtLeast and parseCheck read versions and guard replies', () => {
  assert.ok(versionAtLeast('1.10.0', '1.2.0'));
  assert.ok(versionAtLeast('1.2', '1.2.0'));
  assert.ok(!versionAtLeast('1.1.1', '1.2.0'));
  assert.ok(!versionAtLeast(null, '1.2.0'));
  assert.deepEqual(parseCheck('guard=on restored=none'), []);
  assert.deepEqual(parseCheck('guard=on restored=secure/a,system/b'), ['secure/a', 'system/b']);
  assert.equal(parseCheck(null), null);
  assert.equal(parseCheck('locked'), null);
});

test('turning the guard on locks the TV, disables the updaters it can, and holds back the main one', async () => {
  const { result } = await captured(() => turnGuardOn(IP));
  assert.ok(result.every((r) => r.ok), JSON.stringify(result));
  const s = fake.readState();
  assert.equal(s.guard.locked, true);
  assert.deepEqual(s.disabled.sort(), [EASY, FORCED].sort());
  assert.equal(s.appops[OTA].RUN_ANY_IN_BACKGROUND, 'ignore');
  assert.equal(s.appops[OVERRIDE].RUN_ANY_IN_BACKGROUND, 'ignore');
  assert.deepEqual(s.grants[HOME_REDIRECT.pkg], ['android.permission.WRITE_SECURE_SETTINGS']);
  assert.deepEqual(guardState(), { on: true, disabled: [EASY], background: { [OTA]: 'default', [OVERRIDE]: 'default' }, unlocked: [] });
});

test('with the guard on, the toolkit tells it about guarded settings before changing them', async () => {
  await captured(() => turnGuardOn(IP));
  const adb = await import('../src/adb.js');
  await adb.putSetting(IP, 'secure', 'screensaver_components', 'x/.Y');
  await adb.deleteSetting(IP, 'secure', 'sleep_timeout');
  await adb.putSetting(IP, 'secure', 'some_other_setting', '1');
  assert.deepEqual(fake.readState().guard.remembered, { 'secure/screensaver_components': 'x/.Y', 'secure/sleep_timeout': 'null' });
  assert.ok(isGuardedNow('system', 'screen_off_timeout'));
  assert.ok(!isGuardedNow('secure', 'some_other_setting'));
});

test('an old Home Redirect is updated first, and a failed update stops there', async () => {
  fake.setState({ versions: { [HOME_REDIRECT.pkg]: '1.1.1' } });
  const ok = await captured(() => turnGuardOn(IP));
  assert.match(ok.result[0].label, /Installed Home Redirect/);
  assert.ok(ok.result.every((r) => r.ok));

  fake.reset();
  fake.setState({ ...TV, installed: [AERIAL], installFail: 'Failure [INSTALL_FAILED_INSUFFICIENT_STORAGE]' });
  const failed = await captured(() => turnGuardOn(IP));
  assert.equal(failed.result.length, 1);
  assert.equal(failed.result[0].ok, false);
  assert.equal(guardState().on, false);
});

test('a guard check puts updaters back off and reports what the TV put back', async () => {
  await captured(() => turnGuardOn(IP));
  fake.setState({ disabled: [FORCED], appops: {}, guardRestored: 'secure/screensaver_components' });
  const { result } = await captured(() => checkGuard(IP));
  assert.deepEqual(result.restored, ['secure/screensaver_components']);
  assert.deepEqual(result.results.map((r) => r.ok), [true, true, true]);
  assert.ok(fake.readState().disabled.includes(EASY));
  assert.deepEqual(guardState().background, { [OTA]: 'default', [OVERRIDE]: 'default' });
});

test('an updater Fire OS will not disable is reported, not hidden', async () => {
  fake.setState({ protectedPkgs: [EASY, OTA, OVERRIDE] });
  const { result } = await captured(() => turnGuardOn(IP));
  const easy = result.find((r) => r.label.includes(EASY));
  assert.equal(easy.ok, false);
  assert.match(easy.detail, /Cannot disable a protected package/);
  assert.deepEqual(guardState().disabled, []);
});

test('turning the guard off unlocks the TV and undoes only what the guard did', async () => {
  await captured(() => turnGuardOn(IP));
  const { result } = await captured(() => turnGuardOff(IP));
  assert.ok(result.every((r) => r.ok), JSON.stringify(result));
  const s = fake.readState();
  assert.equal(s.guard.locked, false);
  assert.deepEqual(s.disabled, [FORCED]);
  assert.equal(s.appops[OTA].RUN_ANY_IN_BACKGROUND, undefined);
  assert.deepEqual(guardState(), { on: false, disabled: [], background: {}, unlocked: [] });
  assert.doesNotMatch(fs.readFileSync(fake.envFile, 'utf8'), /FIRE_TV_GUARD/);
});

test('turning the guard off keeps its record when something did not go back, and passes when Home Redirect is gone', async () => {
  await captured(() => turnGuardOn(IP));
  fake.setState({ lockedKeys: ['RUN_ANY_IN_BACKGROUND'] });
  const stuck = await captured(() => turnGuardOff(IP));
  assert.ok(stuck.result.some((r) => !r.ok));
  assert.equal(guardState().on, true);

  fake.setState({ lockedKeys: [], installed: TV.installed.filter((p) => p !== HOME_REDIRECT.pkg) });
  const gone = await captured(() => turnGuardOff(IP));
  assert.ok(gone.result.every((r) => r.ok), JSON.stringify(gone.result));
});

test('guard --yes, --check and --off report each step', async () => {
  const on = await captured(() => manageGuard(IP, { yes: true }));
  assert.match(on.out, /The guard is on/);
  assert.match(on.out, /Run guard --check after one/);

  const clean = await captured(() => manageGuard(IP, { check: true }));
  assert.match(clean.out, /Nothing changed/);
  fake.setState({ guardRestored: 'system/screen_off_timeout' });
  const fixed = await captured(() => manageGuard(IP, { check: true }));
  assert.match(fixed.out, /Put back system\/screen_off_timeout/);
  fake.setState({ guardReply: 'junk' });
  const silent = await captured(() => manageGuard(IP, { check: true }));
  assert.match(silent.out, /Home Redirect did not answer/);
  assert.equal(process.exitCode, 1);
  process.exitCode = undefined;

  fake.setState({ guardReply: undefined });
  const off = await captured(() => manageGuard(IP, { off: true, yes: true }));
  assert.match(off.out, /The guard is off/);
  const offCheck = await captured(() => manageGuard(IP, { check: true }));
  assert.match(offCheck.out, /The guard is off\. Run guard to turn it on/);
});

test('a failed step marks the run failed', async () => {
  fake.setState({ protectedPkgs: [EASY, OTA, OVERRIDE] });
  const r = await captured(() => manageGuard(IP, { yes: true }));
  assert.match(r.out, /✖ Disabled com\.amazon\.tv\.easyupgrade: .*protected/);
  assert.doesNotMatch(r.out, /The guard is on/);
  assert.equal(process.exitCode, 1);
});

test('guard asks first, and start skips the question once the guard is on', async () => {
  const r = await drive('bin/guard.js', [], [{ expect: 'Nothing has been changed yet. Continue?', send: ENTER }]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Lock the screensaver, Alexa fix, Home and timeout settings/);
  assert.equal(fake.readState().guard.locked, true);

  const off = await drive('bin/firetv-guard.js', ['--off'], [{ expect: 'Nothing has been changed yet. Continue?', send: `${DOWN}${DOWN}${ENTER}` }]);
  assert.match(off.out, /Turn the guard off/);
  assert.match(off.out, /Cancelled\. Nothing was changed/);
  assert.equal(fake.readState().guard.locked, true);

  const skipped = await captured(() => guardIfWanted(IP));
  assert.equal(skipped.out, '');
});

test('start offers the guard, and firetv-revert turns it off before anything else', async () => {
  fs.writeFileSync(fake.envFile, '');
  const r = await drive('bin/start.js', [], [
    { expect: 'Developer Mode and ADB debugging?', send: 'y' },
    { expect: 'IP address', send: `${IP}${ENTER}` },
    { expect: 'review or adjust TV timeout', send: 'n' },
    { expect: 'optimize the TV for screensavers', send: 'n' },
    { expect: 'guard these settings', send: 'y' },
    { expect: 'Nothing has been changed yet. Continue?', send: ENTER },
    { expect: 'What would you like to do?', send: `${DOWN.repeat(7)}${ENTER}` },
  ]);
  assert.equal(r.code, 0, r.out);
  assert.equal(fake.readState().guard.locked, true);

  const { result, out } = await captured(() => uninstallEverything(IP, { all: true, force: true }));
  assert.equal(result, 'reverted', out);
  assert.ok(out.indexOf('Guard turned off') < out.indexOf('Alexa deep-sleep fix reverted'), out);
  assert.equal(fake.readState().guard.locked, false);
});

test('firetv-revert reports a guard that would not turn off', async () => {
  await captured(() => turnGuardOn(IP));
  fake.setState({ lockedKeys: ['RUN_ANY_IN_BACKGROUND'] });
  const { result, out } = await captured(() => uninstallEverything(IP, { all: true, force: true }));
  assert.equal(result, 'failed');
  assert.match(out, /The guard could not be fully turned off/);
});

test('guard --unlock=screensaver frees the screensaver, keeps it free on a re-lock, and --lock guards it again', async () => {
  const off = await captured(() => manageGuard(IP, { unlock: 'screensaver' }));
  assert.match(off.out, /The guard is off, so nothing is locked/);

  await captured(() => turnGuardOn(IP));
  const unlocked = await captured(() => manageGuard(IP, { unlock: 'screensaver' }));
  assert.match(unlocked.out, /✔ Left the screensaver unlocked/);
  assert.match(unlocked.out, /The screensaver is unlocked/);
  assert.deepEqual(fake.readState().guard.forgotten, ['secure/screensaver_components', 'secure/screensaver_default_component']);
  assert.deepEqual(guardState().unlocked, ['screensaver']);
  await captured(() => manageGuard(IP, { unlock: 'screensaver' }));
  assert.deepEqual(guardState().unlocked, ['screensaver']);

  await captured(() => turnGuardOn(IP));
  assert.equal(fake.readState().guard.forgotten.length, 2, 'a re-lock leaves the screensaver unlocked');

  const locked = await captured(() => manageGuard(IP, { lock: 'screensaver' }));
  assert.match(locked.out, /The screensaver is locked again/);
  assert.deepEqual(fake.readState().guard.forgotten, []);
  assert.deepEqual(guardState().unlocked, []);
});

test('an unlock the TV does not confirm is reported and not saved', async () => {
  await captured(() => turnGuardOn(IP));
  fake.setState({ forgetReply: 'unknown' });
  const r = await captured(() => manageGuard(IP, { unlock: 'screensaver' }));
  assert.match(r.out, /✖ Left the screensaver unlocked/);
  assert.deepEqual(guardState().unlocked, []);
  assert.equal(process.exitCode, 1);
});
