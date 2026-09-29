import { readEnvFile, writeEnvFile } from './device-config.js';

/**
 * Pure: the .env key name a timeout id's captured baseline is stored under.
 * @param {string} id
 * @returns {string}
 */
function envKeyFor(id) {
  return `FIRE_TV_TIMEOUT_${id.toUpperCase()}_FACTORY_MS`;
}

/**
 * Pure: reads a timeout's captured baseline (ms) out of a raw .env file's
 * contents, or null if none has been captured yet for that id. No
 * filesystem access, so this is unit-testable on its own.
 * @param {string} id
 * @param {string | null} raw
 * @returns {number | null}
 */
export function parseBaselineFromEnv(id, raw) {
  if (!raw) return null;
  const match = new RegExp(`^${envKeyFor(id)}=(.*)$`, 'm').exec(raw);
  if (!match) return null;
  const ms = Number(match[1].trim());
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Pure: returns the new contents of the .env file with the given timeout
 * id's baseline set to ms, given the file's current raw contents (or null
 * if it does not exist yet). Replaces the existing line for that id in
 * place if there is one, keeping every other line untouched, or appends it
 * otherwise. Mirrors device-config.js's mergeIpIntoEnv exactly, generalized
 * to a per-id key instead of the single hardcoded FIRE_TV_IP key.
 * @param {string} id
 * @param {string | null} raw
 * @param {number} ms
 * @returns {string}
 */
export function mergeBaselineIntoEnv(id, raw, ms) {
  const base = raw || '';
  const key = envKeyFor(id);
  const line = `${key}=${ms}`;
  const keyRe = new RegExp(`^${key}=.*$`, 'm');
  if (keyRe.test(base)) return base.replace(keyRe, line);
  return base.trim() === '' ? `${line}\n` : `${base.trimEnd()}\n${line}\n`;
}

/**
 * @param {string} id
 * @returns {number | null}
 */
export function getFactoryBaseline(id) {
  return parseBaselineFromEnv(id, readEnvFile());
}

/**
 * @param {string} id
 * @returns {boolean}
 */
export function hasFactoryBaseline(id) {
  return getFactoryBaseline(id) !== null;
}

/**
 * @param {string} id
 * @param {number} ms
 */
export function saveFactoryBaseline(id, ms) {
  const raw = readEnvFile();
  writeEnvFile(mergeBaselineIntoEnv(id, raw, ms));
}
