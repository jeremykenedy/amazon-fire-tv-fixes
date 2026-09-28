import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveYesDefault } from '../src/steps/set-screensaver.js';

test('resolveYesDefault picks the single installed fork', () => {
  const result = resolveYesDefault([{ id: 'aerial' }]);
  assert.deepEqual(result, { ok: true, choice: { id: 'aerial' } });
});

test('resolveYesDefault refuses to guess when nothing is installed', () => {
  const result = resolveYesDefault([]);
  assert.deepEqual(result, { ok: false, reason: 'none' });
});

test('resolveYesDefault refuses to guess when more than one is installed', () => {
  const result = resolveYesDefault([{ id: 'aerial' }, { id: 'snoozy' }]);
  assert.deepEqual(result, { ok: false, reason: 'multiple' });
});
