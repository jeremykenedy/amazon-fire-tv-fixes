import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cancellableOnEsc } from '../src/prompts.js';

// A stand-in prompt that waits for an answer or for its abort signal.
function fakePrompt() {
  return (config, context) =>
    new Promise((resolve, reject) => {
      context.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortPromptError' })));
      fakePrompt.answer = resolve;
    });
}

test('Esc aborts a waiting prompt, which rejects as AbortPromptError', async () => {
  const wrapped = cancellableOnEsc(fakePrompt());
  const pending = wrapped({});
  process.stdin.emit('keypress', '\u001b', { name: 'escape' });
  await assert.rejects(pending, { name: 'AbortPromptError' });
});

test('other keys do not abort the prompt, and it still resolves normally', async () => {
  const wrapped = cancellableOnEsc(fakePrompt());
  const pending = wrapped({});
  process.stdin.emit('keypress', 'a', { name: 'a' });
  process.stdin.emit('keypress', '\u001b[A', { name: 'up' });
  fakePrompt.answer('done');
  assert.equal(await pending, 'done');
});

test('the Esc listener is removed once the prompt settles, so Esc does nothing afterwards', async () => {
  const before = process.stdin.listenerCount('keypress');
  const wrapped = cancellableOnEsc(fakePrompt());
  const pending = wrapped({});
  assert.equal(process.stdin.listenerCount('keypress'), before + 1);
  fakePrompt.answer('x');
  await pending;
  assert.equal(process.stdin.listenerCount('keypress'), before);
});
