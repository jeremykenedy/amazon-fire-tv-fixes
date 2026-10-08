import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Makes a temp folder to use as the whole PATH: a symlink to node plus fake
 * npm, brew or sudo scripts. A fake only prints its arguments and exits with
 * the code chosen for its first argument (or `default`, else 0). Nothing real
 * is ever run.
 * @param {Record<string, Record<string, number>>} [commands] e.g. { npm: { link: 1 } }
 * @returns {string} the folder
 */
export function fakeBinDir(commands = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'firetv-setup-bin-'));
  fs.symlinkSync(process.execPath, path.join(dir, 'node'));
  for (const [name, codes] of Object.entries(commands)) {
    const cases = Object.entries(codes)
      .filter(([arg]) => arg !== 'default')
      .map(([arg, code]) => `  ${arg}) code=${code};;`)
      .join('\n');
    const script = [
      '#!/bin/sh',
      `echo "fake ${name} $*"`,
      `code=${codes.default ?? 0}`,
      'case "$1" in',
      cases,
      'esac',
      `if [ "$code" != 0 ]; then echo "fake ${name} failed" >&2; fi`,
      'exit $code',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(dir, name), script, { mode: 0o755 });
  }
  return dir;
}

/**
 * A throwaway stand-in for this repository: a temp folder holding a minimal
 * package.json, so the delete flow has something safe to point at.
 * @param {{name?: string, packageJson?: string | null, envExample?: string}} [options]
 * @returns {string} the folder
 */
export function fakeCheckout({ name = 'fire-tv-toolkit', packageJson, envExample } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'firetv-setup-checkout-'));
  if (packageJson !== null) {
    fs.writeFileSync(path.join(dir, 'package.json'), packageJson ?? JSON.stringify({ name }));
  }
  if (envExample !== undefined) {
    fs.writeFileSync(path.join(dir, '.env.example'), envExample);
  }
  return dir;
}

/**
 * @param {string} dir
 * @returns {boolean} whether dir is inside the system temp folder
 */
export function isUnderTmp(dir) {
  const tmp = fs.realpathSync(os.tmpdir());
  const real = fs.existsSync(dir) ? fs.realpathSync(dir) : path.resolve(dir);
  return real.startsWith(tmp + path.sep);
}
