import chalk from 'chalk';
import { checkbox } from '../prompts.js';
import { explainStep, promptYN } from '../ui.js';
import { runWizard } from '../wizard.js';
import { readOptimizeState, planOptimizations, applyOptimizations, displayValue } from '../apply/optimize.js';
import { probeTimeouts } from './timeouts-shared.js';
import { markFailed } from '../exit-status.js';
import { print } from '../output.js';

export const FLAG_SPEC = {
  yes: { type: 'boolean', desc: 'Make every change without asking.' },
};

function describe(change) {
  return `${displayValue(change.id, change.from)} -> ${displayValue(change.id, change.to)}`;
}

async function apply(ip, changes) {
  const results = await applyOptimizations(ip, changes);
  for (const { change, ok, readBack } of results) {
    if (ok) {
      print(chalk.green(`  ✔ ${change.label}`));
    } else {
      print(chalk.red(`  ✖ ${change.label}: the TV still reads ${displayValue(change.id, readBack)}`));
    }
  }
  if (results.some((r) => !r.ok)) {
    print(chalk.red('\nThe TV did not take every change. The ones marked above were left as they were.\n'));
    markFailed();
    return;
  }
  if (changes.some((c) => c.id === 'ambient-off')) {
    print(chalk.yellow('\nRestart the TV once so the Ambient Experience change takes effect.'));
  }
  print(chalk.green('\nDone. The TV is set up for screensavers. firetv-revert can put these back.\n'));
}

/**
 * Reads the TV, works out which screensaver settings it has that are not set
 * the way screensavers need, and changes only those. The values from before
 * are kept in .env so firetv-revert can put them back.
 * @param {string} ip
 * @param {{yes?: boolean}} [flags]
 * @returns {Promise<void>}
 */
export async function optimizeForScreensavers(ip, flags = {}) {
  // Records the timeout baselines before anything here can change a timeout.
  await probeTimeouts(ip);
  const changes = planOptimizations(await readOptimizeState(ip));

  if (changes.length === 0) {
    print(chalk.gray('\nThis TV is already set up for screensavers. Nothing to change.\n'));
    return;
  }

  if (flags.yes) {
    await apply(ip, changes);
    return;
  }

  explainStep({
    title: 'Step: Optimize the TV for screensavers',
    body: [
      'Checked against the settings this TV actually has. Only the ones',
      'that would stop a screensaver from showing, or make it worse, are',
      'listed. Uncheck anything you want left alone.',
    ],
    settingChanged: 'only the settings listed below',
    reversible: true,
    standaloneCommand: 'firetv-optimize',
  });

  await runWizard({
    steps: [
      {
        key: 'ids',
        prompt: () =>
          checkbox({
            message: 'Which changes should be made?',
            pageSize: changes.length,
            choices: changes.map((c) => ({ name: `${c.label} (${describe(c)})`, value: c.id, checked: true })),
          }),
      },
    ],
    buildSummary: (state) => changes.filter((c) => state.ids.includes(c.id)).map((c) => ({ label: c.label, detail: describe(c) })),
    onConfirm: async (state) => {
      const chosen = changes.filter((c) => state.ids.includes(c.id));
      if (chosen.length === 0) {
        print(chalk.gray('\nNothing selected. No changes were made.\n'));
        return;
      }
      await apply(ip, chosen);
    },
  });
}

/**
 * The optional step offered by start and update.
 * @param {string} ip
 * @returns {Promise<void>}
 */
export async function optimizeIfWanted(ip) {
  if (await promptYN('Would you like to optimize the TV for screensavers (only settings it has)?')) {
    await optimizeForScreensavers(ip);
  }
}
