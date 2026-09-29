import chalk from 'chalk';
import { explainStep, promptYN } from '../ui.js';
import { isInstalled, getSavedIp } from '../device-config.js';
import { isAdbInstalled, connectAndCheck } from '../adb.js';
import { unlinkCommands, wipeEnvToTemplate, runDeleteRepoFlow } from '../app-teardown.js';
import { uninstallEverything } from './uninstall.js';
import { markFailed } from '../exit-status.js';

const WIPE_WARNING = 'Removing the commands also deletes the saved IP and the recorded timeout baselines, so the TV could no longer be reverted by this tool.';

/**
 * The TV half of `uninstall`, which has to run before .env is wiped because
 * the IP and the timeout baselines it needs live there. Offers the same
 * checklist as `amazon-fire-tv-fixes-uninstall`. If the TV can't be reached,
 * or the revert was cancelled, it asks before letting the wipe go ahead.
 * @returns {Promise<boolean>} whether to continue with removing the commands
 */
async function revertTvFirst() {
  explainStep({
    title: 'Step 1: put the TV back how it was',
    body: [
      'Before removing anything from this computer, you can undo what this tool',
      'changed on the TV (the Alexa fix, the active screensaver, installed',
      'screensavers, and any changed timeouts). Everything is checked by default.',
      'Uncheck anything you want to keep.',
    ],
  });

  const ip = getSavedIp();
  if (!(await isAdbInstalled())) {
    console.log(chalk.red('\nadb is not installed, so the TV cannot be reached.'));
    return promptYN(`Continue anyway? ${WIPE_WARNING}`);
  }
  if (!(await connectAndCheck(ip))) {
    console.log(chalk.red(`\nCould not reach the TV at ${ip}, so its settings cannot be reverted right now.`));
    return promptYN(`Continue anyway? ${WIPE_WARNING}`);
  }

  const outcome = await uninstallEverything(ip, {});
  if (outcome === 'cancelled' || outcome === 'failed') {
    console.log(chalk.yellow('\nThe TV was left as it is.'));
    return promptYN(`Remove the commands and reset .env anyway? ${WIPE_WARNING}`);
  }
  return true;
}

/**
 * `uninstall`. If Fire TV Tools is installed, first offers to put the TV
 * back how it was, then unlinks the global commands and wipes .env back to
 * its template. Either way, then offers to also delete the repo code, using
 * the same destructive confirm flow as the standalone `delete`/`remove`.
 * @returns {Promise<void>}
 */
export async function runUninstallCommand() {
  if (isInstalled()) {
    console.log(chalk.bold.white('\nUninstalling Fire TV Tools...\n'));

    if (!(await revertTvFirst())) {
      console.log(chalk.gray('\nNo changes were made to this computer.\n'));
      return;
    }

    console.log(chalk.bold.white('\nStep 2: remove the commands from this computer\n'));
    const unlinked = await unlinkCommands();
    if (unlinked.ok) {
      console.log(chalk.green('Commands unlinked from your PATH.'));
    } else {
      console.log(chalk.red(`Could not unlink the commands (${unlinked.error}). They are still on your PATH. Run "npm uninstall -g amazon-fire-tv-fixes" yourself.`));
      markFailed();
    }

    wipeEnvToTemplate();
    console.log(chalk.green('.env reset to its template.'));
    console.log(
      unlinked.ok
        ? chalk.green('\nFire TV Tools was successfully uninstalled.\n')
        : chalk.yellow('\nFire TV Tools was only partly uninstalled: the commands are still linked.\n')
    );
  } else {
    // Setup can link the commands and then be quit before a TV is connected,
    // so "not installed" does not mean nothing is on the PATH.
    const unlinked = await unlinkCommands();
    console.log(
      unlinked.ok
        ? chalk.yellow('\nFire TV Tools is not installed, so there was nothing to revert. Any leftover commands were removed from your PATH.\n')
        : chalk.yellow('\nFire TV Tools is not installed, so there is nothing to uninstall.\n')
    );
  }

  const wantsRepoRemoved = await promptYN('Would you also like to remove the repo code from your machine?');
  if (!wantsRepoRemoved) {
    console.log(chalk.gray('\nDone. The repo was left in place.\n'));
    return;
  }

  await runDeleteRepoFlow();
}
