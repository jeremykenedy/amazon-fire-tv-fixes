import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import chalk from 'chalk';
import { startSpinner } from './spinner.js';
import { getSavedIp, saveIp, promptForIp } from './device-config.js';
import { isGuardedNow } from './guard-config.js';
import { print } from './output.js';

const execFileAsync = promisify(execFile);
const PORT = 5555;

function target(ip) {
  return `${ip}:${PORT}`;
}

// Connecting to a TV that is off or on another network is slow to fail, so
// the connect/reachability checks use a shorter limit than other adb calls.
const CONNECT_TIMEOUT_MS = 6000;

// A large APK over Wi-Fi can take much longer than an ordinary adb call.
const INSTALL_TIMEOUT_MS = 180000;

/**
 * One short line saying why an adb call failed, so a failure can be reported
 * as more than "could not reach the TV".
 * @param {any} err
 * @returns {string}
 */
export function describeAdbError(err) {
  if (err?.code === 'ENOENT') {
    return 'adb was not found on your PATH';
  }
  if (err?.killed || err?.signal === 'SIGTERM') {
    return 'adb timed out waiting for the TV';
  }
  const text = `${err?.stderr ?? ''}`.trim() || `${err?.message ?? ''}`.trim();
  return text.split('\n').findLast(Boolean) || 'adb failed with no message';
}

let lastAdbError = null;

/** @returns {string | null} why the last connect/reachability check failed */
export function getLastAdbError() {
  return lastAdbError;
}

async function run(args, { allowFail = false, timeout = 15000, remember = false } = {}) {
  try {
    const { stdout } = await execFileAsync('adb', args, { timeout });
    return stdout.trim();
  } catch (err) {
    if (remember) {
      lastAdbError = describeAdbError(err);
    }
    if (allowFail) {
      return null;
    }
    throw err;
  }
}

/** @returns {Promise<boolean>} */
export async function isAdbInstalled() {
  try {
    await execFileAsync('adb', ['version']);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} ip
 * @returns {Promise<string | null>}
 */
export async function connect(ip) {
  return run(['connect', target(ip)], { allowFail: true, timeout: CONNECT_TIMEOUT_MS });
}

/**
 * @param {string} ip
 * @returns {Promise<boolean>}
 */
export async function isReachable(ip) {
  lastAdbError = null;
  const out = await run(['-s', target(ip), 'shell', 'echo', 'ok'], { allowFail: true, timeout: CONNECT_TIMEOUT_MS, remember: true });
  return out === 'ok';
}

/**
 * Connects to the TV and checks it answers, with a spinner so a slow or
 * unreachable TV does not look like a hang. Leaves nothing on screen when it
 * works; the caller prints its own failure message.
 * @param {string} ip
 * @returns {Promise<boolean>}
 */
export async function connectAndCheck(ip) {
  const spinner = startSpinner(`Connecting to ${ip}...`, { quiet: true });
  await connect(ip);
  const reachable = await isReachable(ip);
  spinner.stop();
  return reachable;
}

/**
 * Resolves a working device IP: tries the saved one first, and if it's
 * missing or unreachable, prompts for one (looping until a reachable IP
 * is entered or the user exits via Ctrl+C). Saves the working IP so the
 * next run of any command in this tool doesn't ask again.
 * @returns {Promise<string>} the working IP
 */
export async function ensureConnected() {
  if (!(await isAdbInstalled())) {
    print(chalk.red('\nadb (Android SDK Platform Tools) is not installed, so this cannot talk to your TV.'));
    print(chalk.gray('Run ') + chalk.green('firetv-install-adb') + chalk.gray(' to install it, then try again.\n'));
    process.exit(1);
  }

  let ip = getSavedIp();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (!ip && !process.stdin.isTTY) {
      print(chalk.red('\nNo saved Fire TV IP and no terminal to ask for one. Run start interactively first.\n'));
      process.exit(1);
    }
    if (!ip) {
      ip = await promptForIp();
    }

    if (await connectAndCheck(ip)) {
      saveIp(ip);
      return ip;
    }

    print(chalk.red(`\nCouldn't reach a Fire TV at ${ip}:${PORT}.`));
    if (getLastAdbError()) {
      print(chalk.gray(`adb said: ${getLastAdbError()}`));
    }
    print(chalk.gray('Make sure ADB debugging is on and you accepted the pairing prompt on the TV.\n'));
    if (!process.stdin.isTTY) {
      process.exit(1);
    }
    ip = await promptForIp(ip);
  }
}

/**
 * @param {string} ip
 * @param {string} namespace
 * @param {string} key
 * @returns {Promise<string | null>}
 */
export async function getSetting(ip, namespace, key) {
  return run(['-s', target(ip), 'shell', 'settings', 'get', namespace, key]);
}

