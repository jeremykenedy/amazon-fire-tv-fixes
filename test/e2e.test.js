import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { installFakeAdb, AERIAL } from './helpers/fake-adb.js';
import { drive, DOWN, ENTER } from './helpers/drive.js';

let fake;

before(() => {
  fake = installFakeAdb();
});
beforeEach(() => fake.reset());
after(() => fake.restore());

const EXIT_MENU = [{ expect: 'What would you like to do?', send: `${DOWN.repeat(6)}${ENTER}` }];

test('start on a fresh setup walks through connecting and reaches the menu, then exits', async () => {
  const r = await drive('bin/start.js', [], [
    { expect: 'Developer Mode and ADB debugging?', send: 'y' },
    { expect: 'IP address', send: `192.168.1.49${ENTER}` },
    { expect: 'review or adjust TV timeout', send: 'n' },
    { expect: 'optimize the TV for screensavers', send: 'n' },
    ...EXIT_MENU,
  ]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Connected to 192\.168\.1\.49/);
  assert.match(r.out, /Bye!/);
  const env = fs.readFileSync(fake.envFile, 'utf8');
  assert.match(env, /INSTALLED=true/);
  assert.match(env, /FIRE_TV_IP=192\.168\.1\.49/);
});

const CONNECT = [
  { expect: 'Developer Mode and ADB debugging?', send: 'y' },
  { expect: 'IP address', send: `192.168.1.49${ENTER}` },
  { expect: 'review or adjust TV timeout', send: 'n' },
  { expect: 'optimize the TV for screensavers', send: 'n' },
];
const CONTINUE = { expect: 'Nothing has been changed yet. Continue?', send: ENTER };
const MENU = (n) => ({ expect: 'What would you like to do?', send: `${DOWN.repeat(n)}${ENTER}` });
const BYE = { expect: /What would you like to do\?[\s\S]*What would you like to do\?/, send: `${DOWN.repeat(6)}${ENTER}` };

function installedEnv() {
  fs.writeFileSync(fake.envFile, 'FIRE_TV_IP=192.168.1.49\nINSTALLED=true\n');
}

test('start when already installed hands off to update and reaches the menu', async () => {
  installedEnv();
  const r = await drive('bin/start.js', [], [...CONNECT, ...EXIT_MENU]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /already installed/);
});

test('update on a not-installed setup runs the plain guided flow', async () => {
  const r = await drive('bin/update.js', [], [...CONNECT, ...EXIT_MENU]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Bye!/);
});

test('declining the developer-mode question makes no changes and exits 0', async () => {
  const r = await drive('bin/start.js', [], [{ expect: 'Developer Mode and ADB debugging?', send: 'n' }]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /No changes were made/);
  assert.doesNotMatch(fs.existsSync(fake.envFile) ? fs.readFileSync(fake.envFile, 'utf8') : '', /INSTALLED=true/);
});

test('menu: turn the Alexa fix off, then it is off on the device', async () => {
  const r = await drive('bin/start.js', [], [...CONNECT, MENU(1), { expect: 'Revert now? [y/N]', send: 'y' }, { expect: 'Type "yes" to continue', send: `yes${ENTER}` }, { expect: 'What would you like to do?', send: `${DOWN.repeat(6)}${ENTER}` }]);
  assert.equal(r.code, 0, r.out);
  assert.equal(fake.readState().secure['str.auto_wake_up_enabled'], '0');
});

test('menu: declining the Alexa revert leaves the fix on', async () => {
  const r = await drive('bin/start.js', [], [...CONNECT, MENU(1), { expect: 'Revert now? [y/N]', send: 'n' }, { expect: 'What would you like to do?', send: `${DOWN.repeat(6)}${ENTER}` }]);
  assert.equal(r.code, 0, r.out);
  assert.equal(fake.readState().secure['str.auto_wake_up_enabled'], '1');
});

test('menu: choose Amazon with Ads as the active screensaver', async () => {
  const r = await drive('bin/start.js', [], [
    ...CONNECT,
    MENU(3),
    { expect: 'Set the active screensaver to:', send: `${DOWN}${ENTER}` },
    CONTINUE,
    { expect: 'What would you like to do?', send: `${DOWN.repeat(6)}${ENTER}` },
  ]);
  assert.equal(r.code, 0, r.out);
  assert.match(fake.readState().secure.screensaver_components, /amazon/);
});

