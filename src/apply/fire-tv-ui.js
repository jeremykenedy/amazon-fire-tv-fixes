import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  getAndroidVersion, grantPermission, setAppOp, getAppOp, installApk, enablePackage,
  pullFile, pushFile, remoteFileExists, removeRemoteFile, backupOperation, openLauncher,
  getSetting, putSetting, uninstallPackage, listPackages, packageVersion, sendGuard,
} from '../adb.js';
import { downloadApk, removeDownload } from './screensavers.js';
import { useHome, launcherState, installLauncherApp } from './launcher.js';
import { FIRE_TV_UI, HOME_REDIRECT } from '../launcher-registry.js';
import { versionAtLeast, NATIVE_UI_GUARD_MIN_VERSION } from './guard.js';
import { SCREENSAVERS, BUILT_IN_SCREENSAVERS, AMAZON_DEFAULT } from '../screensaver-registry.js';

export const UI_SCREENSAVERS = [...SCREENSAVERS, ...BUILT_IN_SCREENSAVERS, AMAZON_DEFAULT];

export const TV_BACKUP = '/sdcard/Download/fire-tv-ui-backup.txt';
export const TV_IMPORT = '/sdcard/Download/fire-tv-ui-import.txt';
const MAX_BACKUP_BYTES = 8 * 1024 * 1024;

export function validateBackup(bytes) {
  if (bytes.length > MAX_BACKUP_BYTES) {
    throw new Error('The backup exceeds the 8 MB limit.');
  }
  let data;
  try {
    data = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error('The backup must be a valid Fire TV UI settings JSON file.');
  }
  if (!data || Array.isArray(data) || typeof data !== 'object' || Object.keys(data).length === 0) {
    throw new Error('The backup contains no settings.');
  }
  for (const [key, value] of Object.entries(data)) {
    const valid = typeof value === 'string' || typeof value === 'boolean'
      || (typeof value === 'number' && Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value)))
      || (Array.isArray(value) && value.every((item) => typeof item === 'string'));
    if (!valid) {
      throw new Error(`Invalid value in backup setting: ${key}`);
    }
  }
  return data;
}

export function readBackup(filename) {
  const stat = fs.statSync(filename);
  if (!stat.isFile() || stat.size > MAX_BACKUP_BYTES) {
    throw new Error('Choose a backup file no larger than 8 MB.');
  }
  const bytes = fs.readFileSync(filename);
  validateBackup(bytes);
  return bytes;
}

export async function grantBackupAccess(ip) {
  const sdk = await getAndroidVersion(ip);
  if (sdk >= 30) {
    await setAppOp(ip, FIRE_TV_UI.pkg, 'MANAGE_EXTERNAL_STORAGE', 'allow', { uid: true });
    if (await getAppOp(ip, FIRE_TV_UI.pkg, 'MANAGE_EXTERNAL_STORAGE') !== 'allow') {
      throw new Error('The TV did not allow persistent backup access.');
    }
    if (sdk <= 32) {
      await grantPermission(ip, FIRE_TV_UI.pkg, 'android.permission.READ_EXTERNAL_STORAGE');
    }
  } else {
    for (const permission of ['READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE']) {
      await grantPermission(ip, FIRE_TV_UI.pkg, `android.permission.${permission}`);
    }
  }
}

export async function saveTvBackup(ip) {
  await grantBackupAccess(ip);
  await backupOperation(ip, FIRE_TV_UI.pkg, 'save');
  if (!(await remoteFileExists(ip, TV_BACKUP))) {
    throw new Error('The TV did not create the backup.');
  }
}

