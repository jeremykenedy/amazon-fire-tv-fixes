import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFlags, FlagError } from '../src/cli-args.js';
import { FLAG_SPEC as INSTALL_ADB_SPEC } from '../src/steps/install-adb.js';
import { ENABLE_FLAG_SPEC, DISABLE_FLAG_SPEC } from '../src/steps/alexa-fix.js';
import { FLAG_SPEC as SCREENSAVERS_SPEC } from '../src/steps/screensavers.js';
import { FLAG_SPEC as SET_SCREENSAVER_SPEC } from '../src/steps/set-screensaver.js';
import { FLAG_SPEC as UNINSTALL_SPEC } from '../src/steps/uninstall.js';
import { FLAG_SPEC as TIMEOUT_SPEC } from '../src/steps/timeout-set.js';
import { RESET_FLAG_SPEC } from '../src/steps/timeout-reset.js';
import { SCREENSAVERS, AMAZON_DEFAULT } from '../src/screensaver-registry.js';

test('firetv-install-adb accepts --yes and rejects unknown flags', () => {
  assert.deepEqual({ ...parseFlags(INSTALL_ADB_SPEC, ['--yes']) }, { yes: true });
  assert.deepEqual({ ...parseFlags(INSTALL_ADB_SPEC, []) }, {});
  assert.throws(() => parseFlags(INSTALL_ADB_SPEC, ['--force']), (err) => err instanceof FlagError);
});

test('enable-alexa-fix accepts --yes only, no --force', () => {
  assert.deepEqual({ ...parseFlags(ENABLE_FLAG_SPEC, ['--yes']) }, { yes: true });
  assert.throws(() => parseFlags(ENABLE_FLAG_SPEC, ['--force']), (err) => err instanceof FlagError);
});

test('disable-alexa-fix accepts --yes and --force together', () => {
  assert.deepEqual({ ...parseFlags(DISABLE_FLAG_SPEC, ['--yes', '--force']) }, { yes: true, force: true });
});

test('firetv-screensavers accepts real registry ids for --install and --uninstall', () => {
  const ids = SCREENSAVERS.map((s) => s.id).join(',');
  const values = parseFlags(SCREENSAVERS_SPEC, [`--install=${ids}`, '--force']);
  assert.equal(values.install, ids);
  assert.equal(values.force, true);
});

test('firetv-screensavers rejects an id not in the registry', () => {
  assert.throws(() => parseFlags(SCREENSAVERS_SPEC, ['--install=not-a-real-screensaver']), (err) => {
    assert.ok(err instanceof FlagError);
    assert.match(err.message, /Unknown screensaver id/);
    return true;
  });
});

test('firetv-screensavers rejects a mix of one valid and one invalid id', () => {
  const oneValid = SCREENSAVERS[0].id;
  assert.throws(() => parseFlags(SCREENSAVERS_SPEC, [`--uninstall=${oneValid},bogus`]), (err) => err instanceof FlagError);
});

test('firetv-set-screensaver accepts every registry id plus the amazon default', () => {
  for (const id of [AMAZON_DEFAULT.id, ...SCREENSAVERS.map((s) => s.id)]) {
    assert.deepEqual({ ...parseFlags(SET_SCREENSAVER_SPEC, [`--set=${id}`]) }, { set: id });
  }
});

test('firetv-set-screensaver rejects an id that is not amazon or a known fork', () => {
  assert.throws(() => parseFlags(SET_SCREENSAVER_SPEC, ['--set=bogus']), (err) => {
    assert.ok(err instanceof FlagError);
    assert.match(err.message, /must be one of/);
    return true;
  });
});

test('amazon-fire-tv-fixes-uninstall accepts --all, --yes, and --force in any combination', () => {
  assert.deepEqual({ ...parseFlags(UNINSTALL_SPEC, ['--all', '--force']) }, { all: true, force: true });
  assert.deepEqual({ ...parseFlags(UNINSTALL_SPEC, ['--yes']) }, { yes: true });
  assert.deepEqual({ ...parseFlags(UNINSTALL_SPEC, []) }, {});
});

test('firetv-timeout-sleep/screensaver accept --ms, --minutes, and --yes', () => {
  assert.deepEqual({ ...parseFlags(TIMEOUT_SPEC, ['--ms=1200000']) }, { ms: '1200000' });
  assert.deepEqual({ ...parseFlags(TIMEOUT_SPEC, ['--minutes=20']) }, { minutes: '20' });
  assert.deepEqual({ ...parseFlags(TIMEOUT_SPEC, ['--yes']) }, { yes: true });
});

test('firetv-timeout-sleep/screensaver reject a non-whole-number value', () => {
  assert.throws(() => parseFlags(TIMEOUT_SPEC, ['--ms=-5']), (err) => err instanceof FlagError);
  assert.throws(() => parseFlags(TIMEOUT_SPEC, ['--minutes=1.5']), (err) => err instanceof FlagError);
});

test('firetv-timeouts-reset accepts --all, --only with real ids, and --yes', () => {
  assert.deepEqual({ ...parseFlags(RESET_FLAG_SPEC, ['--all']) }, { all: true });
  assert.deepEqual({ ...parseFlags(RESET_FLAG_SPEC, ['--only=sleep,screensaver']) }, { only: 'sleep,screensaver' });
  assert.deepEqual({ ...parseFlags(RESET_FLAG_SPEC, ['--yes']) }, { yes: true });
});

test('firetv-timeouts-reset rejects an --only id that is not a known timeout', () => {
  assert.throws(() => parseFlags(RESET_FLAG_SPEC, ['--only=bogus']), (err) => {
    assert.ok(err instanceof FlagError);
    assert.match(err.message, /Unknown timeout id/);
    return true;
  });
});

test('firetv-timeouts-reset rejects a blank or comma-only --only instead of silently resetting nothing', () => {
  assert.throws(() => parseFlags(RESET_FLAG_SPEC, ['--only=']), (err) => err instanceof FlagError);
  assert.throws(() => parseFlags(RESET_FLAG_SPEC, ['--only=,']), (err) => err instanceof FlagError);
});
