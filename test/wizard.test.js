import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runWizard, BACK } from '../src/wizard.js';

function step(key, values) {
  let call = 0;
  return {
    key,
    prompt: async () => values[call++],
  };
}

test('runWizard collects state from each step and calls onConfirm on continue', async () => {
  let confirmed = null;
  const result = await runWizard({
    steps: [step('a', ['one']), step('b', ['two'])],
    buildSummary: (state) => [{ label: `${state.a}/${state.b}` }],
    confirmFn: async () => 'continue',
    onConfirm: async (state) => {
      confirmed = state;
    },
  });

  assert.deepEqual(result, { a: 'one', b: 'two' });
  assert.deepEqual(confirmed, { a: 'one', b: 'two' });
});

test('runWizard walks back a step when a step returns BACK, then re-asks it', async () => {
  // Going BACK from step 2 re-prompts step 1, so step 1 is asked twice here.
  const step1 = step('a', ['one', 'one-again']);
  const step2 = step('b', [BACK, 'two']);

  const result = await runWizard({
    steps: [step1, step2],
    buildSummary: (state) => [{ label: `${state.a}/${state.b}` }],
    confirmFn: async () => 'continue',
    onConfirm: async () => {},
  });

  assert.deepEqual(result, { a: 'one-again', b: 'two' });
});

test('runWizard returns null and skips onConfirm when the summary is cancelled', async () => {
  let onConfirmCalled = false;

  const result = await runWizard({
    steps: [step('a', ['one'])],
    buildSummary: () => [],
    confirmFn: async () => 'cancel',
    onConfirm: async () => {
      onConfirmCalled = true;
    },
  });

  assert.equal(result, null);
  assert.equal(onConfirmCalled, false);
});

test('runWizard starts over from step one when the summary says restart', async () => {
  let confirmCalls = 0;
  const decisions = ['restart', 'continue'];

  const result = await runWizard({
    steps: [step('a', ['first-pass', 'second-pass'])],
    buildSummary: (state) => [{ label: state.a }],
    confirmFn: async () => decisions[confirmCalls++],
    onConfirm: async () => {},
  });

  assert.equal(confirmCalls, 2);
  assert.deepEqual(result, { a: 'second-pass' });
});
