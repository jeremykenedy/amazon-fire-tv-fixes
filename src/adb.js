import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import chalk from 'chalk';
import { startSpinner } from './spinner.js';
import { getSavedIp, saveIp, promptForIp } from './device-config.js';
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
  return run(['-s', target(ip), 'shell', 'settings', 'put', namespace, key, String(value)]);
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
