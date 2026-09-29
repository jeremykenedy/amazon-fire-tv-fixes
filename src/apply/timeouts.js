import { getSetting, putSetting, listSettings } from '../adb.js';

/**
 * @typedef {Object} TimeoutDef
 * @property {string} id
 * @property {string} label
 * @property {string} namespace
 * @property {string} key
 * @property {string | null} zeroMeans what a value of 0 does on the device, or null if 0 isn't honored
 * @property {number | null} effectiveMaxMs community-documented practical ceiling to functionally disable it
 * @property {number | null} knownStockDefaultMs a documented stock default, used only until a real device is probed
 */

/** @type {TimeoutDef[]} */
export const TIMEOUTS = [
  {
    id: 'sleep',
    label: 'Sleep (deep-sleep/standby) timeout',
    namespace: 'secure',
    key: 'sleep_timeout',
    zeroMeans: 'never sleeps',
    effectiveMaxMs: null,
    knownStockDefaultMs: 1200000,
  },
  {
    id: 'screensaver',
    label: 'Screensaver timeout',
    namespace: 'system',
    key: 'screen_off_timeout',
    zeroMeans: null,
    effectiveMaxMs: 2147460000,
    knownStockDefaultMs: null,
  },
];

const RELATED_KEYWORDS = ['timeout', 'sleep', 'screensaver'];

/**
 * @param {string} id
 * @returns {TimeoutDef | undefined}
 */
export function findTimeoutById(id) {
  return TIMEOUTS.find((t) => t.id === id);
}

/**
 * @param {string} ip
 * @param {TimeoutDef} def
 * @returns {Promise<number | null>} the current value in ms, or null if unreadable
 */
export async function getTimeoutMs(ip, def) {
  const raw = await getSetting(ip, def.namespace, def.key);
  if (raw === null || raw === '' || raw === 'null') return null;
  const ms = Number(raw);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * @param {unknown} err
 * @returns {boolean} whether adb reached the device and the device itself refused the value
 */
export function isDeviceRejection(err) {
  return /IllegalArgumentException|java\.lang\./.test(`${err?.stderr ?? ''} ${err?.message ?? ''}`);
}

/**
 * Writes the value, then reads it back to confirm it actually took. Some
 * Fire OS builds silently ignore a value outside their own bounds instead of
 * rejecting the adb call; others throw a hard java.lang.IllegalArgumentException
 * from the device's SettingsProvider and adb exits non-zero (confirmed live
 * against a real Fire TV Edition set with an out-of-range screensaver
 * timeout). Both cases mean the same thing to the caller: the requested
 * value didn't take, so both are folded into the same {applied: false}
 * shape instead of letting the second one crash the process.
 * @param {string} ip
 * @param {TimeoutDef} def
 * @param {number} ms
 * @returns {Promise<{applied: boolean, readBackMs: number | null}>}
 */
export async function setTimeoutMs(ip, def, ms) {
  try {
    await putSetting(ip, def.namespace, def.key, ms);
  } catch (err) {
    if (!isDeviceRejection(err)) throw err;
    const readBackMs = await getTimeoutMs(ip, def).catch(() => null);
    return { applied: false, readBackMs };
  }
  const readBackMs = await getTimeoutMs(ip, def);
  return { applied: readBackMs === ms, readBackMs };
}

/**
 * Scans the secure + system settings namespaces for anything else that
 * looks timeout/sleep/screensaver-related and isn't already in TIMEOUTS, so
 * "what's possible" can report real device state instead of a fixed list.
 * @param {string} ip
 * @returns {Promise<string[]>} "namespace key=value" lines
 */
export async function listRelatedSettings(ip) {
  const known = new Set(TIMEOUTS.map((t) => `${t.namespace}:${t.key}`));
  const found = [];

  for (const namespace of ['secure', 'system']) {
    const lines = await listSettings(ip, namespace);
    for (const line of lines) {
      const key = line.split('=')[0];
      if (!key || known.has(`${namespace}:${key}`)) continue;
      if (RELATED_KEYWORDS.some((word) => key.toLowerCase().includes(word))) {
        found.push(`${namespace} ${line}`);
      }
    }
  }

  return found;
}