test('menu: edit the sleep timeout to 20 minutes', async () => {
  const r = await drive('bin/start.js', [], [
    ...CONNECT,
    MENU(4),
    { expect: 'What would you like to do?', send: `${DOWN} ${ENTER}` },
    { expect: 'minutes', send: `20${ENTER}` },
    CONTINUE,
    { expect: 'What would you like to do?', send: `${DOWN.repeat(6)}${ENTER}` },
  ]);
  assert.equal(r.code, 0, r.out);
  assert.equal(fake.readState().secure.sleep_timeout, '1200000');
});

test('menu: skipping the timeout checklist changes nothing', async () => {
  const r = await drive('bin/start.js', [], [
    ...CONNECT,
    MENU(4),
    { expect: 'What would you like to do?', send: ENTER },
    { expect: /No timeout changes/, send: '' },
    { expect: 'What would you like to do?', send: `${DOWN.repeat(6)}${ENTER}` },
  ]);
  assert.equal(r.code, 0, r.out);
  assert.equal(fake.readState().secure.sleep_timeout, '840000');
});

test('menu: adb step reports adb is already installed', async () => {
  const r = await drive('bin/start.js', [], [...CONNECT, MENU(0), { expect: 'already installed', send: '' }, { expect: 'What would you like to do?', send: `${DOWN.repeat(6)}${ENTER}` }]);
  assert.equal(r.code, 0, r.out);
});

const EXIT_AFTER = { expect: 'What would you like to do?', send: `${DOWN.repeat(6)}${ENTER}` };

test('menu: uncheck Aerial Views to remove it from the TV', async () => {
  const r = await drive('bin/start.js', [], [
    ...CONNECT,
    MENU(2),
    { expect: 'Which screensavers do you want installed?', send: ` ${ENTER}` },
    CONTINUE,
    { expect: /Type "yes"|What would you like to do\?[\s\S]*What would you like to do\?/, send: `yes${ENTER}` },
    EXIT_AFTER,
  ]);
  assert.match(r.out, /Aerial Views/);
  assert.deepEqual(fake.readState().installed, [], r.out);
});

test('menu: leaving the screensaver checklist as is changes nothing', async () => {
  const r = await drive('bin/start.js', [], [
    ...CONNECT,
    MENU(2),
    { expect: 'Which screensavers do you want installed?', send: ENTER },
    { expect: /Nothing to do/, send: '' },
    EXIT_AFTER,
  ]);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(fake.readState().installed, [AERIAL]);
});

test('menu: resetting every timeout puts the baselines back', async () => {
  fake.setState({ system: { screen_off_timeout: '300000' } });
  const r = await drive('bin/start.js', [], [
    ...CONNECT,
    MENU(4),
    { expect: 'What would you like to do?', send: `${DOWN} ${ENTER}` },
    { expect: 'minutes', send: `20${ENTER}` },
    CONTINUE,
    EXIT_AFTER,
  ]);
  assert.equal(fake.readState().secure.sleep_timeout, '1200000', r.out);
  const again = await drive('bin/start.js', [], [
    ...CONNECT,
    MENU(4),
    { expect: 'What would you like to do?', send: `${DOWN.repeat(5)} ${ENTER}` },
    CONTINUE,
    EXIT_AFTER,
  ]);
  assert.equal(fake.readState().secure.sleep_timeout, '840000', again.out);
});

test('uninstall: reverts the TV, then resets .env and reports it could not unlink without npm', async () => {
  installedEnv();
  const r = await drive('bin/uninstall.js', [], [
    { expect: 'What should be reverted?', send: ENTER },
    CONTINUE,
    { expect: 'Type "yes"', send: `yes${ENTER}` },
    { expect: /remove the repo code from your machine\? \[y\/N\]/, send: 'n' },
  ]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /Could not unlink the commands/);
  assert.match(r.out, /only partly uninstalled/);
  const s = fake.readState();
  assert.equal(s.secure['str.auto_wake_up_enabled'], '0');
  assert.deepEqual(s.installed, []);
  assert.doesNotMatch(fs.readFileSync(fake.envFile, 'utf8'), /INSTALLED=true/);
});

test('uninstall: cancelling the revert keeps .env unless asked', async () => {
  installedEnv();
  const r = await drive('bin/uninstall.js', [], [
    { expect: 'What should be reverted?', send: ENTER },
    { expect: 'Nothing has been changed yet. Continue?', send: `${DOWN}${DOWN}${ENTER}` },
    { expect: /Remove the commands and reset .env anyway\?/, send: 'n' },
  ]);
  assert.match(r.out, /No changes were made to this computer/);
  assert.match(fs.readFileSync(fake.envFile, 'utf8'), /INSTALLED=true/);
  assert.equal(fake.readState().secure['str.auto_wake_up_enabled'], '1');
});

