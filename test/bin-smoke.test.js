import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Gives each child the throwaway .env and clone folder (test/helpers/test-paths.js).
const PRELOAD = path.join(ROOT, 'test', 'helpers', 'test-paths.js');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const bins = [...new Set(Object.values(pkg.bin))];

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'firetv-bin-'));
// PATH holds only a symlink to node: no adb (so nothing can reach a real TV)
// and no npm (so nothing can unlink the real global commands).
const onlyNode = path.join(scratch, 'bin');
fs.mkdirSync(onlyNode);
fs.symlinkSync(process.execPath, path.join(onlyNode, 'node'));
// Every child also gets a throwaway .env, never the real one.
const childEnv = {
  ...process.env,
  FIRE_TV_TEST_ENV_FILE: path.join(scratch, '.env'),
  FIRE_TV_TEST_SCREENSAVERS_DIR: path.join(scratch, 'screensavers'),
  PATH: onlyNode,
  NO_COLOR: '1',
};

function run(bin, args, extraEnv = {}) {
  return spawnSync(process.execPath, ['--import', PRELOAD, path.join(ROOT, bin), ...args], {
    env: { ...childEnv, ...extraEnv },
    encoding: 'utf8',
    timeout: 20000,
    input: '',
  });
}

test('every command prints its usage for --help and exits 0', () => {
  for (const bin of bins) {
    const r = run(bin, ['--help']);
    assert.equal(r.status, 0, `${bin} --help exited ${r.status}: ${r.stderr}`);
    assert.match(r.stdout, /Usage:/, `${bin} --help printed no usage`);
  }
});

test('every command rejects an unknown flag with a non-zero exit', () => {
  for (const bin of bins) {
    const r = run(bin, ['--definitely-not-a-flag']);
    assert.equal(r.status, 1, `${bin} accepted an unknown flag`);
  }
});

test('device commands refuse to run before setup, and say how to start', () => {
  const gated = bins.filter((b) => !/(amazon-fire-tv-fixes|start|update|info|information|guide|firetv|uninstall|delete|remove|firetv-install-adb)\.js$/.test(b));
  assert.ok(gated.length >= 10);
  for (const bin of gated) {
    const r = run(bin, []);
    assert.equal(r.status, 1, `${bin} ran without setup`);
    assert.match(r.stdout + r.stderr, /start/i);
  }
});

test('info lists only start until setup is done', () => {
  const r = run('bin/info.js', []);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /not installed yet/);
  assert.doesNotMatch(r.stdout, /enable-alexa-fix/);
});

test('info lists every command once setup is done', () => {
  fs.writeFileSync(childEnv.FIRE_TV_TEST_ENV_FILE, 'FIRE_TV_IP=192.168.1.49\nINSTALLED=true\n');
  const r = run('bin/info.js', []);
  fs.rmSync(childEnv.FIRE_TV_TEST_ENV_FILE, { force: true });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /enable-alexa-fix/);
  assert.match(r.stdout, /firetv-timeouts-reset/);
});

test('uninstall on a not-installed setup fails to unlink without npm instead of crashing', () => {
  const r = run('bin/uninstall.js', []);
  assert.doesNotMatch(r.stderr, /Something went wrong/);
  assert.match(r.stdout, /not installed/i);
});

test('a runtime error prints a friendly message and exits 1, with the stack only under DEBUG', () => {
  const script = `import('${path.join(ROOT, 'src/cli-runtime.js').replace(/\\/g, '/')}').then((m) => { m.installCliRuntime(); throw new Error('boom'); });`;
  const plain = spawnSync(process.execPath, ['-e', script], { env: childEnv, encoding: 'utf8', timeout: 20000 });
  assert.equal(plain.status, 1);
  assert.match(plain.stderr, /Something went wrong: boom/);
  assert.doesNotMatch(plain.stderr, /at .*cli-runtime/);
  const debug = spawnSync(process.execPath, ['-e', script], { env: { ...childEnv, DEBUG: '1' }, encoding: 'utf8', timeout: 20000 });
  assert.match(debug.stderr, /Error: boom/);
});

test('setup.js runs with only Node built-ins on PATH and declines cleanly with no input', () => {
  const r = spawnSync(process.execPath, ['--import', PRELOAD, path.join(ROOT, 'setup.js')], { env: childEnv, encoding: 'utf8', timeout: 20000, input: '' });
  assert.doesNotMatch(r.stderr, /Cannot find package/);
});

test('environment variables cannot redirect where .env or the clones are written', () => {
  const script = `Promise.all([import('${path.join(ROOT, 'src/device-config.js')}'), import('${path.join(ROOT, 'src/apply/screensavers.js')}')]).then(([d, s]) => console.log(JSON.stringify([d.ENV_PATH, s.SCREENSAVERS_DIR])));`;
  const r = spawnSync(process.execPath, ['-e', script], {
    env: { ...process.env, FIRE_TV_ENV_FILE: '/tmp/elsewhere/.env', FIRE_TV_SCREENSAVERS_DIR: '/tmp/elsewhere/clones', FIRE_TV_TEST_ENV_FILE: '/tmp/elsewhere/.env' },
    encoding: 'utf8',
    timeout: 20000,
  });
  assert.deepEqual(JSON.parse(r.stdout), [path.join(ROOT, '.env'), path.join(ROOT, 'screensavers')]);
});
