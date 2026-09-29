import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { input } from './prompts.js';

// Resolved relative to this file, not process.cwd(), so it always finds
// the project's own .env regardless of the directory the command was run
// from.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
export const ENV_PATH = path.join(PROJECT_ROOT, '.env');
const ENV_EXAMPLE_PATH = path.join(PROJECT_ROOT, '.env.example');

const IP_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function isValidIp(value) {
  const match = IP_RE.exec(value.trim());
  if (!match) return false;
  return match.slice(1).every((octet) => Number(octet) >= 0 && Number(octet) <= 255);
}

/**
 * Pure: pulls FIRE_TV_IP out of a raw .env file's contents, or null if
 * there isn't one. No filesystem access, so this is unit-testable on its
 * own.
 */
export function parseIpFromEnv(raw) {
  if (!raw) return null;
  const parsed = dotenv.parse(raw);
  return parsed.FIRE_TV_IP || null;
}

/**
 * Pure: returns the new contents of the .env file with FIRE_TV_IP set to
 * ip, given the file's current raw contents (or null if it does not exist
 * yet, in which case fallbackTemplate is used as the starting point). This
 * replaces the existing FIRE_TV_IP line in place if there is one, so any
 * other variables or comments survive, and appends the line otherwise.
 */
export function mergeIpIntoEnv(raw, ip, fallbackTemplate = 'FIRE_TV_IP=\n') {
  const base = raw === null ? fallbackTemplate : raw;
  const line = `FIRE_TV_IP=${ip}`;
  const hasKey = /^FIRE_TV_IP=.*$/m.test(base);
  return hasKey ? base.replace(/^FIRE_TV_IP=.*$/m, line) : `${base.trimEnd()}\n${line}\n`;
}

/**
 * Pure: pulls INSTALLED out of a raw .env file's contents. Absent or
 * anything other than the literal string "true" reads as false.
 */
export function parseInstalledFromEnv(raw) {
  if (!raw) return false;
  return dotenv.parse(raw).INSTALLED === 'true';
}

/**
 * Pure: returns the new contents of the .env file with INSTALLED set to
 * installed, given the file's current raw contents (or null if it does not
 * exist yet). Replaces the existing INSTALLED line in place if there is
 * one, keeping every other line untouched, appends otherwise.
 */
export function mergeInstalledIntoEnv(raw, installed) {
  const base = raw === null ? '' : raw;
  const line = `INSTALLED=${Boolean(installed)}`;
  const hasKey = /^INSTALLED=.*$/m.test(base);
  if (hasKey) return base.replace(/^INSTALLED=.*$/m, line);
  return base.trim() === '' ? `${line}\n` : `${base.trimEnd()}\n${line}\n`;
}

function readEnvFile() {
  try {
    return fs.readFileSync(ENV_PATH, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw new Error(`Could not read ${ENV_PATH} (${err.code || err.message}). Check that the file is readable.`);
  }
}

function writeEnvFile(contents) {
  try {
    fs.writeFileSync(ENV_PATH, contents);
  } catch (err) {
    throw new Error(`Could not save ${ENV_PATH} (${err.code || err.message}), so your settings were not saved. Check that this folder is writable.`);
  }
}

/**
 * @returns {string | null} the saved IP, or null if there is none or it is not
 * a valid IP (the .env.example placeholder 192.168.1.XXX does not count)
 */
export function getSavedIp() {
  const ip = parseIpFromEnv(readEnvFile());
  return ip && isValidIp(ip) ? ip : null;
}

export function saveIp(ip) {
  const raw = readEnvFile();
  const template = fs.existsSync(ENV_EXAMPLE_PATH) ? fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8') : undefined;
  const updated = mergeIpIntoEnv(raw, ip, template);
  writeEnvFile(updated);
}

/**
 * Pure: the single definition of "installed". INSTALLED must be true AND
 * FIRE_TV_IP must be set to a valid IP. A missing, empty, or placeholder IP
 * (the .env.example value 192.168.1.XXX fails isValidIp) means everything
 * is treated as not installed, even if INSTALLED=true.
 */
export function computeInstalled(raw) {
  const ip = parseIpFromEnv(raw);
  return parseInstalledFromEnv(raw) && Boolean(ip) && isValidIp(ip);
}

/**
 * @returns {boolean} whether a previous run completed device setup with a
 * saved IP.
 */
export function isInstalled() {
  return computeInstalled(readEnvFile());
}

/**
 * @param {boolean} installed
 */
export function setInstalled(installed) {
  const raw = readEnvFile();
  writeEnvFile(mergeInstalledIntoEnv(raw, installed));
}

/**
 * Every command except the installer entry points (amazon-fire-tv-fixes,
 * start, update, firetv, info) calls this first. Prints a clear refusal and
 * exits if setup has never completed, so nothing can act on a device that
 * was never connected.
 */
export function requireInstalled() {
  if (isInstalled()) return;
  console.log(chalk.red('\nFire TV Tools is not installed yet.'));
  console.log(chalk.gray('Run ') + chalk.green('start') + chalk.gray(' to set it up first, or ') + chalk.green('info') + chalk.gray(' to see what is available.\n'));
  process.exit(1);
}

/**
 * Pure: whether the user typed the quit key at the IP prompt.
 * @param {string} value
 * @returns {boolean}
 */
export function isQuitInput(value) {
  return ['q', 'quit'].includes(value.trim().toLowerCase());
}

export async function promptForIp(defaultValue) {
  const ip = await input({
    message: "What's your Fire TV's IP address? (q to quit)",
    default: defaultValue,
    validate: (value) =>
      isQuitInput(value) || isValidIp(value) ? true : 'Enter a valid IPv4 address, e.g. 192.168.1.49 (or q to quit)',
  });
  if (isQuitInput(ip)) {
    console.log(chalk.gray('\nNo changes were made.\n'));
    process.exit(0);
  }
  return ip.trim();
}

