import chalk from 'chalk';
import { select } from '../prompts.js';
import { explainStep } from '../ui.js';
import { runWizard } from '../wizard.js';
import { listPackages } from '../adb.js';
import { getActiveScreensaver, setActiveScreensaver } from '../apply/set-screensaver.js';
import { SCREENSAVERS, AMAZON_DEFAULT } from '../screensaver-registry.js';
import { markFailed } from '../exit-status.js';

const VALID_IDS = [AMAZON_DEFAULT.id, ...SCREENSAVERS.map((s) => s.id)];

export const FLAG_SPEC = {
  set: {
    type: 'string',
    choices: VALID_IDS,
    desc: 'Which installed screensaver to make active.',
  },
  yes: { type: 'boolean', desc: 'Skip prompts; picks the only installed screensaver if there is exactly one.' },
};

function findById(id) {
  return [AMAZON_DEFAULT, ...SCREENSAVERS].find((s) => s.id === id);
}

/**
 * Pure decision for `--yes` with no `--set`: default to the one installed
 * fork if exactly one is installed, otherwise refuse rather than guess.
 * @param {Array<{id: string}>} installedForks
 * @returns {{ok: true, choice: object} | {ok: false, reason: 'none' | 'multiple'}}
 */
export function resolveYesDefault(installedForks) {
  if (installedForks.length === 1) {
    return { ok: true, choice: installedForks[0] };
  }
  return { ok: false, reason: installedForks.length === 0 ? 'none' : 'multiple' };
}

/**
 * @param {string} ip
 * @param {{set?: string, yes?: boolean}} [flags]
 * @returns {Promise<void>}
 */
export async function setScreensaver(ip, flags = {}) {
  const installedPkgs = await listPackages(ip);
  const available = [AMAZON_DEFAULT, ...SCREENSAVERS.filter((s) => installedPkgs.includes(s.pkg))];
  const current = await getActiveScreensaver(ip);

  if (flags.set !== undefined) {
    const choice = findById(flags.set);
    if (!available.some((s) => s.id === choice.id)) {
      console.log(chalk.red(`\n${choice.name} is not installed. Install it first with firetv-screensavers.\n`));
      markFailed();
      return;
    }
    if (choice.dreamComponent === current) {
      console.log(chalk.gray(`\n${choice.name} is already the active screensaver.\n`));
      return;
    }
    await setActiveScreensaver(ip, choice.dreamComponent);
    console.log(chalk.green(`\nDone. Active screensaver is now ${choice.name}.\n`));
    return;
  }

  if (flags.yes) {
    const installedForks = SCREENSAVERS.filter((s) => installedPkgs.includes(s.pkg));
    const resolved = resolveYesDefault(installedForks);
    if (!resolved.ok) {
      const ids = VALID_IDS.join(', ');
      console.log(
        chalk.red(
          resolved.reason === 'none'
            ? `\nNo screensaver forks are installed, so there is nothing to default to. Pass --set explicitly: ${ids}\n`
            : `\nMore than one screensaver is installed, so there is no single default. Pass --set explicitly: ${ids}\n`
        )
      );
      markFailed();
      return;
    }
    if (resolved.choice.dreamComponent === current) {
      console.log(chalk.gray(`\n${resolved.choice.name} is already the active screensaver.\n`));
      return;
    }
    await setActiveScreensaver(ip, resolved.choice.dreamComponent);
    console.log(chalk.green(`\nDone. Active screensaver is now ${resolved.choice.name}.\n`));
    return;
  }

  explainStep({
    title: 'Step: Choose the active screensaver',
    body: [
      'Only one screensaver can be active at a time. This does not install',
      'or remove anything, it just tells the TV which installed one to use.',
    ],
    settingChanged: 'secure screensaver_components',
    reversible: true,
    standaloneCommand: 'firetv-set-screensaver',
  });

  await runWizard({
    steps: [
      {
        key: 'choice',
        prompt: () =>
          select({
            message: 'Set the active screensaver to:',
            choices: available.map((s) => ({
              name: s.dreamComponent === current ? `${s.name} (current)` : s.name,
              value: s,
            })),
          }),
      },
    ],
    buildSummary: (state) =>
      state.choice.dreamComponent === current
        ? []
        : [{ label: `Set active screensaver to ${state.choice.name}`, detail: state.choice.dreamComponent }],
    onConfirm: async (state) => {
      if (state.choice.dreamComponent === current) {
        console.log(chalk.gray(`\n${state.choice.name} is already the active screensaver.\n`));
        return;
      }
      await setActiveScreensaver(ip, state.choice.dreamComponent);
      console.log(chalk.green(`\nDone. Active screensaver is now ${state.choice.name}.\n`));
    },
  });
}
