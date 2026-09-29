import chalk from 'chalk';
import { checkbox } from '../prompts.js';
import { explainStep } from '../ui.js';
import { runWizard } from '../wizard.js';
import { setTimeoutMs } from '../apply/timeouts.js';
import { probeTimeouts, mustBeKnownTimeoutIds, msToLabel } from './timeouts-shared.js';
import { markFailed } from '../exit-status.js';
import { print } from '../output.js';

export const RESET_FLAG_SPEC = {
  all: { type: 'boolean', desc: 'Reset every timeout to its first-observed value.' },
  only: { type: 'string', validate: mustBeKnownTimeoutIds, desc: 'Comma-separated timeouts to reset (sleep, screensaver).' },
  yes: { type: 'boolean', desc: 'For scripts; --all or --only is still required.' },
};

/**
 * Pure: resolves which timeout ids --all/--only refers to. Mutual
 * exclusivity between the two is checked by the caller before this runs.
 * @param {{all?: boolean, only?: string}} flags
 * @param {string[]} allIds
 * @returns {string[]}
 */
export function resolveResetIds(flags, allIds) {
  if (flags.all) {
    return allIds;
  }
  if (flags.only !== undefined) {
    return flags.only.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * @param {{all?: boolean, only?: string, yes?: boolean}} flags
 * @returns {string | null} what is wrong with this flag combination, if anything
 */
function flagProblem(flags) {
  if (flags.all && flags.only !== undefined) {
    return 'Pass only one of --all or --only, not both.';
  }
  if (flags.yes && !flags.all && flags.only === undefined) {
    return '--yes alone does not pick what to reset. Pass --all or --only=<id,...>.';
  }
  return null;
}

/**
 * Resets one timeout to its baseline and prints the outcome.
 * @param {string} ip
 * @param {{def: {label: string}, baselineMs: number}} r
 */
async function resetOne(ip, r) {
  const { applied, readBackMs } = await setTimeoutMs(ip, r.def, r.baselineMs);
  print(
    applied
      ? chalk.green(`${r.def.label} reset to ${msToLabel(r.baselineMs)}.`)
      : chalk.red(`${r.def.label} did not accept the reset. Read back: ${msToLabel(readBackMs)}.`)
  );
  if (!applied) {
    markFailed();
  }
}

/**
 * Flag-driven reset (--all or --only), no prompts.
 */
async function resetFromFlags(ip, flags, resettable) {
  const ids = resolveResetIds(flags, resettable.map((r) => r.def.id));
  for (const id of ids) {
    const r = resettable.find((x) => x.def.id === id);
    if (r) {
      await resetOne(ip, r);
    } else {
      print(chalk.red(`\n${id} has no captured baseline (or isn't a known timeout). Skipped.\n`));
      markFailed();
    }
  }
  print(chalk.green('\nDone.\n'));
}

/**
 * `firetv-timeouts-reset`.
 * @param {string} ip
 * @param {{all?: boolean, only?: string, yes?: boolean}} [flags]
 */
export async function resetTimeoutsStep(ip, flags = {}) {
  const probe = await probeTimeouts(ip);
  const resettable = probe.filter((r) => r.possible && r.baselineMs !== null && r.baselineMs !== undefined);

  if (resettable.length === 0) {
    print(chalk.red('\nNo timeouts have a captured baseline to reset to yet. Run firetv-timeouts-current first.\n'));
    markFailed();
    return;
  }

  const problem = flagProblem(flags);
  if (problem) {
    print(chalk.red(`\n${problem}\n`));
    markFailed();
    return;
  }

  if (flags.all || flags.only !== undefined) {
    await resetFromFlags(ip, flags, resettable);
    return;
  }

  explainStep({
    title: 'Reset timeouts to their observed baseline values',
    body: ['Everything below defaults to checked. Uncheck anything you want to leave alone.'],
  });

  await runWizard({
    steps: [
      {
        key: 'selected',
        prompt: () =>
          checkbox({
            message: 'Reset which timeouts?',
            choices: resettable.map((r) => ({ name: `${r.def.label} → ${msToLabel(r.baselineMs)}`, value: r.def.id, checked: true })),
          }),
      },
    ],
    buildSummary: (state) =>
      resettable.filter((r) => state.selected.includes(r.def.id)).map((r) => ({ label: `Reset ${r.def.label} to ${msToLabel(r.baselineMs)}` })),
    onConfirm: async (state) => {
      if (state.selected.length === 0) {
        print(chalk.gray('\nNothing selected. No changes were made.\n'));
        return;
      }
      for (const id of state.selected) {
        await resetOne(ip, resettable.find((x) => x.def.id === id));
      }
      print(chalk.green('\nDone.\n'));
    },
  });
}
