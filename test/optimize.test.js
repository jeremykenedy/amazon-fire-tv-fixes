import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { installFakeAdb, captured, AERIAL } from './helpers/fake-adb.js';
import { drive, DOWN, ENTER, SPACE } from './helpers/drive.js';
import {
  planOptimizations,
  displayValue,
  screensaverTimeoutBefore,
  parseOriginals,
  mergeOriginal,
  dropOriginal,
  readOptimizeState,
  applyOptimizations,
  revertOptimizations,
} from '../src/apply/optimize.js';
import { optimizeForScreensavers } from '../src/steps/optimize.js';
import { uninstallEverything } from '../src/steps/uninstall.js';
import { SCREENSAVERS, BUILT_IN_SCREENSAVERS, AMAZON_DEFAULT } from '../src/screensaver-registry.js';

const IP = '192.168.1.49';
const AERIAL_ENTRY = SCREENSAVERS.find((s) => s.id === 'aerial');
const SNOOZY = SCREENSAVERS.find((s) => s.id === 'snoozy');
const COLORS = BUILT_IN_SCREENSAVERS.find((s) => s.id === 'colors');
let fake;

// A Fire OS 8.1 TV straight from the factory, with Aerial Views installed.
const FACTORY = {
  secure: {
    'str.auto_wake_up_enabled': '0',
    sleep_timeout: '300000',
    screensaver_enabled: '0',
    screensaver_activate_on_sleep: '0',
    screensaver_activate_on_dock: '1',
    screensaver_components: AMAZON_DEFAULT.dreamComponent,
    screensaver_default_component: AMAZON_DEFAULT.dreamComponent,
    amazon_ambient_enabled: '1',
  },
  system: { screen_off_timeout: '600000' },
  installed: [AERIAL],
};

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

function settings(overrides = {}) {
  return {
    'screensaver-enabled': '1',
    'activate-on-sleep': '1',
    'activate-on-dock': '1',
    'timeout-order': '300000',
    'alexa-fix': '1',
    active: AERIAL_ENTRY.dreamComponent,
    'default-component': AERIAL_ENTRY.dreamComponent,
    'ambient-off': null,
    sleep: '840000',
    ...overrides,
  };
}

test('screensaverTimeoutBefore keeps five minutes when sleep is longer, else half of sleep', () => {
  assert.equal(screensaverTimeoutBefore(840000), 300000);
  assert.equal(screensaverTimeoutBefore(300000), 150000);
  assert.equal(screensaverTimeoutBefore(60000), 30000);
});

test('planOptimizations has nothing to do on a TV that is already set up', () => {
  assert.deepEqual(planOptimizations({ settings: settings(), installed: [AERIAL], aerialOverlay: 'allow' }), []);
});

test('planOptimizations skips every setting the TV does not have', () => {
  const none = settings({ 'screensaver-enabled': null, 'activate-on-sleep': null, 'activate-on-dock': null, 'timeout-order': null, 'alexa-fix': null, 'default-component': null });
  assert.deepEqual(planOptimizations({ settings: none, installed: [AERIAL], aerialOverlay: 'allow' }), []);
});

test('planOptimizations fixes each wrong setting, and only those', () => {
  const plan = planOptimizations({
    settings: settings({ 'screensaver-enabled': '0', 'timeout-order': '900000', 'alexa-fix': '0', active: AMAZON_DEFAULT.dreamComponent, 'default-component': AMAZON_DEFAULT.dreamComponent, 'ambient-off': '1' }),
    installed: [AERIAL],
    aerialOverlay: 'default',
  });
  assert.deepEqual(
    plan.map((c) => [c.id, c.from, c.to]),
    [
      ['screensaver-enabled', '0', '1'],
      ['timeout-order', '900000', '300000'],
      ['alexa-fix', '0', '1'],
      ['active', AMAZON_DEFAULT.dreamComponent, AERIAL_ENTRY.dreamComponent],
      ['default-component', AMAZON_DEFAULT.dreamComponent, AERIAL_ENTRY.dreamComponent],
      ['ambient-off', '1', '0'],
      ['aerial-overlay', 'default', 'allow'],
    ]
  );
});

test('planOptimizations leaves an installed ad-free screensaver active, and never sleep set to never', () => {
  const plan = planOptimizations({
    settings: settings({ active: COLORS.dreamComponent, 'default-component': AMAZON_DEFAULT.dreamComponent, sleep: '0', 'timeout-order': '600000' }),
    installed: [AERIAL, COLORS.pkg],
    aerialOverlay: 'allow',
  });
  assert.deepEqual(plan.map((c) => [c.id, c.to]), [['default-component', COLORS.dreamComponent]]);
});

test('planOptimizations does not pick Aerial Views when it is not installed', () => {
  const plan = planOptimizations({
    settings: settings({ active: AMAZON_DEFAULT.dreamComponent, 'default-component': AMAZON_DEFAULT.dreamComponent }),
    installed: [SNOOZY.pkg],
    aerialOverlay: null,
  });
  assert.deepEqual(plan, []);
});

