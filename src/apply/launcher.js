import { getSetting, putSetting, deleteSetting, listPackages, listDisabledPackages, enablePackage, grantPermission, installApk, uninstallPackage, pressHome, describeAdbError, backupOperation } from '../adb.js';
import { downloadApk, removeDownload } from './screensavers.js';
import { AT4K, HOME_REDIRECT, LAUNCHER_APPS, FIRE_TV_UI } from '../launcher-registry.js';

const SERVICES_KEY = 'enabled_accessibility_services';
const ENABLED_KEY = 'accessibility_enabled';

/**
 * Pure: the colon-separated accessibility services setting as a list. The TV
 * reports an unset value as the text "null".
 * @param {string | null} raw
 * @returns {string[]}
 */
export function parseServices(raw) {
  if (!raw || raw === 'null') {
    return [];
  }
  return raw.split(':').map((s) => s.trim()).filter(Boolean);
}

/**
 * Pure: the services list with AT4K's home screen switched on or off. Any
 * other accessibility service the TV already runs is left exactly as it was.
 * AT4K's own service stays on in both modes; only Home Redirect decides
 * where the Home button goes.
 * @param {string[]} current
 * @param {'at4k' | 'amazon'} mode
 * @returns {string[]}
 */
export function servicesFor(current, mode) {
  const replaced = [HOME_REDIRECT.service, FIRE_TV_UI.service, FIRE_TV_UI.controls,
    'com.overdevs.at4khelper/com.overdevs.at4khelper.HomeRedirectAccessibilityService'];
  const others = current.filter((s) => !replaced.includes(s)
    && (mode !== 'fire-tv-ui' || s !== AT4K.service));
  if (mode === 'amazon') {
    return others;
  }
  if (mode === 'fire-tv-ui') {
    return [...others, FIRE_TV_UI.controls, FIRE_TV_UI.service];
  }
  const withAt4k = others.includes(AT4K.service) ? others : [...others, AT4K.service];
  return [...withAt4k, HOME_REDIRECT.service];
}

/**
 * @param {string} ip
 * @returns {Promise<{installed: string[], disabled: string[], services: string[], home: 'at4k' | 'amazon'}>}
 */
export async function launcherState(ip) {
  const packages = await listPackages(ip);
  const disabled = await listDisabledPackages(ip);
  const services = parseServices(await getSetting(ip, 'secure', SERVICES_KEY));
  return {
    installed: [...LAUNCHER_APPS, FIRE_TV_UI].filter((app) => packages.includes(app.pkg)).map((app) => app.id),
    disabled: [...LAUNCHER_APPS, FIRE_TV_UI].filter((app) => disabled.includes(app.pkg)).map((app) => app.id),
    services,
    home: services.includes(FIRE_TV_UI.service) ? 'fire-tv-ui' : services.includes(HOME_REDIRECT.service) ? 'at4k' : 'amazon',
  };
}

/**
 * @param {string} ip
 * @param {string[]} services
 */
async function writeServices(ip, services) {
  if (services.length === 0) {
    await deleteSetting(ip, 'secure', SERVICES_KEY);
    await putSetting(ip, 'secure', ENABLED_KEY, 0);
    return;
  }
  await putSetting(ip, 'secure', SERVICES_KEY, services.join(':'));
  await putSetting(ip, 'secure', ENABLED_KEY, 1);
}

/**
 * Pure: a plain-language reason for an install adb refused. The common one is
 * a copy of the app already on the TV signed by someone else, which Android
 * will not replace.
 * @param {unknown} err
 * @returns {string}
 */
export function explainInstallFailure(err) {
  const text = describeAdbError(err);
  if (/INSTALL_FAILED_UPDATE_INCOMPATIBLE|signatures do not match/i.test(text)) {
    return 'a different build of this app is already installed, signed by someone else, so Android will not replace it. Your copy was left as it is';
  }
  return text;
}

/**
 * Downloads, verifies and installs one launcher app, then switches it back on
 * if it had been disabled and grants the permissions it needs.
 * @param {string} ip
 * @param {typeof AT4K | typeof HOME_REDIRECT} app
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function installLauncherApp(ip, app) {
  let apkPath;
  try {
    apkPath = await downloadApk(app);
    await installApk(ip, apkPath);
  } catch (err) {
    return { ok: false, error: explainInstallFailure(err) };
  } finally {
    if (apkPath) {
      removeDownload(apkPath);
    }
  }
  await enablePackage(ip, app.pkg);
  for (const permission of app.grants || []) {
    await grantPermission(ip, app.pkg, permission);
  }
  return { ok: true };
}

/**
 * Sends the Home button to AT4K or back to the Amazon menu, then presses Home
 * so the result is on screen straight away.
 * @param {string} ip
 * @param {'at4k' | 'amazon'} mode
 * @returns {Promise<boolean>} whether the TV reads back the requested mode
 */
export async function useHome(ip, mode) {
  const before = await launcherState(ip);
  if (mode === 'at4k') {
    for (const app of LAUNCHER_APPS.filter((a) => before.disabled.includes(a.id))) {
      await enablePackage(ip, app.pkg);
    }
  }
  if (mode === 'fire-tv-ui') {
    if (!before.installed.includes(FIRE_TV_UI.id)) {
      return false;
    }
    await enablePackage(ip, FIRE_TV_UI.pkg);
  }
  const enabledBefore = await getSetting(ip, 'secure', ENABLED_KEY);
  const requested = servicesFor(before.services, mode);
  try {
    if (before.installed.includes(FIRE_TV_UI.id)) {
      await backupOperation(ip, FIRE_TV_UI.pkg, mode === FIRE_TV_UI.id ? 'home-on' : 'home-preference-off');
    }
    if (mode !== FIRE_TV_UI.id) {
      await writeServices(ip, requested);
    }
    const readBack = parseServices(await getSetting(ip, 'secure', SERVICES_KEY));
    const enabled = await getSetting(ip, 'secure', ENABLED_KEY);
    if (readBack.join(':') !== requested.join(':') || enabled !== (requested.length ? '1' : '0')) {
      throw new Error('The TV did not save the Home button setting.');
    }
  } catch {
    if (before.installed.includes(FIRE_TV_UI.id)) {
      await backupOperation(ip, FIRE_TV_UI.pkg, before.home === FIRE_TV_UI.id ? 'home-preference-on' : 'home-preference-off').catch(() => {});
    }
    await writeServices(ip, before.services);
    if (!enabledBefore || enabledBefore === 'null') {
      await deleteSetting(ip, 'secure', ENABLED_KEY);
    } else {
      await putSetting(ip, 'secure', ENABLED_KEY, enabledBefore);
    }
    return false;
  }
  await pressHome(ip);
  return (await launcherState(ip)).home === mode;
}

/**
 * Uninstalls one launcher app and drops its accessibility service from the
 * TV's list, so nothing is left pointing at an app that is gone.
 * @param {string} ip
 * @param {typeof AT4K | typeof HOME_REDIRECT} app
 * @returns {Promise<boolean>} whether the app was removed
 */
export async function removeLauncherApp(ip, app) {
  if (!(await uninstallPackage(ip, app.pkg))) {
    return false;
  }
  const current = parseServices(await getSetting(ip, 'secure', SERVICES_KEY));
  if (current.includes(app.service)) {
    await writeServices(ip, current.filter((s) => s !== app.service));
  }
  return true;
}
