import { setAlexaFix } from './alexa-fix.js';
import { setActiveScreensaver, getActiveScreensaver } from './set-screensaver.js';
import { uninstallScreensaver, deleteLocalClones } from './screensavers.js';
import { AMAZON_DEFAULT } from '../screensaver-registry.js';

/**
 * @param {string} ip
 * @returns {Promise<boolean>} whether the fix now reads back as off
 */
export async function revertAlexaFix(ip) {
  return !(await setAlexaFix(ip, false));
}

/**
 * @param {string} ip
 * @returns {Promise<boolean>} whether the Amazon default now reads back as active
 */
export async function revertActiveScreensaver(ip) {
  await setActiveScreensaver(ip, AMAZON_DEFAULT.dreamComponent);
  return (await getActiveScreensaver(ip)) === AMAZON_DEFAULT.dreamComponent;
}

/**
 * @param {string} ip
 * @param {import('./screensavers.js').ScreensaverEntry} entry
 * @returns {Promise<boolean>} whether the package was actually removed
 */
export async function removeScreensaver(ip, entry) {
  return uninstallScreensaver(ip, entry);
}

/** @returns {void} */
export function removeLocalClones() {
  deleteLocalClones();
}