test('planOptimizations sets Aerial Views when no screensaver is set at all', () => {
  const plan = planOptimizations({ settings: settings({ active: null, 'default-component': null }), installed: [AERIAL], aerialOverlay: 'allow' });
  assert.deepEqual(plan.map((c) => [c.id, c.from, c.to]), [['active', null, AERIAL_ENTRY.dreamComponent]]);
});

test('planOptimizations treats the long form of a component as the same screensaver', () => {
  const longSnoozy = 'com.overdevs.snoozy/com.overdevs.snoozy.SnoozyDreamService';
  const plan = planOptimizations({
    settings: settings({ active: longSnoozy, 'default-component': AMAZON_DEFAULT.dreamComponent }),
    installed: [AERIAL, SNOOZY.pkg],
    aerialOverlay: 'allow',
  });
  assert.deepEqual(plan.map((c) => [c.id, c.to]), [['default-component', longSnoozy]]);
  const settled = planOptimizations({ settings: settings({ active: longSnoozy, 'default-component': SNOOZY.dreamComponent }), installed: [AERIAL, SNOOZY.pkg], aerialOverlay: 'allow' });
  assert.deepEqual(settled, []);
});

test('readOptimizeState does not ask about the overlay when Aerial Views is not installed', async () => {
  fake.setState({ installed: [SNOOZY.pkg] });
  const { result } = await captured(() => readOptimizeState(IP));
  assert.equal(result.aerialOverlay, null);
  assert.equal(result.settings['screensaver-enabled'], null);
});

test('displayValue shows each value the way a person reads it', () => {
  assert.equal(displayValue('screensaver-enabled', '1'), 'on');
  assert.equal(displayValue('ambient-off', '0'), 'off');
  assert.equal(displayValue('timeout-order', '300000'), '5 min');
  assert.equal(displayValue('active', AMAZON_DEFAULT.dreamComponent), 'Amazon with Ads');
  assert.equal(displayValue('default-component', 'x.y/.Z'), 'x.y/.Z');
  assert.equal(displayValue('aerial-overlay', 'default'), 'not allowed');
  assert.equal(displayValue('aerial-overlay', 'allow'), 'allowed');
  assert.equal(displayValue('active', null), 'not set');
});

test('the saved originals keep the first value and can be dropped one at a time', () => {
  let raw = mergeOriginal(null, 'alexa-fix', '0');
  raw = mergeOriginal(raw, 'alexa-fix', '1');
  raw = mergeOriginal(raw, 'ambient-off', null);
  assert.deepEqual(parseOriginals(raw), { 'alexa-fix': '0', 'ambient-off': 'null' });
  assert.equal(mergeOriginal('FIRE_TV_IP=1.2.3.4', 'active', 'x'), 'FIRE_TV_IP=1.2.3.4\nFIRE_TV_OPTIMIZE_ACTIVE=x\n');
  assert.deepEqual(parseOriginals(dropOriginal(raw, 'alexa-fix')), { 'ambient-off': 'null' });
  assert.deepEqual(parseOriginals(null), {});
  assert.equal(dropOriginal(null, 'active'), '');
});

test('optimize --yes fixes a factory TV, and firetv-revert puts every setting back', async () => {
  fake.setState(FACTORY);
  const r = await captured(() => optimizeForScreensavers(IP, { yes: true }));
  assert.match(r.out, /Restart the TV once/, r.out);
  assert.match(r.out, /Done\. The TV is set up for screensavers/);
  const s = fake.readState();
  assert.deepEqual(
    [s.secure.screensaver_enabled, s.secure.screensaver_activate_on_sleep, s.secure['str.auto_wake_up_enabled'], s.secure.amazon_ambient_enabled, s.system.screen_off_timeout],
    ['1', '1', '1', '0', '150000']
  );
  assert.equal(s.secure.screensaver_components, AERIAL_ENTRY.dreamComponent);
  assert.equal(s.secure.screensaver_default_component, AERIAL_ENTRY.dreamComponent);
  assert.equal(s.appops[AERIAL].SYSTEM_ALERT_WINDOW, 'allow');
  const env = fs.readFileSync(fake.envFile, 'utf8');
  assert.match(env, /FIRE_TV_OPTIMIZE_ALEXA_FIX=0/);
  assert.match(env, /FIRE_TV_TIMEOUT_SCREENSAVER_FACTORY_MS=600000/);

  const again = await captured(() => optimizeForScreensavers(IP, { yes: true }));
  assert.match(again.out, /already set up for screensavers/);

  const revert = await captured(() => revertOptimizations(IP));
  assert.ok(revert.result.every((x) => x.ok), JSON.stringify(revert.result));
  const back = fake.readState();
  assert.deepEqual(back.secure, FACTORY.secure);
  assert.deepEqual(back.system, FACTORY.system);
  assert.equal(back.appops[AERIAL].SYSTEM_ALERT_WINDOW, undefined);
  assert.doesNotMatch(fs.readFileSync(fake.envFile, 'utf8'), /FIRE_TV_OPTIMIZE_/);
});