/**
 * @param {string} ip
 * @param {string} namespace
 * @param {string} key
 * @param {string | number} value
 * @returns {Promise<string | null>}
 */
export async function putSetting(ip, namespace, key, value) {
  await rememberIfGuarded(ip, namespace, key, String(value));
  const protectedSetting = namespace === 'secure'
    ? ['sleep_timeout', 'screensaver_components', 'screensaver_enabled', 'str.auto_wake_up_enabled'].includes(key)
    : namespace === 'system' && key === 'screen_off_timeout';
  const pkg = 'com.jeremykenedy.firetv.ui';
  if (protectedSetting && (await listPackages(ip)).includes(pkg)) {
    const out = await run(['-s', target(ip), 'shell', 'am', 'broadcast', '--include-stopped-packages',
      '-n', `${pkg}/.BackupReceiver`, '-a', `${pkg}.BACKUP`, '--es', 'operation', 'setting',
      '--es', 'namespace', namespace, '--es', 'key', key, '--es', 'value', String(value)]);
    if (!/Broadcast completed: result=0, data="ok"/.test(out)) {
      throw new Error(out.split('\n').find((line) => line.startsWith('Broadcast completed:'))
        || 'The TV did not save the setting.');
    }
    return out;
  }
  return run(['-s', target(ip), 'shell', 'settings', 'put', namespace, key, String(value)]);
}

/**
 * @param {string} ip
 * @param {string} namespace
 * @param {string} key
 * @returns {Promise<string | null>}
 */
export async function deleteSetting(ip, namespace, key) {
  await rememberIfGuarded(ip, namespace, key, 'null');
  return run(['-s', target(ip), 'shell', 'settings', 'delete', namespace, key]);
}

/**
 * @param {string} ip
 * @param {string} namespace
 * @returns {Promise<string[]>} raw "key=value" lines for every setting in that namespace
 */
export async function listSettings(ip, namespace) {
  const out = await run(['-s', target(ip), 'shell', 'settings', 'list', namespace]);
  return (out || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * @param {string} ip
 * @returns {Promise<string[]>} installed package names
 */
export async function listPackages(ip) {
  const out = await run(['-s', target(ip), 'shell', 'pm', 'list', 'packages']);
  return (out || '')
    .split('\n')
    .map((line) => line.replace(/^package:/, '').trim())
    .filter(Boolean);
}

/**
 * @param {string} ip
 * @returns {Promise<string[]>} names of installed packages that are switched off on the TV
 */
export async function listDisabledPackages(ip) {
  const out = await run(['-s', target(ip), 'shell', 'pm', 'list', 'packages', '-d']);
  return (out || '')
    .split('\n')
    .map((line) => line.replace(/^package:/, '').trim())
    .filter(Boolean);
}

/**
 * Switches a disabled package back on. Does nothing to one that is already on.
 * @param {string} ip
 * @param {string} pkg
 * @returns {Promise<string | null>}
 */
export async function enablePackage(ip, pkg) {
  return run(['-s', target(ip), 'shell', 'pm', 'enable', pkg]);
}

/**
 * Grants an app a permission the TV only gives out over adb.
 * @param {string} ip
 * @param {string} pkg
 * @param {string} permission
 * @returns {Promise<string | null>}
 */
export async function grantPermission(ip, pkg, permission) {
  return run(['-s', target(ip), 'shell', 'pm', 'grant', pkg, permission]);
}

/**
 * Reads an app's mode for one app op, such as SYSTEM_ALERT_WINDOW. Fire OS has
 * no screen for these, so adb is the only way to see or change them.
 * @param {string} ip
 * @param {string} pkg
 * @param {string} op
 * @returns {Promise<string>} the mode (allow, ignore, deny), or "default" when never set
 */
export async function getAppOp(ip, pkg, op) {
  const out = await run(['-s', target(ip), 'shell', 'appops', 'get', pkg, op]);
  const match = new RegExp(String.raw`(?:^|\s)${op}: (\w+)`, 'm').exec(out);
  return match ? match[1] : 'default';
}

/**
 * @param {string} ip
 * @param {string} pkg
 * @param {string} op
 * @param {string} mode allow, ignore, deny or default
 * @returns {Promise<string | null>}
 */
export async function setAppOp(ip, pkg, op, mode, { uid = false } = {}) {
  return run(['-s', target(ip), 'shell', 'appops', 'set', ...(uid ? ['--uid'] : []), pkg, op, mode]);
}

const GUARD_PKG = 'com.jeremykenedy.firetv.homeredirect';

/**
 * Sends a command to the guard in Home Redirect on the TV.
 * @param {string} ip
 * @param {'lock' | 'unlock' | 'check' | 'remember'} cmd
 * @param {Object<string, string>} [extras]
 * @returns {Promise<string | null>} the guard's reply, or null when Home Redirect did not answer
 */
export async function sendGuard(ip, cmd, extras = {}) {
  const args = ['-s', target(ip), 'shell', 'am', 'broadcast', '-n', `${GUARD_PKG}/.GuardReceiver`, '-a', `${GUARD_PKG}.GUARD`, '--es', 'cmd', cmd];
  for (const [name, value] of Object.entries(extras)) {
    args.push('--es', name, value);
  }
  const out = await run(args);
  return /data="([^"]*)"/.exec(out)?.[1] ?? null;
}