test('standalone commands run their guided flow against the fake TV', async () => {
  installedEnv();
  const off = await drive('bin/disable-alexa-fix.js', [], [{ expect: /\[y\/N\]/, send: 'y' }, { expect: 'Type "yes"', send: `yes${ENTER}` }]);
  assert.equal(fake.readState().secure['str.auto_wake_up_enabled'], '0', off.out);
  const on = await drive('bin/enable-alexa-fix.js', [], [{ expect: /\[y\/N\]|\[Y\/n\]/, send: 'y' }]);
  assert.equal(fake.readState().secure['str.auto_wake_up_enabled'], '1', on.out);

  const ss = await drive('bin/firetv-set-screensaver.js', [], [{ expect: 'Set the active screensaver to:', send: `${DOWN}${ENTER}` }, CONTINUE]);
  assert.match(fake.readState().secure.screensaver_components, /amazon/, ss.out);

  const sl = await drive('bin/firetv-timeout-sleep.js', [], [{ expect: 'in minutes', send: `30${ENTER}` }, CONTINUE]);
  assert.equal(fake.readState().secure.sleep_timeout, '1800000', sl.out);

  const all = await drive('bin/firetv-timeouts.js', [], [{ expect: 'What would you like to do?', send: `${DOWN.repeat(5)} ${ENTER}` }, CONTINUE]);
  assert.equal(fake.readState().secure.sleep_timeout, '840000', all.out);

  const rs = await drive('bin/firetv-timeouts-reset.js', [], [{ expect: 'Reset which timeouts?', send: ENTER }, CONTINUE]);
  assert.equal(rs.code, 0, rs.out);

  const cur = await drive('bin/firetv-timeouts-current.js', [], []);
  assert.match(cur.out, /Sleep/);
  const pos = await drive('bin/firetv-timeouts-possible.js', [], []);
  assert.match(pos.out, /Sleep/);
  const adb = await drive('bin/firetv-install-adb.js', [], []);
  assert.match(adb.out, /already installed/);

  const sv = await drive('bin/firetv-screensavers.js', [], [{ expect: 'Which screensavers do you want installed?', send: ENTER }]);
  assert.equal(sv.code, 0, sv.out);
});

test('fire-tv-toolkit and the uninstall command run their flags without a TV prompt', async () => {
  installedEnv();
  const un = await drive('bin/firetv-revert.js', ['--all', '--force'], []);
  assert.equal(un.code, 0, un.out);
  assert.equal(fake.readState().secure['str.auto_wake_up_enabled'], '0');
  const menu = await drive('bin/fire-tv-toolkit.js', [], [...CONNECT, EXIT_AFTER]);
  assert.equal(menu.code, 0, menu.out);
});

const SETUP_LIST = /Install\/Link firetv commands/;

test('setup.js: declining makes no changes', async () => {
  const r = await drive('setup.js', [], [{ expect: 'Start setting up Fire TV Toolkit?', send: 'n' }]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /No changes were made/);
});

test('setup.js: selecting nothing makes no changes', async () => {
  const r = await drive('setup.js', [], [
    { expect: 'Start setting up Fire TV Toolkit?', send: 'y' },
    { expect: SETUP_LIST, send: ` ${DOWN} ${ENTER}` },
  ]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Nothing selected/);
});

test('setup.js: linking fails cleanly when npm is not available, and says so', async () => {
  const r = await drive('setup.js', [], [
    { expect: 'Start setting up Fire TV Toolkit?', send: 'y' },
    { expect: SETUP_LIST, send: `${DOWN} ${ENTER}` },
    CONTINUE,
  ]);
  assert.equal(r.code, 1, r.out);
  assert.doesNotMatch(r.out, /Commands linked/);
});

test('setup.js: launching the app straight away runs the guided flow', async () => {
  const r = await drive('setup.js', [], [
    { expect: 'Start setting up Fire TV Toolkit?', send: 'y' },
    { expect: SETUP_LIST, send: ` ${ENTER}` },
    CONTINUE,
    ...CONNECT,
    EXIT_AFTER,
  ]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Starting the guided setup now/);
  assert.match(fs.readFileSync(fake.envFile, 'utf8'), /INSTALLED=true/);
});

test('a device command explains that adb is missing instead of crashing', async () => {
  installedEnv();
  const r = await drive('bin/enable-alexa-fix.js', ['--yes'], [], { noAdb: true });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /adb .*is not installed/);
});