test('a setting the TV did not have before is deleted again on revert', async () => {
  const { result } = await captured(async () => {
    const state = await readOptimizeState(IP);
    return applyOptimizations(IP, [{ id: 'activate-on-sleep', label: 'x', from: state.settings['activate-on-sleep'], to: '1' }]);
  });
  assert.ok(result[0].ok);
  fs.appendFileSync(fake.envFile, `FIRE_TV_IP=${IP}\nINSTALLED=true\n`);
  const listed = await drive('bin/firetv-revert.js', [], [{ expect: 'What should be reverted?', send: `i${ENTER}` }]);
  assert.match(listed.out, /Undo the screensaver optimizations \(1 setting\)/, listed.out);
  await captured(() => revertOptimizations(IP));
  assert.equal(fake.readState().secure.screensaver_activate_on_sleep, undefined);
});

test('optimize reports a setting the TV would not take, and keeps it for a later revert', async () => {
  fake.setState({ ...FACTORY, lockedKeys: ['screensaver_enabled', 'SYSTEM_ALERT_WINDOW'] });
  const r = await captured(() => optimizeForScreensavers(IP, { yes: true }));
  assert.match(r.out, /Turn the screensaver on: the TV still reads off/);
  assert.match(r.out, /frame rate .*: the TV still reads not allowed/);
  assert.match(r.out, /did not take every change/);
  assert.equal(process.exitCode, 1);

  fake.setState({ lockedKeys: ['str.auto_wake_up_enabled'] });
  const revert = await captured(() => revertOptimizations(IP));
  assert.deepEqual(revert.result.filter((x) => !x.ok).map((x) => x.id), ['alexa-fix']);
  assert.match(fs.readFileSync(fake.envFile, 'utf8'), /FIRE_TV_OPTIMIZE_ALEXA_FIX=0/);
});

test('the optimize checklist applies only what stays checked', async () => {
  fs.writeFileSync(fake.envFile, `FIRE_TV_IP=${IP}\nINSTALLED=true\n`);
  const { screensaver_components: _active, ...noActive } = FACTORY.secure;
  fake.setState({ ...FACTORY, secure: noActive });
  const r = await drive('bin/optimize.js', [], [
    { expect: 'Which changes should be made?', send: `${SPACE}${ENTER}` },
    { expect: 'Nothing has been changed yet. Continue?', send: ENTER },
  ]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /not set -> Aerial Views/);
  assert.match(r.out, /10 min -> 2\.5 min/);
  const s = fake.readState();
  assert.equal(s.secure.screensaver_enabled, '0');
  assert.equal(s.secure.screensaver_activate_on_sleep, '1');
});

test('the optimize checklist with everything unchecked, or cancelled, changes nothing', async () => {
  fs.writeFileSync(fake.envFile, `FIRE_TV_IP=${IP}\nINSTALLED=true\n`);
  fake.setState(FACTORY);
  const none = await drive('bin/firetv-optimize.js', [], [{ expect: 'Which changes should be made?', send: `i${ENTER}` }]);
  assert.match(none.out, /Nothing selected/, none.out);
  const cancelled = await drive('bin/firetv-optimize.js', [], [
    { expect: 'Which changes should be made?', send: ENTER },
    { expect: 'Nothing has been changed yet. Continue?', send: `${DOWN}${DOWN}${ENTER}` },
  ]);
  assert.match(cancelled.out, /Cancelled\. Nothing was changed/, cancelled.out);
  assert.deepEqual(fake.readState().secure, FACTORY.secure);
});

test('start offers to optimize, and firetv-revert offers to undo it', async () => {
  fake.setState(FACTORY);
  const r = await drive('bin/start.js', [], [
    { expect: 'Developer Mode and ADB debugging?', send: 'y' },
    { expect: 'IP address', send: `${IP}${ENTER}` },
    { expect: 'review or adjust TV timeout', send: 'n' },
    { expect: 'optimize the TV for screensavers', send: 'y' },
    { expect: 'Which changes should be made?', send: ENTER },
    { expect: 'Nothing has been changed yet. Continue?', send: ENTER },
    { expect: 'What would you like to do?', send: `${DOWN.repeat(6)}${ENTER}` },
  ]);
  assert.equal(r.code, 0, r.out);
  assert.equal(fake.readState().secure.screensaver_enabled, '1');

  const { result, out } = await captured(() => uninstallEverything(IP, { all: true, force: true }));
  assert.equal(result, 'reverted', out);
  assert.match(out, /Screensaver optimizations undone/);
  assert.equal(fake.readState().secure.screensaver_enabled, '0');
  assert.equal(fake.readState().secure.screensaver_components, AMAZON_DEFAULT.dreamComponent);
});

test('firetv-revert reports optimizations that would not go back', async () => {
  fake.setState(FACTORY);
  await captured(() => optimizeForScreensavers(IP, { yes: true }));
  fake.setState({ lockedKeys: ['screensaver_enabled'] });
  const { result, out } = await captured(() => uninstallEverything(IP, { all: true, force: true }));
  assert.equal(result, 'failed');
  assert.match(out, /These optimizations did not go back: Turn the screensaver on/);
});
