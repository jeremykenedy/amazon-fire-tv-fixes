import chalk from 'chalk';
import { renderBanner } from '../banner.js';
import { menu } from '../ui.js';
import { isInstalled, setInstalled } from '../device-config.js';
import { ensureDeviceReady } from './device-setup.js';
import { installAdbStep } from './install-adb.js';
import { alexaFixMenu } from './alexa-fix.js';
import { manageScreensavers } from './screensavers.js';
import { setScreensaver } from './set-screensaver.js';
import { reviewTimeoutsIfWanted, manageAllTimeoutsStep } from './timeout-manage.js';

/**
 * The full guided flow: banner, adb check, device setup, optional timeout
 * review, then the interactive "What would you like to do?" menu loop.
 * Shared by every entry point that launches the guided experience
 * (`amazon-fire-tv-fixes`, `start`, `update`), so they can never drift
 * apart. Marks INSTALLED=true in .env the moment device setup succeeds with
 * a saved IP.
 * @returns {Promise<void>}
 */
export async function runMainMenu({ showBanner = true } = {}) {
  if (showBanner) renderBanner();

  console.log('What this does, one line per step:');
  console.log(chalk.gray('  1. Install Android SDK Platform Tools (adb) if you do not have it.'));
  console.log(chalk.gray('  2. Turn the Alexa deep-sleep fix on or off.'));
  console.log(chalk.gray('  3. Install or remove ad-free screensavers.'));
  console.log(chalk.gray('  4. Choose which installed screensaver is active.'));
  console.log(chalk.gray('  5. Review or change the TV sleep and screensaver timeouts (optional).'));
  console.log(chalk.gray('\nEach standalone command is named after its step in the README.\n'));

  await installAdbStep();
  const ip = await ensureDeviceReady();
  setInstalled(true);
  await reviewTimeoutsIfWanted(ip);

  // eslint-disable-next-line no-constant-condition
  while (true) { // NOSONAR - exits via process.exit(0) inside menu() on "Exit"
    const choice = await menu({
      top: true,
      message: 'What would you like to do?',
      choices: [
        { name: 'Install Android SDK Platform Tools (adb)', value: 'adb' },
        { name: 'Toggle Amazon deep-sleep fix', value: 'alexa' },
        { name: 'Install or uninstall screensavers', value: 'screensavers' },
        { name: 'Choose the active screensaver', value: 'set-screensaver' },
        { name: 'Review or adjust TV timeouts', value: 'timeouts' },
      ],
    });

    if (choice === 'adb') await installAdbStep();
    if (choice === 'alexa') await alexaFixMenu(ip);
    if (choice === 'screensavers') await manageScreensavers(ip);
    if (choice === 'set-screensaver') await setScreensaver(ip);
    if (choice === 'timeouts') await manageAllTimeoutsStep(ip);
  }
}

/**
 * Entry point for `start`. If a previous run already completed
 * device setup (INSTALLED=true in .env), this is really an update, so it
 * says so and defers to the exact same behavior runUpdateCommand gives.
 * Otherwise it just runs the normal guided flow.
 * @returns {Promise<void>}
 */
export async function runStartCommand() {
  if (isInstalled()) {
    renderBanner();
    console.log(chalk.yellow('Fire TV Tools is already installed. Running update...\n'));
    await runUpdateCommand({ showBanner: false });
    return;
  }
  await runMainMenu();
}

/**
 * Entry point for `update`. If nothing is installed yet, there is nothing
 * to override, so it says so and runs the normal guided flow instead.
 * Otherwise it warns that continuing will override the values already
 * installed (saved IP, etc), then runs the same guided flow.
 * @param {{showBanner?: boolean}} [options]
 * @returns {Promise<void>}
 */
export async function runUpdateCommand({ showBanner = true } = {}) {
  if (showBanner) renderBanner();
  if (!isInstalled()) {
    console.log(chalk.yellow('Fire TV Tools is not installed yet. Running setup...\n'));
    await runMainMenu({ showBanner: false });
    return;
  }
  console.log(chalk.yellow('This will override the values already installed (your saved Fire TV IP, etc). Press q at the first prompt to cancel.\n'));
  await runMainMenu({ showBanner: false });
}
