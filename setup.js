#!/usr/bin/env node
// This file must only import Node built-ins. On a fresh clone nothing is
// installed yet, and this is the script that installs it, so importing any
// dependency here would crash before it could.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

function missingDependencies() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  return Object.keys(pkg.dependencies || {}).filter((name) => !fs.existsSync(path.join(ROOT, 'node_modules', name)));
}

async function ensureDependencies() {
  const missing = missingDependencies();
  if (missing.length === 0) return;

  console.log('\nFire TV Tools needs to install its dependencies before it can start.');
  console.log(`Missing: ${missing.join(', ')}\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.input.on('keypress', (_chunk, key) => {
    if (key && key.name === 'escape') {
      rl.close();
      console.log('\n\nCancelled. No changes were made.\n');
      process.exit(0);
    }
  });
  let answered = false;
  rl.once('close', () => {
    if (answered) return;
    console.log('\n\nCancelled. No changes were made.\n');
    process.exit(130);
  });
  let answer;
  try {
    answer = (await rl.question('Run "npm install" now? [Y/n/q] ')).trim().toLowerCase();
  } catch {
    console.log('\n\nCancelled. No changes were made.\n');
    process.exit(130);
  }
  answered = true;
  rl.close();

  if (['n', 'q', 'no', 'quit'].includes(answer)) {
    console.log('\nNo changes were made. Run "npm install" yourself, then run this again.\n');
    process.exit(0);
  }

  try {
    execFileSync('npm', ['install'], { cwd: ROOT, stdio: 'inherit' });
  } catch {
    console.error('\nnpm install failed. Fix the error above, then run this again.\n');
    process.exit(1);
  }
}

await ensureDependencies();
const { runSetup } = await import('./src/setup-flow.js');
await runSetup();
