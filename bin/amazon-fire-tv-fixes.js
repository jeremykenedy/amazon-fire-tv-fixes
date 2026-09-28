#!/usr/bin/env node
import chalk from 'chalk';
import { renderBanner } from '../src/banner.js';
import { menu } from '../src/ui.js';
import { ensureDeviceReady } from '../src/steps/device-setup.js';
import { installAdbStep } from '../src/steps/install-adb.js';
import { alexaFixMenu } from '../src/steps/alexa-fix.js';
import { manageScreensavers } from '../src/steps/screensavers.js';
import { setScreensaver } from '../src/steps/set-screensaver.js';

async function main() {
  renderBanner();

  console.log('What this does, one line per step:');
  console.log(chalk.gray('  1. Install Android SDK Platform Tools (adb) if you do not have it.'));
  console.log(chalk.gray('  2. Turn the Alexa deep-sleep fix on or off.'));
  console.log(chalk.gray('  3. Install or remove ad-free screensavers.'));
  console.log(chalk.gray('  4. Choose which installed screensaver is active.'));
  console.log(chalk.gray('\nEach standalone command is named after its step in the README.\n'));

  await installAdbStep();
  const ip = await ensureDeviceReady();

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
      ],
    });

    if (choice === 'adb') await installAdbStep();
    if (choice === 'alexa') await alexaFixMenu(ip);
    if (choice === 'screensavers') await manageScreensavers(ip);
    if (choice === 'set-screensaver') await setScreensaver(ip);
  }
}

main();
