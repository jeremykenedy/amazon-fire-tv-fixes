import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateIdList, parseIdList } from '../src/steps/screensavers.js';
import { SCREENSAVERS } from '../src/screensaver-registry.js';

test('validateIdList accepts a comma-separated list of real registry ids', () => {
  const ids = SCREENSAVERS.map((s) => s.id).join(',');
  assert.equal(validateIdList(ids), null);
});

test('validateIdList reports every unknown id, not just the first', () => {
  const message = validateIdList('bogus-one,bogus-two');
  assert.match(message, /bogus-one, bogus-two/);
});

test('parseIdList splits and trims, and returns an empty array for undefined', () => {
  assert.deepEqual(parseIdList('aerial, snoozy,androsaver'), ['aerial', 'snoozy', 'androsaver']);
  assert.deepEqual(parseIdList(undefined), []);
  assert.deepEqual(parseIdList(''), []);
});
