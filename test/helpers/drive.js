import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const UP = '\x1b[A';
export const DOWN = '\x1b[B';
export const ENTER = '\r';
export const SPACE = ' ';

/**
 * Runs a command with piped stdin and answers its prompts. Each step waits for
 * `expect` (a string or regex) to appear in the output, then sends `send`.
 * PATH holds only node and the fake adb, so it can neither reach a real TV nor
 * run npm; .env and the screensaver folder are the throwaway ones from
 * installFakeAdb().
 * @param {string} bin path like 'bin/update.js'
 * @param {string[]} args
 * @param {Array<{expect: string | RegExp, send: string}>} steps
 * @param {{env?: object, timeoutMs?: number}} [options]
 * @returns {Promise<{code: number | null, out: string}>}
 */
export function drive(bin, args, steps, { env = {}, timeoutMs = 30000, noAdb = false } = {}) {
  const onlyNode = fs.mkdtempSync(path.join(os.tmpdir(), 'firetv-path-'));
  fs.symlinkSync(process.execPath, path.join(onlyNode, 'node'));
  const fakeDir = path.dirname(process.env.FAKE_ADB_STATE);
  const child = spawn(process.execPath, [path.join(ROOT, bin), ...args], {
    env: { ...process.env, PATH: noAdb ? onlyNode : `${fakeDir}${path.delimiter}${onlyNode}`, NO_COLOR: '1', FORCE_COLOR: '0', ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let out = '';
  let cursor = 0;
  let next = 0;
  const pending = { resolve: null };

  const pump = () => {
    while (next < steps.length) {
      const { expect, send } = steps[next];
      const rest = out.slice(cursor);
      const at = typeof expect === 'string' ? rest.indexOf(expect) : rest.search(expect);
      if (at === -1) return;
      const len = typeof expect === 'string' ? expect.length : rest.slice(at).match(expect)[0].length;
      cursor += at + len;
      next += 1;
      setTimeout(() => child.stdin.write(send), 60);
    }
  };
  child.stdout.on('data', (d) => { out += d; pump(); });
  child.stderr.on('data', (d) => { out += d; pump(); });

  return new Promise((resolve) => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve({ code: 'timeout', out }); }, timeoutMs);
    child.on('close', (code) => { clearTimeout(timer); fs.rmSync(onlyNode, { recursive: true, force: true }); resolve({ code, out }); });
    pending.resolve = resolve;
  });
}
