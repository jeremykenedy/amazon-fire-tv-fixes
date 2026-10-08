import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installFakeAdb, captured } from './helpers/fake-adb.js';
import { drive, DOWN, ENTER } from './helpers/drive.js';
import { banner } from '../src/ui.js';
import { withBack, BACK } from '../src/wizard.js';
import { parseFlags, exitOnFlagError, HelpRequested } from '../src/cli-args.js';
import { startSpinner } from '../src/spinner.js';
import { enableAlexaFix, disableAlexaFix } from '../src/steps/alexa-fix.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const HARNESS = 'test/helpers/ui-harness.js';
const IP = '192.0.2.10';

let fake;

before(() => {
  fake = installFakeAdb();
});

beforeEach(() => {
  fake.reset();
  process.exitCode = undefined;
});

after(() => {
  fake.restore();
  process.exitCode = undefined;
});

function setAlexa(value) {
  fake.setState({ secure: { ...fake.readState().secure, 'str.auto_wake_up_enabled': value } });
}

/**
 * Puts an adb in front of the fake one that accepts writes to one setting
 * without saving them, so a read back shows the write did not take.
 * @returns {() => void} undoes it
 */
function ignoreWritesTo(namespace, key) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'firetv-sticky-'));
  const script = `#!/usr/bin/env node
const { execFileSync } = require('node:child_process');
const args = process.argv.slice(2);
const at = args.indexOf('put');
if (at !== -1 && args[at + 1] === ${JSON.stringify(namespace)} && args[at + 2] === ${JSON.stringify(key)}) process.exit(0);
try {
  process.stdout.write(execFileSync(${JSON.stringify(path.join(fake.dir, 'adb'))}, args, { encoding: 'utf8' }));
} catch (err) {
  process.stderr.write(String(err.stderr || ''));
  process.exit(err.status || 1);
}
`;
  fs.writeFileSync(path.join(dir, 'adb'), script, { mode: 0o755 });
  const savedPath = process.env.PATH;
  process.env.PATH = `${dir}${path.delimiter}${savedPath}`;
  return () => {
    process.env.PATH = savedPath;
    fs.rmSync(dir, { recursive: true, force: true });
  };
}

test('banner prints the app name in a box', async () => {
  const { out } = await captured(() => banner());
  assert.match(out, /fire-tv-toolkit/);
  assert.match(out, /Alexa deep-sleep fix/);
});

test('withBack puts Back first only when asked', () => {
  const choices = [{ name: 'A', value: 'a' }];
  assert.deepEqual(withBack(choices, false), choices);
  assert.deepEqual(withBack(choices, true), [{ name: '< Back', value: BACK }, ...choices]);
});

test('exitOnFlagError rethrows anything that is not a flag problem', () => {
  assert.throws(() => exitOnFlagError(new Error('real bug'), 'example'), /real bug/);
});

test('--help still builds usage when argv has no script path', () => {
  const saved = process.argv[1];
  process.argv[1] = undefined;
  try {
    assert.throws(() => parseFlags({}, ['--help']), (err) => err instanceof HelpRequested && /^Usage: \n/.test(err.message));
  } finally {
    process.argv[1] = saved;
  }
});

test('spinner does not animate on a TTY that reports zero columns', async () => {
  const saved = {
    isTTY: Object.getOwnPropertyDescriptor(process.stderr, 'isTTY'),
    columns: Object.getOwnPropertyDescriptor(process.stderr, 'columns'),
  };
  Object.defineProperty(process.stderr, 'isTTY', { value: true, configurable: true, writable: true });
  Object.defineProperty(process.stderr, 'columns', { value: 0, configurable: true, writable: true });
  try {
    const { result: spinner } = await captured(() => startSpinner('Working', { quiet: true }));
    assert.equal(spinner.isEnabled, false);
    assert.equal(spinner.isSilent, false);
    spinner.stop();
  } finally {
    for (const [name, desc] of Object.entries(saved)) {
      if (desc) Object.defineProperty(process.stderr, name, desc);
      else delete process.stderr[name];
    }
  }
});

test('single-key prompts: y, newline, Enter and q', async () => {
  const r = await drive(HARNESS, ['keys'], [
    { expect: 'First? [y/N]', send: 'y' },
    { expect: 'Second? [y/N]', send: '\n' },
    { expect: 'Third? [Y/n/q]', send: ENTER },
    { expect: 'Fourth? [Y/n/q]', send: 'q' },
  ]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /first=true[\s\S]*second=false[\s\S]*third=true[\s\S]*fourth=false/);
});

test('Ctrl-C at a single-key prompt cancels with exit 130', async () => {
  const r = await drive(HARNESS, ['one'], [{ expect: 'Sure? [y/N]', send: '\u0003' }]);
  assert.equal(r.code, 130, r.out);
  assert.match(r.out, /Cancelled\./);
  assert.doesNotMatch(r.out, /answer=/);
});

test('Esc at a single-key prompt cancels with exit 0 and restores raw mode', async () => {
  const r = await drive(HARNESS, ['one', '--raw'], [{ expect: 'Sure? [y/N]', send: '\u001b' }]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Cancelled\./);
  assert.match(r.out, /raw calls: true,false/);
});

