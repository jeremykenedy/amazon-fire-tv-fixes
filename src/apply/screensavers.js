import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { installApk, uninstallPackage, describeAdbError } from '../adb.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const DEFAULT_SCREENSAVERS_DIR = path.join(PROJECT_ROOT, 'screensavers');
export let SCREENSAVERS_DIR = DEFAULT_SCREENSAVERS_DIR;

/**
 * Test-only: points the local clones at a throwaway folder. Never read from
 * the environment, so nothing outside the tests can redirect what gets deleted.
 * @param {string | null} dirPath null restores the project's own folder
 */
export function setScreensaversDirForTesting(dirPath) {
  SCREENSAVERS_DIR = dirPath || DEFAULT_SCREENSAVERS_DIR;
}

/**
 * @typedef {Object} ScreensaverEntry
 * @property {string} id
 * @property {string} name
 * @property {string} pkg
 * @property {string} dreamComponent
 * @property {string} repo
 */

/**
 * Pure: pulls the "SHA-256: <64 hex chars>" line out of a release's notes,
 * or null if the notes don't record one.
 * @param {string | null | undefined} notes
 * @returns {string | null}
 */
export function parseSha256FromNotes(notes) {
  const match = /SHA-256:\s*([0-9a-fA-F]{64})\b/.exec(notes || '');
  return match ? match[1].toLowerCase() : null;
}

/**
 * Throws unless apkUrl is an https github.com URL under this repo's own
 * /releases/download/ path (no userinfo, no custom port). The URL comes from
 * the GitHub API response, so this keeps a tampered or unexpected response
 * from pointing the download at some other host.
 * @param {string} apkUrl
 * @param {string} repo GitHub "owner/name"
 */
export function assertTrustedApkUrl(apkUrl, repo) {
  let url;
  try {
    url = new URL(apkUrl);
  } catch {
    throw new Error(`Refusing to download: "${apkUrl}" is not a valid URL`);
  }
  const expectedPrefix = `/${repo}/releases/download/`.toLowerCase();
  const trusted =
    url.protocol === 'https:' &&
    url.hostname === 'github.com' &&
    !url.username &&
    !url.password &&
    !url.port &&
    url.pathname.toLowerCase().startsWith(expectedPrefix);
  if (!trusted) {
    throw new Error(`Refusing to download from an unexpected location: ${url.origin}${url.pathname}`);
  }
}

// Hosts GitHub serves release assets from after redirecting the download URL.
const TRUSTED_ASSET_HOSTS = new Set(['release-assets.githubusercontent.com', 'objects.githubusercontent.com']);
const MAX_REDIRECTS = 3;

/**
 * Throws unless a redirect target is https on a known GitHub asset host,
 * with no userinfo or custom port.
 * @param {URL} url
 */
export function assertTrustedRedirect(url) {
  const trusted = url.protocol === 'https:' && TRUSTED_ASSET_HOSTS.has(url.hostname) && !url.username && !url.password && !url.port;
  if (!trusted) {
    throw new Error(`Refusing to follow a redirect to an unexpected location: ${url.origin}`);
  }
}

/**
 * Fetches the APK, following redirects by hand so every hop can be checked
 * before it is requested. The first URL must already have passed
 * assertTrustedApkUrl.
 * @param {string} apkUrl
 * @returns {Promise<Response>} the final, successful response
 */
async function fetchTrusted(apkUrl) {
  let current = new URL(apkUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const res = await fetch(current, { redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) {
        throw new Error('Download redirected without a destination');
      }
      current = new URL(location, current);
      assertTrustedRedirect(current);
      continue;
    }
    return res;
  }
  throw new Error(`Download redirected more than ${MAX_REDIRECTS} times`);
}

/**
 * @param {string} repo GitHub "owner/name", always from the fixed registry, never user input
 * @returns {Promise<{apkUrl: string, sha256: string | null, tag: string}>} the .apk asset from the latest release
 */
