import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { installApk, uninstallPackage } from '../adb.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..', '..');
export const SCREENSAVERS_DIR = path.join(PROJECT_ROOT, 'screensavers');

/**
 * @typedef {Object} ScreensaverEntry
 * @property {string} id
 * @property {string} name
 * @property {string} pkg
 * @property {string} dreamComponent
 * @property {string} repo
 */

/**
 * @param {string} repo GitHub "owner/name", always from the fixed registry, never user input
 * @returns {Promise<string>} the .apk asset download URL from the latest release
 */
export async function latestReleaseApkUrl(repo) {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
  if (!res.ok) throw new Error(`GitHub API returned ${res.status} for ${repo}`);
  const release = await res.json();
  const apk = (release.assets || []).find((a) => a.name.endsWith('.apk'));
  if (!apk) throw new Error(`No .apk asset found on the latest release of ${repo}`);
  return apk.browser_download_url;
}

/**
 * @param {ScreensaverEntry} entry
 * @returns {Promise<string>} local clone path
 */
export async function cloneIfMissing(entry) {
  const dest = path.join(SCREENSAVERS_DIR, entry.id);
  if (fs.existsSync(dest)) return dest;
  fs.mkdirSync(SCREENSAVERS_DIR, { recursive: true });
  await execFileAsync('git', ['clone', '--depth', '1', `https://github.com/${entry.repo}.git`, dest]);
  return dest;
}

/**
 * @param {ScreensaverEntry} entry
 * @returns {Promise<string>} local .apk path
 */
export async function downloadApk(entry) {
  const url = await latestReleaseApkUrl(entry.repo);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed with status ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const apkPath = path.join(os.tmpdir(), `${entry.id}.apk`);
  fs.writeFileSync(apkPath, buf);
  return apkPath;
}

/**
 * @param {string} ip
 * @param {ScreensaverEntry} entry
 * @param {{onProgress?: (message: string) => void}} [options]
 * @returns {Promise<void>}
 */
export async function installScreensaver(ip, entry, { onProgress } = {}) {
  onProgress?.('cloning source');
  await cloneIfMissing(entry);
  onProgress?.('fetching latest release');
  const apkPath = await downloadApk(entry);
  onProgress?.('installing on the TV');
  await installApk(ip, apkPath);
}

/**
 * @param {string} ip
 * @param {ScreensaverEntry} entry
 * @returns {Promise<void>}
 */
export async function uninstallScreensaver(ip, entry) {
  await uninstallPackage(ip, entry.pkg);
}

/** @returns {void} */
export function deleteLocalClones() {
  fs.rmSync(SCREENSAVERS_DIR, { recursive: true, force: true });
}

/** @returns {boolean} */
export function hasLocalClones() {
  return fs.existsSync(SCREENSAVERS_DIR) && fs.readdirSync(SCREENSAVERS_DIR).length > 0;
}
