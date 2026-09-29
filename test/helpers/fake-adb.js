import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCRIPT = `#!/usr/bin/env node
const fs = require('node:fs');
const statePath = process.env.FAKE_ADB_STATE;
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const save = () => fs.writeFileSync(statePath, JSON.stringify(state));
let args = process.argv.slice(2);
if (args[0] === '-s') args = args.slice(2);
const fail = (msg) => { process.stderr.write(msg + '\\n'); process.exit(1); };
if (state.offline && args[0] !== 'version') fail("adb: device '" + (process.env.FAKE_ADB_TARGET || 'x') + "' not found");
const [cmd, a, b, c, d] = args;
if (cmd === 'version') { console.log('Android Debug Bridge version 1.0.41'); }
else if (cmd === 'connect') { console.log('connected to ' + a); }
else if (cmd === 'install') { state.installed.push(...(state.installOnApk || [])); save(); console.log('Success'); }
else if (cmd === 'shell' && a === 'echo') { console.log(b); }
else if (cmd === 'shell' && a === 'settings' && b === 'get') {
  const v = (state[c] || {})[d];
  console.log(v === undefined ? 'null' : v);
} else if (cmd === 'shell' && a === 'settings' && b === 'put') {
  if (state.rejectOverMax && c === 'system' && d === 'screen_off_timeout' && Number(process.argv.slice(-1)[0]) > 2147460000) fail('java.lang.IllegalArgumentException: value too large');
  state[c] = state[c] || {}; state[c][d] = process.argv.slice(-1)[0]; save();
} else if (cmd === 'shell' && a === 'settings' && b === 'list') {
  for (const [k, v] of Object.entries(state[c] || {})) console.log(k + '=' + v);
} else if (cmd === 'shell' && a === 'pm' && b === 'list') {
  for (const p of state.installed) console.log('package:' + p);
} else if (cmd === 'shell' && a === 'pm' && b === 'uninstall') {
  if (state.installed.includes(c) && !state.stuck) { state.installed = state.installed.filter((p) => p !== c); save(); console.log('Success'); }
  else console.log('Failure [DELETE_FAILED_INTERNAL_ERROR]');
} else { fail('fake adb: unsupported ' + args.join(' ')); }
`;

export const AERIAL = 'com.neilturner.aerialviews';

/**
 * Builds a throwaway "adb" executable that keeps a fake Fire TV's settings and
 * packages in a JSON file, puts it first on PATH, and points the app's .env
 * and screensaver folders at temp locations so a test can never touch the
 * real .env, the real repo, or a real TV.
 * @param {object} [overrides] state overrides, merged over the defaults
 */
export function installFakeAdb(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'firetv-fake-'));
  const bin = path.join(dir, 'adb');
  fs.writeFileSync(bin, SCRIPT, { mode: 0o755 });
  const statePath = path.join(dir, 'state.json');
  const state = {
    secure: { 'str.auto_wake_up_enabled': '1', sleep_timeout: '840000', screensaver_components: `${AERIAL}/${AERIAL}.Dream` },
    system: { screen_off_timeout: '300000' },
    installed: [AERIAL],
    ...overrides,
  };
  const defaults = JSON.parse(JSON.stringify(state));
  fs.writeFileSync(statePath, JSON.stringify(state));

  const saved = { PATH: process.env.PATH, ...Object.fromEntries(['FAKE_ADB_STATE', 'FIRE_TV_ENV_FILE', 'FIRE_TV_SCREENSAVERS_DIR'].map((k) => [k, process.env[k]])) };
  process.env.PATH = `${dir}${path.delimiter}${process.env.PATH}`;
  process.env.FAKE_ADB_STATE = statePath;
  process.env.FIRE_TV_ENV_FILE = path.join(dir, '.env');
  process.env.FIRE_TV_SCREENSAVERS_DIR = path.join(dir, 'screensavers');

  return {
    dir,
    envFile: process.env.FIRE_TV_ENV_FILE,
    readState: () => JSON.parse(fs.readFileSync(statePath, 'utf8')),
    setState: (patch) => fs.writeFileSync(statePath, JSON.stringify({ ...JSON.parse(fs.readFileSync(statePath, 'utf8')), ...patch })),
    /** Puts the fake device back to its defaults and clears the temp .env and clones. */
    reset() {
      fs.writeFileSync(statePath, JSON.stringify(defaults));
      fs.rmSync(process.env.FIRE_TV_ENV_FILE, { recursive: true, force: true });
      fs.rmSync(process.env.FIRE_TV_SCREENSAVERS_DIR, { recursive: true, force: true });
    },
    restore() {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

/**
 * Runs fn with stdout/stderr captured, so the real output of a step can be
 * asserted on without spamming the test run.
 * @returns {Promise<{result: any, out: string}>}
 */
export async function captured(fn) {
  const chunks = [];
  const realOut = process.stdout.write.bind(process.stdout);
  const realErr = process.stderr.write.bind(process.stderr);
  // The test runner reports over stdout using non-string frames; only string
  // writes (the app's own output) are captured, everything else passes through.
  const grab = (real) => (chunk, ...rest) => {
    if (typeof chunk === 'string') {
      chunks.push(chunk);
      return true;
    }
    return real(chunk, ...rest);
  };
  process.stdout.write = grab(realOut);
  process.stderr.write = grab(realErr);
  try {
    const result = await fn();
    return { result, out: chunks.join('') };
  } finally {
    process.stdout.write = realOut;
    process.stderr.write = realErr;
  }
}