/**
 * Tells the guard about a value this tool is about to set, so the guard keeps
 * it instead of putting the old one back.
 */
async function rememberIfGuarded(ip, namespace, key, value) {
  if (isGuardedNow(namespace, key)) {
    await sendGuard(ip, 'remember', { setting: `${namespace}/${key}`, value });
  }
}

/**
 * @param {string} ip
 * @param {string} pkg
 * @returns {Promise<string | null>} the installed versionName, or null if not installed
 */
export async function packageVersion(ip, pkg) {
  const out = await run(['-s', target(ip), 'shell', 'dumpsys', 'package', pkg]);
  return /versionName=(\S+)/.exec(out)?.[1] ?? null;
}

/**
 * Disables a package for the TV's user, the way Settings would. Fire OS refuses
 * this for packages it protects.
 * @param {string} ip
 * @param {string} pkg
 * @returns {Promise<string | null>}
 */
export async function disablePackage(ip, pkg) {
  return run(['-s', target(ip), 'shell', 'pm', 'disable-user', '--user', '0', pkg]);
}

/**
 * Presses the remote's Home button. Only for showing the result of a change,
 * so a failure here is ignored.
 * @param {string} ip
 * @returns {Promise<string | null>}
 */
export async function pressHome(ip) {
  return run(['-s', target(ip), 'shell', 'input', 'keyevent', 'KEYCODE_HOME'], { allowFail: true });
}

/**
 * @param {string} ip
 * @param {string} pkg
 * @returns {Promise<boolean>}
 */
export async function isPackageInstalled(ip, pkg) {
  const packages = await listPackages(ip);
  return packages.includes(pkg);
}

/**
 * @param {string} ip
 * @param {string} apkPath
 * @returns {Promise<string | null>}
 */
export async function installApk(ip, apkPath) {
  return run(['-s', target(ip), 'install', '-r', apkPath], { timeout: INSTALL_TIMEOUT_MS });
}

/**
 * @param {string | null} output what `pm uninstall` printed, or null if adb failed
 * @returns {boolean}
 */
export function isPmSuccess(output) {
  return typeof output === 'string' && /^Success\b/m.test(output);
}

/**
 * @param {string} ip
 * @param {string} pkg
 * @returns {Promise<boolean>} whether the package was actually removed
 */
export async function uninstallPackage(ip, pkg) {
  return isPmSuccess(await run(['-s', target(ip), 'shell', 'pm', 'uninstall', pkg], { allowFail: true }));
}

export async function getAndroidVersion(ip) {
  const value = await run(['-s', target(ip), 'shell', 'getprop', 'ro.build.version.sdk']);
  if (!/^\d+$/.test(value)) {
    throw new Error('The TV did not report its Android version.');
  }
  return Number(value);
}

export async function pullFile(ip, remote, local) {
  return run(['-s', target(ip), 'pull', remote, local], { timeout: 60000 });
}

export async function pushFile(ip, local, remote) {
  return run(['-s', target(ip), 'push', local, remote], { timeout: 60000 });
}

export async function remoteFileExists(ip, remote) {
  return (await run(['-s', target(ip), 'shell', 'test', '-f', remote], { allowFail: true })) !== null;
}

export async function removeRemoteFile(ip, remote) {
  return run(['-s', target(ip), 'shell', 'rm', '-f', remote]);
}

export async function backupOperation(ip, pkg, operation, source = 'saved') {
  const out = await run(['-s', target(ip), 'shell', 'am', 'broadcast', '--include-stopped-packages',
    '-n', `${pkg}/.BackupReceiver`, '-a', `${pkg}.BACKUP`, '--es', 'operation', operation, '--es', 'source', source]);
  if (!/Broadcast completed: result=0, data="ok"/.test(out)) {
    throw new Error(out.split('\n').find((line) => line.startsWith('Broadcast completed:')) || 'The TV did not complete the backup operation.');
  }
}

export async function openLauncher(ip, pkg) {
  return run(['-s', target(ip), 'shell', 'am', 'start', '-f', '0x10008000',
    '-n', `${pkg}/.MainActivity`]);
}
