import { sendGuard, packageVersion, disablePackage, enablePackage, listPackages, listDisabledPackages, getAppOp, setAppOp, grantPermission, describeAdbError } from '../adb.js';
import { installLauncherApp } from './launcher.js';
import { HOME_REDIRECT } from '../launcher-registry.js';
import { guardState, saveGuardState } from '../guard-config.js';

/** Amazon's update apps that Fire OS lets adb disable. */
export const UPDATERS = ['com.amazon.tv.easyupgrade', 'com.amazon.tv.forcedotaupdater.v2'];

/**
 * Fire OS refuses to disable its main updater ("Cannot disable a protected
 * package"), so the most adb can do is stop it running in the background.
 */
export const BACKGROUND_BLOCKED = ['com.amazon.device.software.ota', 'com.amazon.device.software.ota.override'];

const BACKGROUND_OP = 'RUN_ANY_IN_BACKGROUND';

/** The first Home Redirect with the guard in it. */
export const GUARD_MIN_VERSION = '1.2.0';

/**
 * Pure: whether version a is at least version b ("1.10.0" >= "1.2.0").
 * @param {string | null} a
 * @param {string} b
 * @returns {boolean}
 */
export function versionAtLeast(a, b) {
  if (!a) {
    return false;
  }
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) {
      return (x[i] || 0) > (y[i] || 0);
    }
  }
  return true;
}

/**
 * Pure: the setting names in a "guard=on restored=a,b" reply.
 * @param {string | null} reply
 * @returns {string[] | null} null when the reply is not a check result
 */
export function parseCheck(reply) {
  const match = /^guard=(on|off) restored=(.*)$/.exec(reply || '');
  if (!match) {
    return null;
  }
  return match[2] === 'none' ? [] : match[2].split(',');
}

async function ensureHomeRedirect(ip) {
  const version = await packageVersion(ip, HOME_REDIRECT.pkg);
  if (versionAtLeast(version, GUARD_MIN_VERSION)) {
    await grantPermission(ip, HOME_REDIRECT.pkg, 'android.permission.WRITE_SECURE_SETTINGS');
    return { label: `Home Redirect ${version} is installed`, ok: true };
  }
  const installed = await installLauncherApp(ip, HOME_REDIRECT);
  return installed.ok
    ? { label: 'Installed Home Redirect with the guard in it', ok: true }
    : { label: 'Could not install Home Redirect', ok: false, detail: installed.error };
}

async function blockUpdaters(ip, state) {
  const results = [];
  const installed = await listPackages(ip);
  const disabled = await listDisabledPackages(ip);
  for (const pkg of UPDATERS.filter((p) => installed.includes(p) && !disabled.includes(p))) {
    let detail;
    try {
      await disablePackage(ip, pkg);
    } catch (err) {
      detail = describeAdbError(err);
    }
    const ok = (await listDisabledPackages(ip)).includes(pkg);
    if (ok && !state.disabled.includes(pkg)) {
      state.disabled.push(pkg);
    }
    results.push({ label: `Disabled ${pkg}`, ok, detail });
  }
  for (const pkg of BACKGROUND_BLOCKED.filter((p) => installed.includes(p))) {
    const mode = await getAppOp(ip, pkg, BACKGROUND_OP);
    if (mode === 'ignore') {
      continue;
    }
    state.background[pkg] ??= mode;
    await setAppOp(ip, pkg, BACKGROUND_OP, 'ignore');
    results.push({ label: `Stopped ${pkg} running in the background`, ok: (await getAppOp(ip, pkg, BACKGROUND_OP)) === 'ignore' });
  }
  return results;
}

/**
 * Turns the guard on: Home Redirect saves the screensaver, Alexa fix, Home and
 * timeout settings as they are now and puts them back whenever they change,
 * and Amazon's updaters are held back as far as Fire OS allows.
 * @param {string} ip
 * @returns {Promise<Array<{label: string, ok: boolean, detail?: string}>>}
 */
export async function turnGuardOn(ip) {
  const state = guardState();
  const results = [await ensureHomeRedirect(ip)];
  if (!results[0].ok) {
    return results;
  }
  results.push({ label: 'Locked the screensaver, Alexa fix, Home and timeout settings on the TV', ok: (await sendGuard(ip, 'lock')) === 'locked' });
  results.push(...(await blockUpdaters(ip, state)));
  saveGuardState({ ...state, on: true });
  return results;
}

/**
 * Puts back anything Amazon changed: settings, through the guard on the TV,
 * and any updater that was turned back on.
 * @param {string} ip
 * @returns {Promise<{results: Array<{label: string, ok: boolean, detail?: string}>, restored: string[] | null}>}
 */
export async function checkGuard(ip) {
  const state = guardState();
  const restored = parseCheck(await sendGuard(ip, 'check'));
  const results = await blockUpdaters(ip, state);
  saveGuardState(state);
  return { results, restored };
}

/**
 * Turns the guard off and undoes only what it did itself.
 * @param {string} ip
 * @returns {Promise<Array<{label: string, ok: boolean}>>}
 */
export async function turnGuardOff(ip) {
  const state = guardState();
  const reply = await sendGuard(ip, 'unlock');
  // With Home Redirect gone there is nothing left on the TV to unlock.
  const unlocked = reply === 'unlocked' || (reply === null && !(await listPackages(ip)).includes(HOME_REDIRECT.pkg));
  const results = [{ label: 'Unlocked the settings on the TV', ok: unlocked }];
  for (const pkg of state.disabled) {
    await enablePackage(ip, pkg);
    results.push({ label: `Re-enabled ${pkg}`, ok: !(await listDisabledPackages(ip)).includes(pkg) });
  }
  for (const [pkg, mode] of Object.entries(state.background)) {
    await setAppOp(ip, pkg, BACKGROUND_OP, mode);
    results.push({ label: `Let ${pkg} run in the background again`, ok: (await getAppOp(ip, pkg, BACKGROUND_OP)) === mode });
  }
  if (results.every((r) => r.ok)) {
    saveGuardState({ on: false, disabled: [], background: {} });
  }
  return results;
}
