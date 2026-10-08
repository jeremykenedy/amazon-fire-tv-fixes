import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

test('setup.js imports only Node built-ins, directly or through local modules, so it can run on a fresh clone before npm install', () => {
  const seen = new Set();
  const check = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    const specifiers = [...source.matchAll(/^import\s.+?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    assert.ok(specifiers.length > 0, `${path.relative(root, file)} has no imports to check`);
    for (const spec of specifiers) {
      if (spec.startsWith('./') || spec.startsWith('../')) {
        check(path.join(path.dirname(file), spec));
        continue;
      }
      assert.ok(spec.startsWith('node:'), `${path.relative(root, file)} statically imports "${spec}", which needs node_modules`);
    }
  };
  check(path.join(root, 'setup.js'));
  assert.ok(seen.size > 1);
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
