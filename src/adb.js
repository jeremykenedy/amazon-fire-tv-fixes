import { execFile } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { getSavedIp, saveIp, promptForIp } from './device-config.js';

const execFileAsync = promisify(execFile);
const PORT = 5555;

function target(ip) {
  return `${ip}:${PORT}`;
}

async function run(args, { allowFail = false } = {}) {
  try {
    const { stdout } = await execFileAsync('adb', args, { timeout: 15000 });
    return stdout.trim();
  } catch (err) {
    if (allowFail) return null;
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
  return run(['connect', target(ip)], { allowFail: true });
}

/**
 * @param {string} ip
 * @returns {Promise<boolean>}
 */
export async function isReachable(ip) {
  const out = await run(['-s', target(ip), 'shell', 'echo', 'ok'], { allowFail: true });
  return out === 'ok';
}

/**
 * Resolves a working device IP: tries the saved one first, and if it's
 * missing or unreachable, prompts for one (looping until a reachable IP
 * is entered or the user exits via Ctrl+C). Saves the working IP so the
 * next run of any command in this tool doesn't ask again.
 * @returns {Promise<string>} the working IP
 */
export async function ensureConnected() {
  let ip = getSavedIp();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (!ip) {
      ip = await promptForIp();
    }

    await connect(ip);
    if (await isReachable(ip)) {
      saveIp(ip);
      return ip;
    }

    console.log(chalk.red(`\nCouldn't reach a Fire TV at ${ip}:${PORT}.`));
    console.log(chalk.gray('Make sure ADB debugging is on and you accepted the pairing prompt on the TV.\n'));
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
  return run(['-s', target(ip), 'install', '-r', apkPath]);
}

/**
 * @param {string} ip
 * @param {string} pkg
 * @returns {Promise<string | null>}
 */
export async function uninstallPackage(ip, pkg) {
  return run(['-s', target(ip), 'shell', 'pm', 'uninstall', pkg], { allowFail: true });
}
