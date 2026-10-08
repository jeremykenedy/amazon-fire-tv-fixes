import chalk from 'chalk';
import { select } from '../prompts.js';
import { explainStep } from '../ui.js';
import { runWizard } from '../wizard.js';
import { startSpinner } from '../spinner.js';
import { launcherState, installLauncherApp, useHome } from '../apply/launcher.js';
import { LAUNCHER_APPS } from '../launcher-registry.js';
import { markFailed } from '../exit-status.js';
import { print } from '../output.js';

export const FLAG_SPEC = {
  install: { type: 'boolean', desc: 'Install or update AT4K and the Home Redirect app.' },
  use: { type: 'string', choices: ['at4k', 'amazon'], desc: 'Where the Home button goes: at4k or amazon.' },
  yes: { type: 'boolean', desc: 'For scripts; --install or --use is still required.' },
};

const HOME_NAMES = { at4k: 'AT4K', amazon: 'the Amazon menu' };

/**
 * Installs both launcher apps, reporting each one.
 * @param {string} ip
 * @returns {Promise<boolean>} whether both are installed afterwards
 */
async function installAll(ip) {
  // Updating Home Redirect in place can make Android drop it from the enabled
  // accessibility services, which quietly sends Home back to the Amazon menu.
  const homeBefore = (await launcherState(ip)).home;
  let ok = true;
  for (const app of LAUNCHER_APPS) {
    const spinner = startSpinner(`Installing ${app.name}`);
    const result = await installLauncherApp(ip, app);
    if (result.ok) {
      spinner.succeed(`${app.name} installed.`);
    } else {
      spinner.fail(`${app.name}: ${result.error}.`);
      ok = false;
    }
  }
  const state = await launcherState(ip);
  if (homeBefore === 'at4k' && state.home !== 'at4k') {
    await useHome(ip, 'at4k');
  }
  return ok || state.installed.length === LAUNCHER_APPS.length;
}

/**
 * @param {string} ip
 * @param {'at4k' | 'amazon'} mode
 * @returns {Promise<void>}
 */
async function switchHome(ip, mode) {
  const state = await launcherState(ip);
  if (mode === 'at4k' && state.installed.length < LAUNCHER_APPS.length) {
    print(chalk.red('\nAT4K and the Home Redirect app both need to be installed first. Run firetv-launcher --install.\n'));
    markFailed();
    return;
  }
  if (state.home === mode) {
    print(chalk.gray(`\nThe Home button already goes to ${HOME_NAMES[mode]}.\n`));
    return;
  }
  if (await useHome(ip, mode)) {
    print(chalk.green(`\nDone. The Home button now goes to ${HOME_NAMES[mode]}.\n`));
  } else {
    print(chalk.red(`\nThe TV did not switch to ${HOME_NAMES[mode]}. Check that ADB debugging is still on and try again.\n`));
    markFailed();
  }
}

/**
 * @param {string} ip
 * @param {{install?: boolean, use?: 'at4k' | 'amazon'}} flags
 */
async function runFromFlags(ip, flags) {
  if (flags.install && !(await installAll(ip))) {
    markFailed();
    if (flags.use === 'at4k') {
      return;
    }
  }
  if (flags.use) {
    await switchHome(ip, flags.use);
  }
}

function menuChoices(state) {
  const installed = state.installed.length === LAUNCHER_APPS.length;
  const choices = [{ name: installed ? 'Update AT4K and the Home Redirect app' : 'Install AT4K and the Home Redirect app', value: 'install' }];
  if (state.home === 'amazon') {
    choices.push({ name: 'Use AT4K as the home screen', value: 'at4k' });
  } else {
    choices.push({ name: 'Go back to the Amazon home screen', value: 'amazon' });
  }
  return choices;
}

/**
 * `firetv-launcher`: installs the optional AT4K home screen and switches the
 * Home button between it and the Amazon menu.
 * @param {string} ip
 * @param {{install?: boolean, use?: 'at4k' | 'amazon', yes?: boolean}} [flags]
 * @returns {Promise<void>}
 */
export async function manageLauncher(ip, flags = {}) {
  if (flags.install || flags.use) {
    await runFromFlags(ip, flags);
    return;
  }
  if (flags.yes) {
    print(chalk.red('\n--yes alone does not pick anything. Pass --install, --use=at4k or --use=amazon.\n'));
    markFailed();
    return;
  }

  const state = await launcherState(ip);
  explainStep({
    title: 'Step: Choose the home screen',
    body: [
      'AT4K is an optional, ad-free home screen. Fire OS has no setting for',
      'choosing a home app, so the Home Redirect app sends the Home button to',
      'AT4K. It also adds a Screensavers tile to the TV for switching the',
      'screensaver from the couch. Going back to the Amazon menu is one step.',
      '',
      `Right now the Home button goes to ${HOME_NAMES[state.home]}.`,
    ],
    settingChanged: 'secure enabled_accessibility_services',
    reversible: true,
    standaloneCommand: 'firetv-launcher',
  });

  await runWizard({
    steps: [{ key: 'action', prompt: () => select({ message: 'What would you like to do?', choices: menuChoices(state) }) }],
    buildSummary: (answers) => [{ label: menuChoices(state).find((c) => c.value === answers.action).name }],
    onConfirm: async (answers) => {
      if (answers.action === 'install') {
        await runFromFlags(ip, { install: true });
      } else {
        await switchHome(ip, answers.action);
      }
    },
  });
}
