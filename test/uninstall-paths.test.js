import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installFakeAdb, captured, AERIAL } from './helpers/fake-adb.js';
import { drive, ENTER } from './helpers/drive.js';
import { fakeBinDir, fakeCheckout } from './helpers/setup-fakes.js';
import { AT4K, HOME_REDIRECT } from '../src/launcher-registry.js';
import { AMAZON_DEFAULT } from '../src/screensaver-registry.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const IP = '192.168.1.49';
let fake;

before(() => {
  fake = installFakeAdb();
});
beforeEach(() => {
  fake.reset();
  process.exitCode = undefined;
});
after(() => {
  fake.restore();
  process.exitCode = undefined;
});

const uninstall = () => import('../src/steps/uninstall.js');

function at4kHome(extra = {}) {
  const s = fake.readState();
  fake.setState({
    installed: [...s.installed, AT4K.pkg, HOME_REDIRECT.pkg],
    secure: { ...s.secure, enabled_accessibility_services: `${AT4K.service}:${HOME_REDIRECT.service}` },
    ...extra,
  });
}

test('buildLauncherRevertOptions offers the Home revert and each installed launcher app', async () => {
  const { buildLauncherRevertOptions } = await uninstall();
  assert.deepEqual(buildLauncherRevertOptions({ home: 'amazon', installed: [] }), []);
  const options = buildLauncherRevertOptions({ home: 'at4k', installed: ['at4k', 'home-redirect'] });
  assert.deepEqual(options.map((o) => o.value), ['home', 'launcher:at4k', 'launcher:home-redirect']);
  const ltv = buildLauncherRevertOptions({ home: 'ltv', installed: ['at4k', 'ltv', 'home-redirect'] });
  assert.deepEqual(ltv.map((o) => o.value), ['home', 'launcher:at4k', 'launcher:ltv', 'launcher:home-redirect']);
  assert.deepEqual(ltv.filter((o) => o.keep).map((o) => o.value), ['launcher:at4k', 'launcher:ltv']);
  assert.match(ltv[1].name, /AT4K Launcher and its home screen settings/);
});

test('uninstall --all sends Home back, removes the launcher apps and the local clones', async () => {
  const { uninstallEverything } = await uninstall();
  const { getScreensaversDir } = await import('../src/apply/screensavers.js');
  at4kHome();
  fs.mkdirSync(path.join(getScreensaversDir(), 'aerial'), { recursive: true });
  const { result, out } = await captured(() => uninstallEverything(IP, { all: true, force: true }));
  assert.equal(result, 'reverted', out);
  const s = fake.readState();
  assert.ok(s.installed.includes(AT4K.pkg), 'AT4K and its home screen settings stay unless picked by hand');
  assert.ok(!s.installed.includes(HOME_REDIRECT.pkg));
  assert.equal(s.secure.enabled_accessibility_services, AT4K.service);
  assert.equal(fs.existsSync(getScreensaversDir()), false);
  assert.match(out, /Home button sent back to the Amazon menu/);
  assert.match(out, /Local screensaver source removed/);
});

test('uninstall --all reports each revert the TV did not take', async () => {
  const { uninstallEverything } = await uninstall();
  const { currentTimeoutsReport } = await import('../src/steps/timeout-current.js');
  await captured(() => currentTimeoutsReport(IP));
  at4kHome({ stuck: true, lockedKeys: ['str.auto_wake_up_enabled', 'screensaver_components', 'enabled_accessibility_services', 'sleep_timeout'] });
  fake.setState({ secure: { ...fake.readState().secure, sleep_timeout: '60000' } });
  const { result, out } = await captured(() => uninstallEverything(IP, { all: true, force: true }));
  assert.equal(result, 'failed');
  assert.equal(process.exitCode, 1);
  for (const message of [
    /Alexa deep-sleep fix is still on/,
    /did not switch back to the Amazon default/,
    /Home button did not switch back/,
    /Home Redirect and Screensaver Picker could not be removed/,
    /did not accept the reset/,
  ]) {
    assert.match(out, message);
  }
});

test('uninstall --all without --force stops at the guardrail in a script', async () => {
  const { uninstallEverything } = await uninstall();
  const { result } = await captured(() => uninstallEverything(IP, { all: true }));
  assert.equal(result, 'cancelled');
  assert.equal(fake.readState().secure['str.auto_wake_up_enabled'], '1');
});

test('the interactive revert does nothing when every item is unchecked, or when "yes" is not typed', async () => {
  fs.writeFileSync(fake.envFile, `FIRE_TV_IP=${IP}\nINSTALLED=true\n`);
  const unchecked = await drive('bin/firetv-revert.js', [], [{ expect: 'What should be reverted?', send: `i${ENTER}` }]);
  assert.match(unchecked.out, /Nothing selected/, unchecked.out);
  const refused = await drive('bin/firetv-revert.js', [], [
    { expect: 'What should be reverted?', send: ENTER },
    { expect: 'Nothing has been changed yet. Continue?', send: ENTER },
    { expect: 'Type "yes"', send: `no${ENTER}` },
  ]);
  assert.equal(fake.readState().secure['str.auto_wake_up_enabled'], '1', refused.out);
  assert.deepEqual(fake.readState().installed, [AERIAL]);
});

test('uninstall asks before wiping when adb is missing or the TV is unreachable', async () => {
  fs.writeFileSync(fake.envFile, `FIRE_TV_IP=${IP}\nINSTALLED=true\n`);
  const noAdb = await drive('bin/uninstall.js', [], [{ expect: /Continue anyway\?/, send: 'n' }], { noAdb: true });
  assert.match(noAdb.out, /adb is not installed/);
  assert.match(noAdb.out, /No changes were made to this computer/);

  fake.setState({ offline: true });
  const offline = await drive('bin/uninstall.js', [], [{ expect: /Continue anyway\?/, send: 'n' }]);
  assert.match(offline.out, /Could not reach the TV/);
  assert.match(fs.readFileSync(fake.envFile, 'utf8'), /INSTALLED=true/);
});

test('uninstall unlinks with npm, wipes .env, and can hand off to the repo delete (cancelled here)', async () => {
  fs.writeFileSync(fake.envFile, `FIRE_TV_IP=${IP}\nINSTALLED=true\n`);
  fake.setState({
    secure: { 'str.auto_wake_up_enabled': '0', sleep_timeout: '840000', screensaver_components: AMAZON_DEFAULT.dreamComponent },
    installed: [],
  });
  const checkout = fakeCheckout();
  const preload = path.join(ROOT, 'test', 'helpers', 'setup-root-preload.js');
  const PATH = `${path.dirname(process.env.FAKE_ADB_STATE)}${path.delimiter}${fakeBinDir({ npm: { uninstall: 0 } })}`;
  const r = await drive('bin/uninstall.js', [], [
    { expect: /remove the repo code from your machine\? \[y\/N\]/, send: 'y' },
    { expect: 'Type "confirm"', send: `nope${ENTER}` },
  ], { env: { PATH, NODE_OPTIONS: `--import=${preload}`, FIRE_TV_TEST_PROJECT_ROOT: checkout } });
  assert.match(r.out, /Commands unlinked from your PATH/);
  assert.match(r.out, /successfully uninstalled/);
  assert.match(r.out, /Cancelled\. Nothing was deleted/);
  assert.ok(fs.existsSync(checkout));
  assert.ok(fs.existsSync(path.join(ROOT, 'package.json')));
  assert.doesNotMatch(fs.readFileSync(fake.envFile, 'utf8'), /INSTALLED=true/);
});