test('a raw-mode terminal is switched back after a normal answer', async () => {
  const r = await drive(HARNESS, ['one', '--raw'], [{ expect: 'Sure? [y/N]', send: ENTER, end: true }]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /answer=false/);
  assert.match(r.out, /raw calls: true,false/);
});

test('a nested menu offers Back and Exit', async () => {
  const r = await drive(HARNESS, ['menu'], [
    { expect: 'Pick one', send: `${DOWN}${ENTER}` },
    { expect: 'Pick again', send: `${DOWN}${DOWN}${ENTER}` },
  ]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /picked=__back__/);
  assert.match(r.out, /Bye![\s\S]*picked=__exit__/);
});

function crash(body, extraEnv = {}) {
  const runtime = path.join(ROOT, 'src', 'cli-runtime.js');
  const script = `import(${JSON.stringify(runtime)}).then((m) => { m.installCliRuntime(); m.installCliRuntime(); ${body} });`;
  const env = { ...process.env, NO_COLOR: '1', ...extraEnv };
  if (!extraEnv.DEBUG) delete env.DEBUG;
  return spawnSync(process.execPath, ['-e', script], { env, encoding: 'utf8', timeout: 20000 });
}

test('Ctrl-C at an inquirer prompt exits 130 with a short message', () => {
  const r = crash("const e = new Error('closed'); e.name = 'ExitPromptError'; throw e;");
  assert.equal(r.status, 130, r.stderr);
  assert.match(r.stdout, /Cancelled\./);
});

test('Esc at an inquirer prompt exits 0 with a short message', () => {
  const r = crash("setTimeout(() => { const e = new Error('esc'); e.name = 'AbortPromptError'; throw e; });");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Cancelled\./);
});

test('a rejection with a plain value still prints a friendly message', () => {
  const plain = crash("Promise.reject('plain text');");
  assert.equal(plain.status, 1);
  assert.match(plain.stderr, /Something went wrong: plain text/);
  assert.match(plain.stderr, /DEBUG=1/);
  const empty = crash('Promise.reject(null);', { DEBUG: '1' });
  assert.equal(empty.status, 1);
  assert.match(empty.stderr, /Something went wrong: null/);
  assert.match(empty.stderr, /DEBUG=1/);
});

test('firetv, guide and information print the info screen with no flags', async () => {
  for (const bin of ['bin/firetv.js', 'bin/guide.js', 'bin/information.js']) {
    const r = await drive(bin, [], []);
    assert.equal(r.code, 0, `${bin}: ${r.out}`);
    assert.match(r.out, /not installed yet/, bin);
  }
});

test('alexa: disabling when the fix is already off changes nothing', async () => {
  setAlexa('0');
  const { out } = await captured(() => disableAlexaFix(IP, { yes: true }));
  assert.match(out, /not currently applied/);
  assert.equal(fake.readState().secure['str.auto_wake_up_enabled'], '0');
  assert.notEqual(process.exitCode, 1);
});

test('alexa: --yes without --force refuses to bring the bug back', async () => {
  const { out } = await captured(() => disableAlexaFix(IP, { yes: true }));
  assert.match(out, /Refusing to continue without --force/);
  assert.equal(fake.readState().secure['str.auto_wake_up_enabled'], '1');
  assert.equal(process.exitCode, 1);
});

test('alexa: a write the TV ignores is reported as failed, both ways', async () => {
  const undo = ignoreWritesTo('secure', 'str.auto_wake_up_enabled');
  try {
    setAlexa('0');
    const on = await captured(() => enableAlexaFix(IP, { yes: true }));
    assert.match(on.out, /The write did not take/);
    assert.equal(process.exitCode, 1);
    process.exitCode = undefined;

    setAlexa('1');
    const off = await captured(() => disableAlexaFix(IP, { yes: true, force: true }));
    assert.match(off.out, /The write did not take/);
    assert.equal(process.exitCode, 1);
  } finally {
    undo();
  }
});

test('menu: the fix toggle offers to apply it when off, and declining changes nothing', async () => {
  setAlexa('0');
  const r = await drive('bin/start.js', [], [
    { expect: 'Developer Mode and ADB debugging?', send: 'y' },
    { expect: 'IP address', send: `${IP}${ENTER}` },
    { expect: 'review or adjust TV timeout', send: 'y' },
    { expect: 'What would you like to do?', send: ` ${ENTER}` },
    { expect: 'No timeout changes', send: '' },
    { expect: 'What would you like to do?', send: `${DOWN}${ENTER}` },
    { expect: 'Apply the fix? [y/N]', send: 'n' },
    { expect: 'What would you like to do?', send: `${DOWN.repeat(6)}${ENTER}` },
  ]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Current state: fix is OFF/);
  assert.match(r.out, /Cancelled\. Nothing was changed/);
  assert.equal(fake.readState().secure['str.auto_wake_up_enabled'], '0');
  assert.equal(fake.readState().secure.sleep_timeout, '840000');
});