export async function latestRelease(repo) {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
  if (res.status === 404) {
    throw new Error(`${repo} has no published release, so there is no APK to install from it`);
  }
  if (!res.ok) {
    throw new Error(`GitHub API returned ${res.status} for ${repo}`);
  }
  const release = await res.json();
  const apk = (release.assets || []).find((a) => a.name.endsWith('.apk'));
  if (!apk) {
    throw new Error(`No .apk asset found on the latest release of ${repo}`);
  }
  return { apkUrl: apk.browser_download_url, sha256: parseSha256FromNotes(release.body), tag: release.tag_name };
}

/**
 * @param {string} repo
 * @returns {Promise<string>} the .apk asset download URL from the latest release
 */
export async function latestReleaseApkUrl(repo) {
  return (await latestRelease(repo)).apkUrl;
}

/**
 * @param {ScreensaverEntry} entry
 * @returns {Promise<boolean>} true if a clone was made, false if one already existed
 */
export async function cloneIfMissing(entry) {
  const dest = path.join(SCREENSAVERS_DIR, entry.id);
  if (fs.existsSync(dest)) {
    return false;
  }
  fs.mkdirSync(SCREENSAVERS_DIR, { recursive: true });
  // GIT_TERMINAL_PROMPT=0 makes a missing or private repo fail instead of
  // waiting on a hidden credential prompt.
  await execFileAsync('git', ['clone', '--depth', '1', `https://github.com/${entry.repo}.git`, dest], {
    timeout: 60000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  return true;
}

/**
 * @param {ScreensaverEntry} entry
 * @returns {Promise<string>} local .apk path, inside its own temp directory (see removeDownload)
 */
export async function downloadApk(entry) {
  const { apkUrl, sha256 } = await latestRelease(entry.repo);
  assertTrustedApkUrl(apkUrl, entry.repo);
  const res = await fetchTrusted(apkUrl);
  if (!res.ok) {
    throw new Error(`Download failed with status ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());

  if (!sha256) {
    throw new Error(`No valid SHA-256 checksum in the release notes for ${entry.name}; refusing to install an unverified download`);
  }
  const actual = crypto.createHash('sha256').update(buf).digest('hex');
  if (actual !== sha256) {
    throw new Error(`Checksum mismatch for ${entry.name}: the download does not match the SHA-256 in the release notes, so it was not installed`);
  }

  // A fresh private (0700) directory per download: no predictable path for
  // another local user to pre-create or swap between the checksum and install.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'firetv-apk-'));
  const apkPath = path.join(dir, `${entry.id}.apk`);
  fs.writeFileSync(apkPath, buf);
  return apkPath;
}

/**
 * Deletes a download's temp directory (the one downloadApk created).
 * @param {string} apkPath
 */
export function removeDownload(apkPath) {
  fs.rmSync(path.dirname(apkPath), { recursive: true, force: true });
}

/**
 * @param {string} ip
 * @param {ScreensaverEntry} entry
 * @param {{onProgress?: (message: string) => void}} [options]
 * @returns {Promise<void>}
 */
export async function installScreensaver(ip, entry, { onProgress } = {}) {
  onProgress?.('cloning source');
  // The clone is only a local copy of the source to read. The APK below is
  // what gets installed and is verified separately, so a failed clone (for
  // example no git installed) must not block the install.
  try {
    await cloneIfMissing(entry);
  } catch (err) {
    onProgress?.(`source clone skipped (${describeAdbError(err)})`);
  }
  onProgress?.('fetching latest release');
  const apkPath = await downloadApk(entry);
  try {
    onProgress?.('installing on the TV');
    await installApk(ip, apkPath);
  } finally {
    removeDownload(apkPath);
  }
}

/**
 * @param {string} ip
 * @param {ScreensaverEntry} entry
 * @returns {Promise<boolean>} whether the package was actually removed
 */
export async function uninstallScreensaver(ip, entry) {
  return uninstallPackage(ip, entry.pkg);
}

/** @returns {void} */
export function deleteLocalClones() {
  fs.rmSync(SCREENSAVERS_DIR, { recursive: true, force: true });
}

/** @returns {boolean} */
export function hasLocalClones() {
  return fs.existsSync(SCREENSAVERS_DIR) && fs.readdirSync(SCREENSAVERS_DIR).length > 0;
}
