import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mustBeNonNegativeInteger, mustBeValidMinutes, mustBeKnownTimeoutIds, msToLabel } from '../src/steps/timeouts-shared.js';
import { resolveRequestedMs } from '../src/steps/timeout-set.js';
import { resolveResetIds } from '../src/steps/timeout-reset.js';
import { buildManageOptions, buildManageSummary, resolveManageSelection } from '../src/steps/timeout-manage.js';
import { TIMEOUTS, findTimeoutById } from '../src/apply/timeouts.js';

test('TIMEOUTS registry has exactly sleep and screensaver, each with a unique id', () => {
  const ids = TIMEOUTS.map((t) => t.id);
  assert.deepEqual(ids, ['sleep', 'screensaver']);
  assert.equal(new Set(ids).size, ids.length);
});

test('findTimeoutById resolves known ids and returns undefined for unknown ones', () => {
  assert.equal(findTimeoutById('sleep').namespace, 'secure');
  assert.equal(findTimeoutById('screensaver').namespace, 'system');
  assert.equal(findTimeoutById('bogus'), undefined);
});

test('mustBeNonNegativeInteger accepts whole numbers >= 0', () => {
  assert.equal(mustBeNonNegativeInteger('0'), null);
  assert.equal(mustBeNonNegativeInteger('20'), null);
});

test('mustBeNonNegativeInteger rejects negatives, decimals, and non-numbers', () => {
  assert.match(mustBeNonNegativeInteger('-1'), /whole number/);
  assert.match(mustBeNonNegativeInteger('1.5'), /whole number/);
  assert.match(mustBeNonNegativeInteger('abc'), /whole number/);
});

test('mustBeNonNegativeInteger rejects empty, whitespace, and scientific-notation input instead of coercing it to 0', () => {
  assert.match(mustBeNonNegativeInteger(''), /whole number/);
  assert.match(mustBeNonNegativeInteger('   '), /whole number/);
  assert.match(mustBeNonNegativeInteger('1e21'), /whole number/);
});

test('mustBeValidMinutes rejects empty input instead of coercing it to 0', () => {
  assert.match(mustBeValidMinutes(''), /whole number/);
});

test('mustBeNonNegativeInteger rejects a value beyond Number.MAX_SAFE_INTEGER', () => {
  assert.match(mustBeNonNegativeInteger('999999999999999999999'), /or less/);
  assert.equal(mustBeNonNegativeInteger(String(Number.MAX_SAFE_INTEGER)), null);
});

test('mustBeValidMinutes rejects a minutes value that would overflow once converted to ms', () => {
  assert.match(mustBeValidMinutes('999999999999999'), /or less/);
  assert.equal(mustBeValidMinutes(String(Math.floor(Number.MAX_SAFE_INTEGER / 60000))), null);
});

test('mustBeKnownTimeoutIds accepts a comma list of real ids', () => {
  assert.equal(mustBeKnownTimeoutIds('sleep,screensaver'), null);
  assert.equal(mustBeKnownTimeoutIds('sleep'), null);
});

test('mustBeKnownTimeoutIds rejects an unknown id, naming it', () => {
  assert.match(mustBeKnownTimeoutIds('sleep,bogus'), /bogus/);
});

test('mustBeKnownTimeoutIds rejects blank and comma-only input instead of silently resolving to an empty selection', () => {
  assert.match(mustBeKnownTimeoutIds(''), /provide one or more/);
  assert.match(mustBeKnownTimeoutIds(','), /provide one or more/);
  assert.match(mustBeKnownTimeoutIds(',,'), /provide one or more/);
});

test('mustBeKnownTimeoutIds rejects a trailing comma with a blank entry', () => {
  assert.match(mustBeKnownTimeoutIds('sleep,'), /provide one or more/);
});

