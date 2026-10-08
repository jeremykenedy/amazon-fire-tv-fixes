// This file must only import Node built-ins. setup.js runs it on a fresh
// clone before anything is installed (see test/packaging.test.js).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { format } from 'node:util';

const print = (...args) => process.stdout.write(`${format(...args)}\n`);
const printError = (...args) => process.stderr.write(`${format(...args)}\n`);

/**
 * @param {string} root the package directory holding package.json
 * @returns {string[]} dependencies with no folder under node_modules
 */
export function missingDependencies(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  return Object.keys(pkg.dependencies || {}).filter((name) => !fs.existsSync(path.join(root, 'node_modules', name)));
}

/**
 * Offers to run "npm install" when dependencies are missing. Esc or a closed
 * input cancels, "n" or "q" declines; each of those exits the process.
 * The io options exist so tests can supply streams, exit and the runner.
 * @param {string} root
 * @param {{input?: NodeJS.ReadableStream, output?: NodeJS.WritableStream, exit?: (code: number) => void, run?: typeof execFileSync}} [io]
 * @returns {Promise<boolean>} true when nothing was missing or npm install succeeded
 */
export async function ensureDependencies(root, { input = process.stdin, output = process.stdout, exit = (code) => process.exit(code), run = execFileSync } = {}) {
  const missing = missingDependencies(root);
  if (missing.length === 0) {
    return true;
  }

  print('\nFire TV Toolkit needs to install its dependencies before it can start.');
  print(`Missing: ${missing.join(', ')}\n`);

  const rl = readline.createInterface({ input, output });
  const asking = new AbortController();
  let settled = false;
  const cancel = (code) => {
    if (settled) {
      return;
    }
    settled = true;
    asking.abort();
    rl.close();
    print('\n\nCancelled. No changes were made.\n');
    exit(code);
  };
  rl.input.on('keypress', (_chunk, key) => {
    if (key?.name === 'escape') {
      cancel(0);
    }
  });
  rl.once('close', () => cancel(130));

  let answer;
  try {
    answer = (await rl.question('Run "npm install" now? [Y/n/q] ', { signal: asking.signal })).trim().toLowerCase();
  } catch {
    cancel(130);
    return false;
  }
  settled = true;
  rl.close();

  if (['n', 'q', 'no', 'quit'].includes(answer)) {
    print('\nNo changes were made. Run "npm install" yourself, then run this again.\n');
    exit(0);
    return false;
  }

  try {
    run('npm', ['install'], { cwd: root, stdio: 'inherit' });
  } catch {
    printError('\nnpm install failed. Fix the error above, then run this again.\n');
    exit(1);
    return false;
  }
  return true;
}
