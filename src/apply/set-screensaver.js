import { getSetting, putSetting } from '../adb.js';

const NAMESPACE = 'secure';
const KEY = 'screensaver_components';

/**
 * @param {string} ip
 * @returns {Promise<string | null>} the active dreamComponent
 */
export async function getActiveScreensaver(ip) {
  return getSetting(ip, NAMESPACE, KEY);
}

/**
 * @param {string} ip
 * @param {string} dreamComponent
 * @returns {Promise<void>}
 */
export async function setActiveScreensaver(ip, dreamComponent) {
  await putSetting(ip, NAMESPACE, KEY, dreamComponent);
}
