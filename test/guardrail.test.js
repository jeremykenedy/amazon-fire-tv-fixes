import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enforceGuardrail } from '../src/guardrail.js';

test('a non-risky action is always allowed and never prompts', async () => {
  const promptFn = async () => {
    throw new Error('should not be called');
  };
  const allowed = await enforceGuardrail({ risky: false, warning: 'unused', force: false, interactive: true, promptFn });
  assert.equal(allowed, true);
});

test('risky with --force is allowed without prompting', async () => {
  const promptFn = async () => {
    throw new Error('should not be called');
  };
  const allowed = await enforceGuardrail({ risky: true, warning: 'careful', force: true, interactive: true, promptFn });
  assert.equal(allowed, true);
});

test('risky, non-interactive, no --force is refused without prompting', async () => {
  const promptFn = async () => {
    throw new Error('should not be called');
  };
  const allowed = await enforceGuardrail({ risky: true, warning: 'careful', force: false, interactive: false, promptFn });
  assert.equal(allowed, false);
  // A non-interactive refusal is a failure scripts must be able to see.
  assert.equal(process.exitCode, 1);
  process.exitCode = 0;
});

test('risky, interactive, no --force is allowed when the user types yes', async () => {
  const promptFn = async () => 'yes';
  const allowed = await enforceGuardrail({ risky: true, warning: 'careful', force: false, interactive: true, promptFn });
  assert.equal(allowed, true);
});

test('risky, interactive, no --force is refused for anything other than a literal yes', async () => {
  const promptFn = async () => 'no';
  const allowed = await enforceGuardrail({ risky: true, warning: 'careful', force: false, interactive: true, promptFn });
  assert.equal(allowed, false);
});
