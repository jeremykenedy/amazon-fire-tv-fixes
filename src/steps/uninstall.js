import chalk from 'chalk';
import ora from 'ora';
import { checkbox } from '@inquirer/prompts';
import { explainStep } from '../ui.js';
import { runWizard } from '../wizard.js';
import { enforceGuardrail } from '../guardrail.js';
import { listPackages } from '../adb.js';
import { isAlexaFixEnabled } from '../apply/alexa-fix.js';
import { getActiveScreensaver } from '../apply/set-screensaver.js';
import { hasLocalClones } from '../apply/screensavers.js';
import { revertAlexaFix, revertActiveScreensaver, removeScreensaver, removeLocalClones } from '../apply/uninstall.js';
import { SCREENSAVERS, AMAZON_DEFAULT } from '../screensaver-registry.js';

export const FLAG_SPEC = {
  all: { type: 'boolean' },
  yes: { type: 'boolean' },
  force: { type: 'boolean' },
};

/**
 * @param {string} ip
 * @returns {Promise<{options: Array<{name: string, value: string}>, installedScreensavers: import('../apply/screensavers.js').ScreensaverEntry[]}>}
 */
async function findOptions(ip) {
  const alexaFixOn = await isAlexaFixEnabled(ip);
  const activeScreensaver = await getActiveScreensaver(ip);
  const installedPkgs = await listPackages(ip);
  const installedScreensavers = SCREENSAVERS.filter((s) => installedPkgs.includes(s.pkg));
  const localClones = hasLocalClones();

  const options = [];
  if (alexaFixOn) {
    options.push({ name: 'Revert the Alexa deep-sleep fix (back to factory)', value: 'alexa' });
  }
  if (activeScreensaver !== AMAZON_DEFAULT.dreamComponent) {
    options.push({ name: 'Reset the active screensaver to the Amazon default', value: 'active' });
  }
  for (const s of installedScreensavers) {
    options.push({ name: `Remove ${s.name} from the TV`, value: `pkg:${s.id}` });
  }
  if (localClones) {
    options.push({ name: 'Delete locally cloned screensaver source (./screensavers)', value: 'local' });
  }

  return { options, installedScreensavers };
}

/**
 * @param {string} ip
 * @param {string[]} selected
 * @param {import('../apply/screensavers.js').ScreensaverEntry[]} installedScreensavers
 * @returns {Promise<void>}
 */
async function applySelection(ip, selected, installedScreensavers) {
  if (selected.includes('alexa')) {
    await revertAlexaFix(ip);
    console.log(chalk.green('Alexa deep-sleep fix reverted.'));
  }

  if (selected.includes('active')) {
    await revertActiveScreensaver(ip);
    console.log(chalk.green('Active screensaver reset to Amazon default.'));
  }

  for (const s of installedScreensavers) {
    if (!selected.includes(`pkg:${s.id}`)) continue;
    const spinner = ora(`Removing ${s.name}`).start();
    await removeScreensaver(ip, s);
    spinner.succeed(`${s.name} removed.`);
  }

  if (selected.includes('local')) {
    removeLocalClones();
    console.log(chalk.green('Local screensaver source removed.'));
  }

  console.log(chalk.green('\nDone.\n'));
}

/**
 * @param {string} ip
 * @param {{all?: boolean, yes?: boolean, force?: boolean}} [flags]
 * @returns {Promise<void>}
 */
export async function uninstallEverything(ip, flags = {}) {
  const { options, installedScreensavers } = await findOptions(ip);

  if (options.length === 0) {
    console.log(chalk.green('\nNothing to undo. The device is already at factory defaults.\n'));
    return;
  }

  if (flags.yes && !flags.all) {
    console.log(chalk.gray('\n--yes without --all reverts nothing. Pass --all to revert everything, or run this interactively to pick what to keep.\n'));
    return;
  }

  if (flags.all) {
    const selected = options.map((o) => o.value);
    const allowed = await enforceGuardrail({
      risky: true,
      warning: 'This reverts every fix and removes every screensaver this tool installed.',
      saferCommand: 'amazon-fire-tv-fixes-uninstall (interactive, pick what to keep)',
      force: Boolean(flags.force),
      interactive: false,
    });
    if (!allowed) return;
    await applySelection(ip, selected, installedScreensavers);
    return;
  }

  explainStep({
    title: 'Uninstall: reverse everything this tool has done',
    body: [
      'Everything below is unchecked or checked based on what is actually',
      'applied right now. Uncheck anything you want to keep.',
    ],
  });

  await runWizard({
    steps: [
      {
        key: 'selected',
        prompt: () =>
          checkbox({
            message: 'What should be reverted?',
            choices: options.map((o) => ({ ...o, checked: true })),
          }),
      },
    ],
    buildSummary: (state) => options.filter((o) => state.selected.includes(o.value)).map((o) => ({ label: o.name })),
    onConfirm: async (state) => {
      if (state.selected.length === 0) {
        console.log(chalk.gray('\nNothing selected. No changes were made.\n'));
        return;
      }

      const allowed = await enforceGuardrail({
        risky: true,
        warning: 'This reverts fixes and removes screensavers from the TV.',
        saferCommand: null,
        force: Boolean(flags.force),
        interactive: true,
      });
      if (!allowed) return;

      await applySelection(ip, state.selected, installedScreensavers);
    },
  });
}
