import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * @typedef {Object} InstallCommand
 * @property {string} cmd
 * @property {string[]} args
 * @property {string} display
 * @property {string} [note]
 */

/**
 * Pure: what command would install adb on this platform, or null if there
 * isn't a scriptable one. No side effects, so this is unit-testable.
 * @param {NodeJS.Platform} [platform]
 * @returns {InstallCommand | null}
 */
export function platformInstallCommand(platform = process.platform) {
  switch (platform) {
    case 'darwin':
      return { cmd: 'brew', args: ['install', 'android-platform-tools'], display: 'brew install android-platform-tools' };
    case 'linux':
      return {
        cmd: 'sudo',
        args: ['apt-get', 'install', '-y', 'android-tools-adb'],
        display: 'sudo apt-get install -y android-tools-adb',
        note: 'On Fedora/RHEL, use: sudo dnf install android-tools',
      };
    default:
      return null;
  }
}

/**
 * @param {InstallCommand} platform
 * @returns {Promise<void>}
 */
export async function runInstallCommand(platform) {
  await execFileAsync(platform.cmd, platform.args, { timeout: 300000 });
}
