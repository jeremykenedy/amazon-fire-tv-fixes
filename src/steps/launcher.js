import chalk from 'chalk';
import { select } from '../prompts.js';
import { explainStep } from '../ui.js';
import { runWizard } from '../wizard.js';
import { startSpinner } from '../spinner.js';
import { launcherState, installLauncherApp, useHome } from '../apply/launcher.js';
import { versionAtLeast } from '../apply/guard.js';
import { packageVersion } from '../adb.js';
import { AT4K, LTV, HOME_REDIRECT, FIRE_TV_UI, HOME_LAUNCHERS, HOME_TARGET_VERSION, launcherApps } from '../launcher-registry.js';
import { markFailed } from '../exit-status.js';
import { print } from '../output.js';

export const FLAG_SPEC = {
  install: { type: 'boolean', desc: 'Install or update AT4K and the Home Redirect app.' },
  'install-ltv': { type: 'boolean', desc: 'Install or update LTvLauncher and the Home Redirect app.' },
  use: { type: 'string', choices: ['at4k', 'ltv', 'amazon', 'fire-tv-ui'], desc: 'Where the Home button goes: at4k, ltv, amazon or fire-tv-ui.' },
  yes: { type: 'boolean', desc: 'For scripts; --install, --install-ltv or --use is still required.' },
};

const HOME_NAMES = { at4k: 'AT4K', ltv: 'LTvLauncher', amazon: 'the Amazon menu', 'fire-tv-ui': 'Fire TV UI' };

/**
 * Installs a launcher and the Home Redirect app, reporting each one.
 * @param {string} ip
 * @param {'at4k' | 'ltv'} id
 * @returns {Promise<boolean>} whether both are installed afterwards
 */
async function installAll(ip, id) {
  // Updating Home Redirect in place can make Android drop it from the enabled
  // accessibility services, which quietly sends Home back to the Amazon menu.
  const homeBefore = (await launcherState(ip)).home;
  const apps = launcherApps(id);
  let ok = true;
  for (const app of apps) {
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
  if (HOME_LAUNCHERS.some((app) => app.id === homeBefore) && state.home !== homeBefore) {
    await useHome(ip, homeBefore);
  }
  return ok || apps.every((app) => state.installed.includes(app.id));
}

const INSTALL_FLAGS = { at4k: 'install', ltv: 'install-ltv' };

/**
 * @param {string} ip
 * @param {'at4k' | 'ltv' | 'amazon' | 'fire-tv-ui'} mode
 * @returns {Promise<void>}
 */
async function switchHome(ip, mode) {
  const state = await launcherState(ip);
  if (mode === FIRE_TV_UI.id && !state.installed.includes(FIRE_TV_UI.id)) {
    print(chalk.red('\nFire TV UI needs to be installed first. Run firetv-ui --install.\n'));
    markFailed();
    return;
  }
  if (INSTALL_FLAGS[mode] && !launcherApps(mode).every((app) => state.installed.includes(app.id))) {
    print(chalk.red(`\n${HOME_NAMES[mode]} and the Home Redirect app both need to be installed first. Run firetv-launcher --${INSTALL_FLAGS[mode]}.\n`));
    markFailed();
    return;
  }
  if (mode === LTV.id && !versionAtLeast(await packageVersion(ip, HOME_REDIRECT.pkg), HOME_TARGET_VERSION)) {
    print(chalk.red(`\nThe Home Redirect app needs updating to open LTvLauncher. Run firetv-launcher --install-ltv.\n`));
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
 * @param {{install?: boolean, 'install-ltv'?: boolean, use?: 'at4k' | 'ltv' | 'amazon' | 'fire-tv-ui'}} flags
 */
async function runFromFlags(ip, flags) {
  for (const id of [AT4K.id, LTV.id]) {
    if (flags[INSTALL_FLAGS[id]] && !(await installAll(ip, id))) {
      markFailed();
      if (flags.use === id) {
        return;
      }
    }
  }
  if (flags.use) {
    await switchHome(ip, flags.use);
  }
}

function menuChoices(state) {
  const choices = [];
  for (const app of HOME_LAUNCHERS) {
    const installed = launcherApps(app.id).every((a) => state.installed.includes(a.id));
    choices.push({ name: `${installed ? 'Update' : 'Install'} ${HOME_NAMES[app.id]} and the Home Redirect app`, value: `install:${app.id}` });
  }
  if (state.home === 'amazon' || (state.home !== AT4K.id && state.installed.includes(AT4K.id))) {
    choices.push({ name: 'Use AT4K as the home screen', value: AT4K.id });
  }
  if (state.home !== LTV.id && state.installed.includes(LTV.id)) {
    choices.push({ name: 'Use LTvLauncher as the home screen', value: LTV.id });
  }
  if (state.home !== 'amazon') {
    choices.push({ name: 'Go back to the Amazon home screen', value: 'amazon' });
  }
  if (state.installed.includes(FIRE_TV_UI.id) && state.home !== FIRE_TV_UI.id) {
    choices.push({ name: 'Use Fire TV UI as the home screen', value: FIRE_TV_UI.id });
  }
  return choices;
}

/**
 * `firetv-launcher`: installs the optional AT4K or LTvLauncher home screen and
 * switches the Home button between installed launchers and the Amazon menu.
 * @param {string} ip
 * @param {{install?: boolean, 'install-ltv'?: boolean, use?: 'at4k' | 'ltv' | 'amazon' | 'fire-tv-ui', yes?: boolean}} [flags]
 * @returns {Promise<void>}
 */
export async function manageLauncher(ip, flags = {}) {
  if (flags.install || flags['install-ltv'] || flags.use) {
    await runFromFlags(ip, flags);
    return;
  }
  if (flags.yes) {
    print(chalk.red('\n--yes alone does not pick anything. Pass --install, --install-ltv, --use=at4k, --use=ltv, --use=amazon or --use=fire-tv-ui.\n'));
    markFailed();
    return;
  }

  const state = await launcherState(ip);
  explainStep({
    title: 'Step: Choose the home screen',
    body: [
      'AT4K and LTvLauncher are optional, ad-free home screens. Fire OS has no',
      'setting for choosing a home app, so the Home Redirect app sends the Home',
      'button to the one you pick. It also adds a Screensavers tile to the TV',
      'for switching the screensaver from the couch. Going back to the Amazon',
      'menu is one step.',
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
      if (answers.action.startsWith('install:')) {
        const id = answers.action.slice('install:'.length);
        await runFromFlags(ip, { [INSTALL_FLAGS[id]]: true });
      } else {
        await switchHome(ip, answers.action);
      }
    },
  });
}