test('msToLabel formats whole minutes, raw ms, zero, and unknown', () => {
  assert.equal(msToLabel(1200000), '20 min (1200000 ms)');
  assert.equal(msToLabel(1234), '1234 ms');
  assert.equal(msToLabel(0), '0 ms (never)');
  assert.equal(msToLabel(null), 'unknown');
  assert.equal(msToLabel(undefined), 'unknown');
});

test('resolveRequestedMs converts --minutes to ms and passes --ms through', () => {
  assert.deepEqual(resolveRequestedMs({ ms: '900000' }), { ok: true, ms: 900000 });
  assert.deepEqual(resolveRequestedMs({ minutes: '5' }), { ok: true, ms: 300000 });
});

test('resolveRequestedMs resolves ms: undefined when neither flag is given', () => {
  assert.deepEqual(resolveRequestedMs({}), { ok: true, ms: undefined });
});

test('resolveRequestedMs rejects --ms and --minutes together', () => {
  const result = resolveRequestedMs({ ms: '1000', minutes: '5' });
  assert.equal(result.ok, false);
  assert.match(result.error, /only one of/);
});

test('resolveRequestedMs rejects a --ms value beyond the safe integer bound', () => {
  const result = resolveRequestedMs({ ms: '999999999999999999999' });
  assert.equal(result.ok, false);
  assert.match(result.error, /--ms/);
});

test('resolveRequestedMs rejects a --minutes value that would overflow on conversion, even though it is a plain whole number', () => {
  // 999999999999999 alone passes Number.isInteger, but *60000 blows past
  // Number.MAX_SAFE_INTEGER. This is the exact overflow-during-conversion
  // bug: resolveRequestedMs must catch it itself, not rely on the caller.
  const result = resolveRequestedMs({ minutes: '999999999999999' });
  assert.equal(result.ok, false);
  assert.match(result.error, /--minutes/);
});

test('resolveResetIds resolves --all to every given id', () => {
  assert.deepEqual(resolveResetIds({ all: true }, ['sleep', 'screensaver']), ['sleep', 'screensaver']);
});

test('resolveResetIds resolves --only to a parsed, trimmed list', () => {
  assert.deepEqual(resolveResetIds({ only: 'sleep, screensaver' }, ['sleep', 'screensaver']), ['sleep', 'screensaver']);
  assert.deepEqual(resolveResetIds({ only: 'sleep' }, ['sleep', 'screensaver']), ['sleep']);
});

test('resolveResetIds resolves to an empty list when neither flag is given', () => {
  assert.deepEqual(resolveResetIds({}, ['sleep', 'screensaver']), []);
});

const sleepDef = findTimeoutById('sleep');
const screensaverDef = findTimeoutById('screensaver');

test('buildManageOptions offers Edit for every possible timeout and Reset only when a baseline exists', () => {
  const possible = [
    { def: sleepDef, currentMs: 1200000, baselineMs: 1200000 },
    { def: screensaverDef, currentMs: 300000, baselineMs: null },
  ];
  const options = buildManageOptions(possible);
  const values = options.map((o) => o.value);
  assert.ok(values.includes('edit:sleep'));
  assert.ok(values.includes('reset:sleep'));
  assert.ok(values.includes('edit:screensaver'));
  assert.ok(!values.includes('reset:screensaver'));
  assert.ok(values.includes('reset-all'));
});

test('buildManageOptions omits reset-all when nothing has a baseline yet', () => {
  const possible = [{ def: sleepDef, currentMs: 1200000, baselineMs: null }];
  const options = buildManageOptions(possible);
  assert.ok(!options.some((o) => o.value === 'reset-all'));
  assert.ok(!options.some((o) => o.value === 'reset:sleep'));
});

