import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { COMMANDS } from '../src/command-list.js';

const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');

test('README mentions every command the package installs', () => {
  const missing = COMMANDS.map((c) => c.name).filter((name) => !readme.includes(name));
  assert.deepEqual(missing, []);
});

test('README lists every screensaver with a link to its repository', async () => {
  const { SCREENSAVERS } = await import('../src/screensaver-registry.js');
  const missing = SCREENSAVERS.filter((s) => !readme.includes(`[${s.name}](https://github.com/${s.repo})`) || !readme.includes(`\`${s.id}\``));
  assert.deepEqual(missing.map((s) => s.id), []);
});
