import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFlags, FlagError, hasChoiceFlags } from '../src/cli-args.js';

test('parseFlags reads boolean and string flags', () => {
  const spec = { yes: { type: 'boolean' }, set: { type: 'string' } };
  const values = parseFlags(spec, ['--yes', '--set', 'aerial']);
  assert.deepEqual({ ...values }, { yes: true, set: 'aerial' });
});

test('parseFlags returns an empty object when no flags are given', () => {
  const spec = { yes: { type: 'boolean' } };
  assert.deepEqual({ ...parseFlags(spec, []) }, {});
});

test('parseFlags rejects a value outside the allowed choices', () => {
  const spec = { set: { type: 'string', choices: ['aerial', 'snoozy'] } };
  assert.throws(() => parseFlags(spec, ['--set', 'bogus']), (err) => {
    assert.ok(err instanceof FlagError);
    assert.match(err.message, /must be one of: aerial, snoozy/);
    return true;
  });
});

test('parseFlags accepts a value that is in the allowed choices', () => {
  const spec = { set: { type: 'string', choices: ['aerial', 'snoozy'] } };
  assert.deepEqual({ ...parseFlags(spec, ['--set', 'snoozy']) }, { set: 'snoozy' });
});

test('parseFlags runs a custom validate function and surfaces its message', () => {
  const spec = {
    install: {
      type: 'string',
      validate: (value) => (value.includes('bad') ? 'no bad ids allowed' : null),
    },
  };
  assert.throws(() => parseFlags(spec, ['--install', 'bad-one']), /no bad ids allowed/);
  assert.deepEqual({ ...parseFlags(spec, ['--install', 'good-one']) }, { install: 'good-one' });
});

test('parseFlags throws FlagError on an unknown flag instead of silently ignoring it', () => {
  const spec = { yes: { type: 'boolean' } };
  assert.throws(() => parseFlags(spec, ['--nope']), (err) => err instanceof FlagError);
});

test('hasChoiceFlags is true only when one of the named choice flags was passed', () => {
  assert.equal(hasChoiceFlags({ install: 'aerial' }, ['install', 'uninstall']), true);
  assert.equal(hasChoiceFlags({ yes: true }, ['install', 'uninstall']), false);
  assert.equal(hasChoiceFlags({}, ['install', 'uninstall']), false);
});