test('buildManageSummary describes edit, reset, and reset-all selections', () => {
  const possible = [
    { def: sleepDef, currentMs: 1200000, baselineMs: 1200000 },
    { def: screensaverDef, currentMs: 300000, baselineMs: 300000 },
  ];

  const editSummary = buildManageSummary({ selected: ['edit:sleep'], values: { sleep: 600000 } }, possible);
  assert.match(editSummary[0].label, /Set Sleep .* to 10 min/);

  const resetSummary = buildManageSummary({ selected: ['reset:screensaver'], values: {} }, possible);
  assert.match(resetSummary[0].label, /Reset Screensaver .* baseline \(5 min/);

  const resetAllSummary = buildManageSummary({ selected: ['reset-all'], values: {} }, possible);
  assert.equal(resetAllSummary.length, 2);
  assert.match(resetAllSummary[0].label, /Reset Sleep .* baseline \(20 min/);
  assert.match(resetAllSummary[1].label, /Reset Screensaver .* baseline \(5 min/);
});

test('resolveManageSelection splits edit vs reset ids cleanly when there is no overlap', () => {
  const possible = [
    { def: sleepDef, currentMs: 1200000, baselineMs: 1200000 },
    { def: screensaverDef, currentMs: 300000, baselineMs: 300000 },
  ];
  const result = resolveManageSelection(['edit:sleep', 'reset:screensaver'], possible);
  assert.deepEqual(result, { editIds: ['sleep'], resetIds: ['screensaver'] });
});

test('resolveManageSelection lets an explicit edit win over a reset of the same id', () => {
  const possible = [{ def: sleepDef, currentMs: 1200000, baselineMs: 1200000 }];
  const result = resolveManageSelection(['edit:sleep', 'reset:sleep'], possible);
  assert.deepEqual(result, { editIds: ['sleep'], resetIds: [] });
});

test('resolveManageSelection lets an explicit edit win over reset-all for the same id', () => {
  const possible = [
    { def: sleepDef, currentMs: 1200000, baselineMs: 1200000 },
    { def: screensaverDef, currentMs: 300000, baselineMs: 300000 },
  ];
  const result = resolveManageSelection(['edit:sleep', 'reset-all'], possible);
  assert.deepEqual(result, { editIds: ['sleep'], resetIds: ['screensaver'] });
});

test('buildManageOptions always offers a Skip choice first, even with nothing possible to edit', () => {
  const withTimeouts = buildManageOptions([{ def: sleepDef, currentMs: 1200000, baselineMs: null }]);
  assert.equal(withTimeouts[0].value, 'skip');
  assert.equal(buildManageOptions([])[0].value, 'skip');
});

test('buildManageSummary ignores a skip selection and produces no summary lines', () => {
  const possible = [{ def: sleepDef, currentMs: 1200000, baselineMs: 1200000 }];
  assert.deepEqual(buildManageSummary({ selected: ['skip'], values: {} }, possible), []);
});

test('buildManageSummary lists only what will happen: an edit replaces a reset of the same timeout', () => {
  const possible = [
    { def: sleepDef, currentMs: 1200000, baselineMs: 1200000 },
    { def: screensaverDef, currentMs: 300000, baselineMs: 300000 },
  ];
  const lines = buildManageSummary({ selected: ['edit:sleep', 'reset:sleep'], values: { sleep: 720000 } }, possible);
  assert.equal(lines.length, 1);
  assert.match(lines[0].label, /Set Sleep .* to 12 min/);

  const mixed = buildManageSummary({ selected: ['edit:sleep', 'reset-all'], values: { sleep: 720000 } }, possible);
  assert.equal(mixed.length, 2);
  assert.match(mixed[0].label, /Set Sleep/);
  assert.match(mixed[1].label, /Reset Screensaver/);
});

test('isDeviceRejection only matches a refusal from the device, not adb or network failures', async () => {
  const { isDeviceRejection } = await import('../src/apply/timeouts.js');
  assert.equal(isDeviceRejection({ stderr: 'java.lang.IllegalArgumentException: bad value' }), true);
  assert.equal(isDeviceRejection(new Error('adb: device offline')), false);
  assert.equal(isDeviceRejection(new Error('spawn adb ENOENT')), false);
});