export async function retrieveBackup(ip, destination, { refresh = true } = {}) {
  if (fs.existsSync(destination)) {
    throw new Error('That destination already exists. Choose a new filename to keep both backups.');
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'firetv-backup-'));
  try {
    if (refresh) {
      await saveTvBackup(ip);
    }
    const temporary = path.join(dir, 'backup.json');
    await pullFile(ip, TV_BACKUP, temporary);
    const bytes = readBackup(temporary);
    fs.writeFileSync(destination, bytes, { flag: 'wx', mode: 0o600 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export async function placeBackup(ip, filename, { restore = false } = {}) {
  const bytes = readBackup(filename);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'firetv-backup-'));
  try {
    const staged = path.join(dir, 'incoming.json');
    fs.writeFileSync(staged, bytes, { mode: 0o600 });
    await pushFile(ip, staged, TV_IMPORT);
    const readBack = path.join(dir, 'readback.json');
    await pullFile(ip, TV_IMPORT, readBack);
    if (!bytes.equals(fs.readFileSync(readBack))) {
      throw new Error('The TV backup transfer did not match the original file.');
    }
    if (restore) {
      await grantBackupAccess(ip);
      await backupOperation(ip, FIRE_TV_UI.pkg, 'restore', 'import');
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function verifiedLocalApk(filename, expectedHash) {
  if (!/^[a-fA-F0-9]{64}$/.test(expectedHash || '')) {
    throw new Error('A local APK requires its SHA-256 checksum with --sha256.');
  }
  const bytes = fs.readFileSync(filename);
  const actual = crypto.createHash('sha256').update(bytes).digest('hex');
  if (actual !== expectedHash.toLowerCase()) {
    throw new Error('The local APK does not match its SHA-256 checksum.');
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'firetv-apk-'));
  const staged = path.join(dir, 'fire-tv-ui.apk');
  fs.writeFileSync(staged, bytes, { mode: 0o600 });
  return staged;
}

export async function installFireTvUi(ip, options, onProgress = () => {}) {
  options = { setup: 'keep', home: 'keep', screensaver: 'keep', protection: 'keep', ...options };
  if (await getAndroidVersion(ip) < 27) {
    throw new Error('Fire TV UI requires Android 8.1 (API 27) or newer.');
  }
  if (options.setup === 'import') {
    readBackup(options.file);
  }
  if (options.screensaver !== 'keep' && !['on', 'off'].includes(options.screensaver)) {
    const choice = UI_SCREENSAVERS.find((entry) => entry.id === options.screensaver);
    if (!choice || !(await listPackages(ip)).includes(choice.pkg)) {
      throw new Error('Choose a screensaver already installed on the TV.');
    }
  }
  onProgress('Verifying the Fire TV UI APK');
  const apk = options.apk ? await verifiedLocalApk(options.apk, options.sha256) : await downloadApk(FIRE_TV_UI);
  try {
    const before = await launcherState(ip);
    const hasHelper = before.installed.includes(HOME_REDIRECT.id);
    if (hasHelper && !versionAtLeast(await packageVersion(ip, HOME_REDIRECT.pkg), NATIVE_UI_GUARD_MIN_VERSION)) {
      onProgress('Updating the toolkit guard for Fire TV UI');
      const helper = await installLauncherApp(ip, HOME_REDIRECT);
      if (!helper.ok) throw new Error(`Could not update the toolkit guard: ${helper.error}`);
      if (!versionAtLeast(await packageVersion(ip, HOME_REDIRECT.pkg), NATIVE_UI_GUARD_MIN_VERSION)) {
        throw new Error(`The toolkit guard update must provide version ${NATIVE_UI_GUARD_MIN_VERSION} or newer. Fire TV UI was kept unchanged.`);
      }
    }
    if (options.setup === 'tv') {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'firetv-backup-'));
      try {
        const saved = path.join(dir, 'saved.json');
        await pullFile(ip, TV_BACKUP, saved);
        await placeBackup(ip, saved);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
    if (before.installed.includes(FIRE_TV_UI.id)) {
      onProgress('Saving the current layout on the TV');
      await saveTvBackup(ip);
      if (options.export) {
        await retrieveBackup(ip, options.export, { refresh: false });
      }
    }
    onProgress('Installing Fire TV UI');
    await installApk(ip, apk);
    if (!(await listPackages(ip)).includes(FIRE_TV_UI.pkg)) {
      throw new Error('The APK did not install Fire TV UI.');
    }
    if (hasHelper) await sendGuard(ip, 'check');
    await enablePackage(ip, FIRE_TV_UI.pkg);
    onProgress('Setting up TV screensaver and backup access');
    for (const permission of FIRE_TV_UI.grants) {
      await grantPermission(ip, FIRE_TV_UI.pkg, permission);
    }
    if (!before.installed.includes(FIRE_TV_UI.id)) {
      await grantPermission(ip, FIRE_TV_UI.pkg, 'android.permission.READ_TV_LISTINGS');
    }
    await grantBackupAccess(ip);
    for (const operation of ['GET_USAGE_STATS', 'REQUEST_INSTALL_PACKAGES']) {
      await setAppOp(ip, FIRE_TV_UI.pkg, operation, 'allow');
      if (await getAppOp(ip, FIRE_TV_UI.pkg, operation) !== 'allow') {
        throw new Error(`The TV did not allow ${operation}.`);
      }
    }
    if (options.setup === 'simple') {
      await backupOperation(ip, FIRE_TV_UI.pkg, 'simple');
    } else if (options.setup === 'tv') {
      await backupOperation(ip, FIRE_TV_UI.pkg, 'restore', 'import');
    } else if (options.setup === 'import') {
      await placeBackup(ip, options.file, { restore: true });
    }
    await openLauncher(ip, FIRE_TV_UI.pkg);
    if (options.protection !== 'keep') {
      await backupOperation(ip, FIRE_TV_UI.pkg, options.protection === 'on' ? 'protection-on' : 'protection-off');
    }
    if (options.home !== 'keep') {
      onProgress('Configuring the Home button');
      if (!(await useHome(ip, options.home))) {
        throw new Error('The TV did not save the Home button choice.');
      }
    } else if (before.home === FIRE_TV_UI.id && !(await useHome(ip, FIRE_TV_UI.id))) {
      throw new Error('The TV did not restore its Home button after the update.');
    }
    if (options.screensaver && options.screensaver !== 'keep') {
      await configureScreensaver(ip, options.screensaver);
    }
  } finally {
    removeDownload(apk);
  }
}

export async function configureScreensaver(ip, mode) {
  const choice = UI_SCREENSAVERS.find((entry) => entry.id === mode);
  if (!choice && !['on', 'off'].includes(mode)) {
    throw new Error('Choose a supported installed screensaver, on, or off.');
  }
  if (choice && !(await listPackages(ip)).includes(choice.pkg)) {
    throw new Error(`${choice.name} is not installed on the TV.`);
  }
  const previous = await getSetting(ip, 'secure', 'screensaver_enabled');
  const previousComponent = await getSetting(ip, 'secure', 'screensaver_components');
  const requested = mode === 'off' ? '0' : '1';
  try {
    if (choice) {
      await putSetting(ip, 'secure', 'screensaver_components', choice.dreamComponent);
      if (await getSetting(ip, 'secure', 'screensaver_components') !== choice.dreamComponent) {
        throw new Error('The TV did not save the selected screensaver.');
      }
    }
    await putSetting(ip, 'secure', 'screensaver_enabled', requested);
    if (await getSetting(ip, 'secure', 'screensaver_enabled') !== requested) {
      throw new Error('The TV did not save the screensaver enabled setting.');
    }
  } catch (error) {
    await putSetting(ip, 'secure', 'screensaver_enabled', previous);
    await putSetting(ip, 'secure', 'screensaver_components', previousComponent);
    throw error;
  }
}

export async function uninstallFireTvUi(ip, { backup = 'keep', export: destination } = {}, onProgress = () => {}) {
  const state = await launcherState(ip);
  if (state.installed.includes(FIRE_TV_UI.id)) {
    if (backup === 'keep' || destination) {
      onProgress('Saving your layout before uninstalling');
      await saveTvBackup(ip);
      if (destination) {
        await retrieveBackup(ip, destination, { refresh: false });
      }
    }
    onProgress('Returning the Home button to Amazon');
    if (!(await useHome(ip, 'amazon'))) {
      throw new Error('The TV did not restore the Amazon Home button. Fire TV UI was kept installed.');
    }
    onProgress('Removing Fire TV UI');
    if (!(await uninstallPackage(ip, FIRE_TV_UI.pkg))) {
      if (state.home === FIRE_TV_UI.id) {
        await useHome(ip, FIRE_TV_UI.id);
      }
      throw new Error('The TV could not uninstall Fire TV UI.');
    }
  }
  if (backup === 'delete') {
    await removeRemoteFile(ip, TV_BACKUP);
    await removeRemoteFile(ip, TV_IMPORT);
    if (await remoteFileExists(ip, TV_BACKUP) || await remoteFileExists(ip, TV_IMPORT)) {
      throw new Error('The TV did not remove the selected backup files.');
    }
  }
}
