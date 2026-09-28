import { getSetting, putSetting } from '../adb.js';

export const NAMESPACE = 'secure';
export const KEY = 'str.auto_wake_up_enabled';

/**
 * @param {string} ip
 * @returns {Promise<boolean>}
 */
export async function isAlexaFixEnabled(ip) {
  return (await getSetting(ip, NAMESPACE, KEY)) === '1';
}

/**
 * @param {string} ip
 * @param {boolean} enabled
 * @returns {Promise<boolean>} the fix state read back after the write
 */
export async function setAlexaFix(ip, enabled) {
  await putSetting(ip, NAMESPACE, KEY, enabled ? 1 : 0);
  return isAlexaFixEnabled(ip);
}
