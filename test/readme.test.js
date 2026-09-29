import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { COMMANDS } from '../src/command-list.js';

const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');

test('README mentions every command the package installs', () => {
  const missing = COMMANDS.map((c) => c.name).filter((name) => !readme.includes(name));
  assert.deepEqual(missing, []);
});
