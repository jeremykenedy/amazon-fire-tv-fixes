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
let screensaversDir = DEFAULT_SCREENSAVERS_DIR;

/** @returns {string} the folder local screensaver clones live in */
export function getScreensaversDir() {
  return screensaversDir;
}

/**
 * Test-only: points the local clones at a throwaway folder. Never read from
 * the environment, so nothing outside the tests can redirect what gets deleted.
 * @param {string | null} dirPath null restores the project's own folder
 */
export function setScreensaversDirForTesting(dirPath) {
  screensaversDir = dirPath || DEFAULT_SCREENSAVERS_DIR;
}

/**
 * @typedef {Object} ScreensaverEntry
 * @property {string} id
 * @property {string} name
 * @property {string} pkg
 * @property {string} dreamComponent
 * @property {string} repo
 * @property {string} [asset] exact APK file name, when the release carries more than one
 * @property {string} [tag] a specific release tag instead of the latest release
 * @property {string} [sha256] a checksum pinned here, for authors who publish none
 */

/**
 * Pure: pulls the "SHA-256: <64 hex chars>" line out of a release's notes,
 * or null if the notes don't record one. A release that carries more than
 * one APK records one line per file, "SHA-256 (<asset name>): <hex>", and
 * assetName picks the line for that file only.
 * @param {string | null | undefined} notes
 * @param {string} [assetName]
 * @returns {string | null}
 */
export function parseSha256FromNotes(notes, assetName) {
  const label = assetName ? `SHA-256 (${assetName}):` : 'SHA-256:';
  for (const line of (notes || '').split('\n')) {
    const at = line.indexOf(label);
    const match = at === -1 ? null : /^\s*([0-9a-fA-F]{64})\b/.exec(line.slice(at + label.length));
    if (match) {
      return match[1].toLowerCase();
    }
  }
  return null;
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
 * @param {string} [assetName] exact asset file name, for a release that carries more than one APK
 * @param {string} [tag] a specific release tag instead of the latest release
 * @returns {Promise<{apkUrl: string, sha256: string | null, sha256Url: string | null, tag: string}>} the .apk asset from the latest release, its checksum from the notes, and its .sha256 file if one was published
 */
export async function latestRelease(repo, assetName, tag) {
  const which = tag ? `tags/${encodeURIComponent(tag)}` : 'latest';
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/${which}`);
  if (res.status === 404) {
    throw new Error(`${repo} has no published release, so there is no APK to install from it`);
  }
  if (!res.ok) {
    throw new Error(`GitHub API returned ${res.status} for ${repo}`);
  }
  const release = await res.json();
  const assets = release.assets || [];
  const apk = assets.find((a) => (assetName ? a.name === assetName : a.name.endsWith('.apk')));
  if (!apk) {
    throw new Error(`No ${assetName || '.apk'} asset found on the latest release of ${repo}`);
  }
  const checksumFile = assets.find((a) => a.name === `${apk.name}.sha256`);
  return {
    apkUrl: apk.browser_download_url,
    sha256: parseSha256FromNotes(release.body, assetName),
    sha256Url: checksumFile ? checksumFile.browser_download_url : null,
    tag: release.tag_name,
  };
}

/**
 * Pure: the hash from a "<apk>.sha256" file, which starts with the 64 hex
 * characters (the `sha256sum` format, optionally followed by the file name).
 * @param {string | null | undefined} text
 * @returns {string | null}
 */
export function parseSha256File(text) {
  const match = /^\s*([0-9a-fA-F]{64})\b/.exec(text || '');
  return match ? match[1].toLowerCase() : null;
}

/**
 * Reads the checksum a release publishes as its own "<apk>.sha256" asset,
 * with the same URL and redirect checks as the APK itself.
 * @param {string} url
 * @param {string} repo
 * @returns {Promise<string | null>}
 */
async function fetchSha256File(url, repo) {
  assertTrustedApkUrl(url, repo);
  const res = await fetchTrusted(url);
  if (!res.ok) {
    throw new Error(`Downloading the checksum file failed with status ${res.status}`);
  }
  return parseSha256File(await res.text());
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
  const dest = path.join(screensaversDir, entry.id);
  if (fs.existsSync(dest)) {
    return false;
  }
  fs.mkdirSync(screensaversDir, { recursive: true });
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
  const { apkUrl, sha256: fromNotes, sha256Url } = await latestRelease(entry.repo, entry.asset, entry.tag);
  assertTrustedApkUrl(apkUrl, entry.repo);
  // A hash pinned in the registry wins: it is used for apps whose author
  // publishes no checksum, and it cannot be changed by editing the release.
  const sha256 = entry.sha256 || fromNotes || (sha256Url ? await fetchSha256File(sha256Url, entry.repo) : null);
  const res = await fetchTrusted(apkUrl);
  if (!res.ok) {
    throw new Error(`Download failed with status ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());

  if (!sha256) {
    throw new Error(`No valid SHA-256 checksum in the release notes or a .sha256 file for ${entry.name}; refusing to install an unverified download`);
  }
  const actual = crypto.createHash('sha256').update(buf).digest('hex');
  if (actual !== sha256) {
    throw new Error(`Checksum mismatch for ${entry.name}: the download does not match the SHA-256 published with the release, so it was not installed`);
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
  fs.rmSync(screensaversDir, { recursive: true, force: true });
}

/** @returns {boolean} */
export function hasLocalClones() {
  return fs.existsSync(screensaversDir) && fs.readdirSync(screensaversDir).length > 0;
}
