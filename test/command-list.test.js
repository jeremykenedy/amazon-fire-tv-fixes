import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { COMMANDS } from '../src/command-list.js';

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));

test('COMMANDS lists every command in package.json "bin", and nothing else', () => {
  const pkgNames = Object.keys(pkg.bin).sort();
  const listedNames = COMMANDS.map((c) => c.name).sort();
  assert.deepEqual(listedNames, pkgNames);
});

test('every COMMANDS entry has a non-empty name and description', () => {
  for (const { name, desc } of COMMANDS) {
    assert.ok(name && name.trim().length > 0);
    assert.ok(desc && desc.trim().length > 0);
  }
});
