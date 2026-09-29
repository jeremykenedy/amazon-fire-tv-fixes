import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

test('setup.js imports only Node built-ins, so it can run on a fresh clone before npm install', () => {
  const source = readFileSync(path.join(root, 'setup.js'), 'utf8');
  const specifiers = [...source.matchAll(/^import\s.+?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  assert.ok(specifiers.length > 0);
  for (const spec of specifiers) {
    assert.ok(spec.startsWith('node:'), `setup.js statically imports "${spec}", which needs node_modules`);
  }
});

test('every bin entry points at a real file with a node shebang', () => {
  for (const [name, target] of Object.entries(pkg.bin)) {
    const file = path.join(root, target);
    assert.ok(existsSync(file), `${name} -> ${target} does not exist`);
    assert.ok(readFileSync(file, 'utf8').startsWith('#!/usr/bin/env node'), `${name} is missing its shebang`);
  }
});

test('files that setup.js and uninstall need at runtime are included in the published package', () => {
  for (const needed of ['setup.js', '.env.example', 'bin', 'src']) {
    assert.ok(pkg.files.includes(needed), `package.json "files" is missing ${needed}`);
  }
});
