import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveYesDefault } from '../src/steps/set-screensaver.js';

test('resolveYesDefault picks the single installed fork', () => {
  const result = resolveYesDefault([{ id: 'snoozy' }]);
  assert.deepEqual(result, { ok: true, choice: { id: 'snoozy' } });
});

test('resolveYesDefault picks Aerial Views, the default, when several are installed', () => {
  const result = resolveYesDefault([{ id: 'snoozy' }, { id: 'aerial' }]);
  assert.deepEqual(result, { ok: true, choice: { id: 'aerial' } });
});

test('resolveYesDefault refuses to guess when nothing is installed', () => {
  const result = resolveYesDefault([]);
  assert.deepEqual(result, { ok: false, reason: 'none' });
});

test('resolveYesDefault refuses to guess when several are installed and none is Aerial Views', () => {
  const result = resolveYesDefault([{ id: 'androsaver' }, { id: 'snoozy' }]);
  assert.deepEqual(result, { ok: false, reason: 'multiple' });
});
