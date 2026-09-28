import chalk from 'chalk';
import ora from 'ora';
import { explainStep, promptYN } from '../ui.js';
import { isAdbInstalled } from '../adb.js';
import { platformInstallCommand, runInstallCommand } from '../apply/install-adb.js';

export const FLAG_SPEC = {
  yes: { type: 'boolean' },
};

/**
 * Standalone step: install adb (Android SDK Platform Tools) if it isn't
 * already on PATH. Used by both the main menu and `firetv-install-adb`.
 * flags.yes skips the confirmation prompt; there is no other choice to make
 * for this command, so --yes is the whole non-interactive path.
 * @param {{yes?: boolean}} [flags]
 * @returns {Promise<boolean>} whether adb is installed when this returns
 */
export async function installAdbStep(flags = {}) {
  if (await isAdbInstalled()) {
    console.log(chalk.green('\nadb is already installed. Nothing to do.\n'));
    return true;
  }

  const platform = platformInstallCommand();

  explainStep({
    title: 'Step: Install Android SDK Platform Tools (adb)',
    body: [
      'This tool needs "adb" (Android Debug Bridge) to talk to your Fire TV',
      "over your network. It's a small, official Google command-line tool,",
      'not part of Android Studio, just the piece that lets a computer send',
      'commands to an Android device.',
      '',
      platform
        ? `On your system, this will run: ${chalk.cyan(platform.display)}`
        : "Automatic install isn't supported on Windows from here. Download the",
      !platform
        ? 'SDK Platform Tools manually: https://developer.android.com/tools/releases/platform-tools'
        : platform.note || '',
    ].filter(Boolean),
  });

  if (!platform) {
    console.log(chalk.yellow('\nInstall adb manually, then run this again.\n'));
    return false;
  }

  const proceed = flags.yes || (await promptYN('Install it now?'));
  if (!proceed) {
    console.log(chalk.gray('\nCancelled. Nothing was installed.\n'));
    return false;
  }

  const spinner = ora(`Running ${platform.display}...`).start();
  try {
    await runInstallCommand(platform);
    spinner.succeed('adb installed.');
    return true;
  } catch (err) {
    spinner.fail('Install failed.');
    console.log(chalk.red(err.stderr || err.message));
    return false;
  }
}
