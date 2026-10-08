import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LAUNCHER_APPS } from '../../src/launcher-registry.js';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');

/**
 * A stand-in for fetch that serves each launcher app's GitHub release. The
 * APK bytes are "pkg:<package>", which the fake adb installs as that package,
 * and the release notes carry their checksum. AT4K's pinned hash never
 * matches these bytes, so the real AT4K entry always fails its checksum.
 * Anything else throws, so nothing can reach the network.
 * @returns {typeof fetch}
 */
export function launcherFetch() {
  return async (url) => {
    const u = String(url);
    const api = u.match(/^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)\/releases\//);
    const dl = u.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/releases\/download\//);
    const app = LAUNCHER_APPS.find((a) => a.repo === (api || dl || [])[1]);
    if (!app) {
      throw new Error(`unexpected fetch in a test: ${u}`);
    }
    const bytes = `pkg:${app.pkg}`;
    if (api) {
      return Response.json({
        tag_name: app.tag,
        body: `SHA-256 (${app.asset}): ${sha(bytes)}`,
        assets: [{ name: app.asset, browser_download_url: `https://github.com/${app.repo}/releases/download/${app.tag}/${app.asset}` }],
      });
    }
    return new Response(bytes, { status: 200 });
  };
}

const WRAPPER = (realAdb) => `#!/usr/bin/env node
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2);
const rest = args[0] === '-s' ? args.slice(2) : args;
const state = JSON.parse(fs.readFileSync(process.env.FAKE_ADB_STATE, 'utf8'));
const drop = state.dropWrites || [];
if (rest[0] === 'shell' && rest[1] === 'settings' && (rest[2] === 'put' || rest[2] === 'delete') && drop.includes(rest[4])) process.exit(0);
const r = spawnSync(process.execPath, [${JSON.stringify(realAdb)}, ...args], { stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
`;

/**
 * Puts an adb in front of the fake one that silently ignores writes to any
 * setting named in state.dropWrites, like a TV that accepts a write and then
 * keeps its old value. Without dropWrites it passes everything through.
 * @param {{dir: string}} fake from installFakeAdb()
 * @returns {() => void} undo
 */
export function useDroppingAdb(fake) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'firetv-launcher-adb-'));
  fs.writeFileSync(path.join(dir, 'adb'), WRAPPER(path.join(fake.dir, 'adb')), { mode: 0o755 });
  const savedPath = process.env.PATH;
  process.env.PATH = `${dir}${path.delimiter}${savedPath}`;
  return () => {
    process.env.PATH = savedPath;
    fs.rmSync(dir, { recursive: true, force: true });
  };
}

/**
 * A PATH for drive() holding the fake adb, node, and a fake npm that only
 * records its arguments and succeeds, so the "commands unlinked" path can be
 * covered without a real npm.
 * @param {{dir: string}} fake from installFakeAdb()
 * @returns {{PATH: string, npmCalls: () => string[], cleanup: () => void}}
 */
export function pathWithFakeNpm(fake) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'firetv-launcher-npm-'));
  const log = path.join(dir, 'npm-calls');
  fs.symlinkSync(process.execPath, path.join(dir, 'node'));
  fs.writeFileSync(path.join(dir, 'npm'), `#!/bin/sh\necho "$@" >> '${log}'\nexit 0\n`, { mode: 0o755 });
  return {
    PATH: `${fake.dir}${path.delimiter}${dir}`,
    npmCalls: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean) : []),
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}
