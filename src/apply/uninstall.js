import { setAlexaFix } from './alexa-fix.js';
import { setActiveScreensaver } from './set-screensaver.js';
import { uninstallScreensaver, deleteLocalClones } from './screensavers.js';
import { AMAZON_DEFAULT } from '../screensaver-registry.js';

/**
 * @param {string} ip
 * @returns {Promise<void>}
 */
export async function revertAlexaFix(ip) {
  await setAlexaFix(ip, false);
}

/**
 * @param {string} ip
 * @returns {Promise<void>}
 */
export async function revertActiveScreensaver(ip) {
  await setActiveScreensaver(ip, AMAZON_DEFAULT.dreamComponent);
}

/**
 * @param {string} ip
 * @param {import('./screensavers.js').ScreensaverEntry} entry
 * @returns {Promise<void>}
 */
export async function removeScreensaver(ip, entry) {
  await uninstallScreensaver(ip, entry);
}

/** @returns {void} */
export function removeLocalClones() {
  deleteLocalClones();
}
