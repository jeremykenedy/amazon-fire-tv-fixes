import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setEnvPathForTesting } from '../../src/device-config.js';
import { setScreensaversDirForTesting } from '../../src/apply/screensavers.js';


const SCRIPT = `#!/usr/bin/env node
const fs = require('node:fs');
const statePath = process.env.FAKE_ADB_STATE;
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const save = () => fs.writeFileSync(statePath, JSON.stringify(state));
let args = process.argv.slice(2);
if (args[0] === '-s') args = args.slice(2);
const fail = (msg) => { process.stderr.write(msg + '\\n'); process.exit(1); };
if (state.offline && args[0] !== 'version') fail("adb: device '" + (process.env.FAKE_ADB_TARGET || 'x') + "' not found");
// state.offlineIps: only these TV addresses are unreachable.
const host = (process.argv[2] === '-s' ? process.argv[3] : args[0] === 'connect' ? args[1] : '') || '';
if ((state.offlineIps || []).includes(host.split(':')[0])) fail("adb: device '" + host + "' not found");
const [cmd, a, b, c, d] = args;
if (cmd === 'version') { console.log('Android Debug Bridge version 1.0.41'); }
else if (cmd === 'connect') { console.log('connected to ' + a); }
else if (cmd === 'install') {
  state.lastInstallPath = args[args.length - 1]; save();
  if (state.installFail) fail(state.installFail);
  // A test APK may name its own package as "pkg:<name>"; otherwise use installOnApk.
  const body = fs.readFileSync(args[args.length - 1], 'utf8');
  const named = body.startsWith('pkg:') ? [body.slice(4).trim()] : state.installOnApk || [];
  for (const p of named) if (!state.installed.includes(p)) state.installed.push(p);
  // Like Android dropping an updated accessibility app from the enabled list.
  if (state.dropServicesOnInstall && state.secure) delete state.secure.enabled_accessibility_services;
  save(); console.log('Success');
}
else if (cmd === 'shell' && a === 'input') { console.log(''); }
else if (cmd === 'shell' && a === 'monkey') { console.log('Events injected: 1'); }
else if (cmd === 'shell' && a === 'settings' && b === 'delete') {
  if (state[c]) delete state[c][d];
  save(); console.log('Deleted 1 rows');
}
else if (cmd === 'shell' && a === 'pm' && b === 'enable') {
  if (!state.installed.includes(c)) fail('Error: Unknown package: ' + c);
  state.disabled = (state.disabled || []).filter((p) => p !== c); save(); console.log('Package ' + c + ' new state: enabled');
}
else if (cmd === 'shell' && a === 'pm' && b === 'grant') {
  state.grants = state.grants || {}; state.grants[c] = [...(state.grants[c] || []), d]; save();
}
else if (cmd === 'shell' && a === 'appops' && b === 'get') {
  const mode = ((state.appops || {})[c] || {})[d];
  console.log(mode ? d + ': ' + mode + '; time=+1d' : 'No operations.');
}
else if (cmd === 'shell' && a === 'appops' && b === 'set') {
  if ((state.lockedKeys || []).includes(d)) { process.exit(0); }
  state.appops = state.appops || {}; state.appops[c] = { ...(state.appops[c] || {}), [d]: process.argv.slice(-1)[0] };
  if (process.argv.slice(-1)[0] === 'default') delete state.appops[c][d];
  save();
}
else if (cmd === 'shell' && a === 'am' && b === 'broadcast') {
  // The guard in Home Redirect: replies only when Home Redirect is installed.
  const extra = (name) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
  if (!state.installed.includes('com.jeremykenedy.firetv.homeredirect')) { console.log('Broadcasting: Intent\\nBroadcast completed: result=0'); }
  else {
    const g = state.guard = state.guard || { locked: false, remembered: {} };
    const cmdName = extra('cmd');
    let reply = 'unknown';
    if (cmdName === 'lock') { g.locked = true; g.forgotten = []; reply = state.guardReply || 'locked'; }
    else if (cmdName === 'unlock') { g.locked = false; reply = state.guardReply || 'unlocked'; }
    else if (cmdName === 'remember') { g.remembered[extra('setting')] = extra('value'); reply = 'remembered'; }
    else if (cmdName === 'forget') { g.forgotten = [...(g.forgotten || []), extra('setting')]; reply = state.forgetReply || 'forgotten'; }
    else if (cmdName === 'check') { reply = state.guardReply || 'guard=' + (g.locked ? 'on' : 'off') + ' restored=' + (state.guardRestored || 'none'); }
    save(); console.log('Broadcasting: Intent\\nBroadcast completed: result=0, data="' + reply + '"');
  }
}
else if (cmd === 'shell' && a === 'dumpsys' && b === 'package') {
  const v = (state.versions || {})[c];
  console.log(state.installed.includes(c) ? 'Packages:\\n    versionName=' + (v || '1.0.0') : 'Unable to find package: ' + c);
}
else if (cmd === 'shell' && a === 'pm' && b === 'disable-user') {
  const pkg = args[args.length - 1];
  if ((state.protectedPkgs || []).includes(pkg)) fail('java.lang.SecurityException: Cannot disable a protected package: ' + pkg);
  if (!(state.lockedKeys || []).includes(pkg)) { state.disabled = [...new Set([...(state.disabled || []), pkg])]; save(); }
  console.log('Package ' + pkg + ' new state: disabled-user');
}
else if (cmd === 'shell' && a === 'echo') { console.log(state.echoReply === undefined ? b : state.echoReply); }
else if (cmd === 'shell' && a === 'settings' && b === 'get') {
  const v = (state[c] || {})[d];
  console.log(v === undefined ? 'null' : v);
} else if (cmd === 'shell' && a === 'settings' && b === 'put') {
  if (state.rejectOverMax && c === 'system' && d === 'screen_off_timeout' && Number(process.argv.slice(-1)[0]) > 2147460000) fail('java.lang.IllegalArgumentException: value too large');
  // lockedKeys: the TV takes the write without error but nothing changes.
  if ((state.lockedKeys || []).includes(d)) { process.exit(0); }
  state[c] = state[c] || {}; state[c][d] = process.argv.slice(-1)[0]; save();
} else if (cmd === 'shell' && a === 'settings' && b === 'list') {
  for (const [k, v] of Object.entries(state[c] || {})) console.log(k + '=' + v);
} else if (cmd === 'shell' && a === 'pm' && b === 'list') {
  const only = args.includes('-d') ? state.disabled || [] : state.installed;
  for (const p of only) console.log('package:' + p);
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

  const saved = { PATH: process.env.PATH, ...Object.fromEntries(['FAKE_ADB_STATE', 'FIRE_TV_TEST_ENV_FILE', 'FIRE_TV_TEST_SCREENSAVERS_DIR', 'ANDROID_ADB_SERVER_PORT'].map((k) => [k, process.env[k]])) };
  process.env.PATH = `${dir}${path.delimiter}${process.env.PATH}`;
  process.env.FAKE_ADB_STATE = statePath;
  // Safety net: if a real adb is ever reached by mistake, point it at a port
  // no adb server listens on, so it can never talk to a real TV.
  process.env.ANDROID_ADB_SERVER_PORT = '1';
  process.env.FIRE_TV_TEST_ENV_FILE = path.join(dir, '.env');
  process.env.FIRE_TV_TEST_SCREENSAVERS_DIR = path.join(dir, 'screensavers');
  setEnvPathForTesting(process.env.FIRE_TV_TEST_ENV_FILE);
  setScreensaversDirForTesting(process.env.FIRE_TV_TEST_SCREENSAVERS_DIR);

  return {
    dir,
    envFile: process.env.FIRE_TV_TEST_ENV_FILE,
    readState: () => JSON.parse(fs.readFileSync(statePath, 'utf8')),
    setState: (patch) => fs.writeFileSync(statePath, JSON.stringify({ ...JSON.parse(fs.readFileSync(statePath, 'utf8')), ...patch })),
    /** Puts the fake device back to its defaults and clears the temp .env and clones. */
    reset() {
      fs.writeFileSync(statePath, JSON.stringify(defaults));
      fs.rmSync(process.env.FIRE_TV_TEST_ENV_FILE, { recursive: true, force: true });
      fs.rmSync(process.env.FIRE_TV_TEST_SCREENSAVERS_DIR, { recursive: true, force: true });
    },
    restore() {
      setEnvPathForTesting(null);
      setScreensaversDirForTesting(null);
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
