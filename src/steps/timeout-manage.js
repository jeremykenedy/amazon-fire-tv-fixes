import chalk from 'chalk';
import { input, checkbox } from '../prompts.js';
import { explainStep, promptYN } from '../ui.js';
import { runWizard } from '../wizard.js';
import { findTimeoutById, setTimeoutMs } from '../apply/timeouts.js';
import { probeTimeouts, mustBeValidMinutes, msToLabel } from './timeouts-shared.js';
import { markFailed } from '../exit-status.js';
import { print } from '../output.js';

/**
 * Pure: builds the checkbox choices for the combined timeouts wizard, given
 * probeTimeouts()'s results already filtered to the ones that are possible.
 * @param {Array<{def: object, currentMs: number, baselineMs: number | null}>} possible
 * @returns {Array<{name: string, value: string}>}
 */
export function buildManageOptions(possible) {
  const options = [{ name: 'Skip: no timeout changes', value: 'skip' }];
  for (const r of possible) {
    options.push({ name: `Edit: ${r.def.label} (currently ${msToLabel(r.currentMs)})`, value: `edit:${r.def.id}` });
    if (r.baselineMs !== null && r.baselineMs !== undefined) {
      options.push({
        name: `Reset: ${r.def.label} to observed baseline (${msToLabel(r.baselineMs)})`,
        value: `reset:${r.def.id}`,
      });
    }
  }
  if (possible.some((r) => r.baselineMs !== null && r.baselineMs !== undefined)) {
    options.push({ name: 'Reset ALL to observed baseline values', value: 'reset-all' });
  }
  return options;
}

/**
 * Pure: builds the confirm-screen summary lines for the combined wizard. It
 * is derived from resolveManageSelection, so it lists exactly what will be
 * applied: an edit replaces a reset of the same timeout, and "reset all" is
 * expanded into the individual timeouts it will reset.
 * @param {{selected: string[], values?: Record<string, number>}} state
 * @param {Array<{def: object, baselineMs: number | null}>} possible
 * @returns {Array<{label: string}>}
 */
export function buildManageSummary(state, possible) {
  const { editIds, resetIds } = resolveManageSelection(state.selected, possible);
  const lines = [];
  for (const id of editIds) {
    const r = possible.find((p) => p.def.id === id);
    if (r) {
      lines.push({ label: `Set ${r.def.label} to ${msToLabel(state.values?.[id])}` });
    }
  }
  for (const id of resetIds) {
    const r = possible.find((p) => p.def.id === id);
    if (r) {
      lines.push({ label: `Reset ${r.def.label} to observed baseline (${msToLabel(r.baselineMs)})` });
    }
  }
  return lines;
}

async function promptEditValues(state) {
  const editIds = state.selected.filter((v) => v.startsWith('edit:')).map((v) => v.slice('edit:'.length));
  const values = {};
  for (const id of editIds) {
    const def = findTimeoutById(id);
    const minutes = await input({
      message: `New value for ${def.label}, in minutes:`,
      validate: (value) => mustBeValidMinutes(value) ?? true,
    });
    values[id] = Number(minutes) * 60000;
  }
  return values;
}

/**
 * Pure: splits a checkbox selection into which ids get edited vs reset. An
 * explicit edit for a given id always wins over a reset of that same id
 * (whether the reset came from its own checkbox entry or from "reset-all"),
 * so resetIds never overlaps editIds.
 * @param {string[]} selected
 * @param {Array<{def: object, baselineMs: number | null}>} possible
 * @returns {{editIds: string[], resetIds: string[]}}
 */
export function resolveManageSelection(selected, possible) {
  const editIds = selected.filter((v) => v.startsWith('edit:')).map((v) => v.slice('edit:'.length));
  const rawResetIds = selected.includes('reset-all')
    ? possible.filter((r) => r.baselineMs !== null && r.baselineMs !== undefined).map((r) => r.def.id)
    : selected.filter((v) => v.startsWith('reset:')).map((v) => v.slice('reset:'.length));
  return { editIds, resetIds: rawResetIds.filter((id) => !editIds.includes(id)) };
}

async function applyManageSelection(ip, state, possible) {
  if (state.selected.length === 0) {
    print(chalk.gray('\nNo timeout changes. Moving on.\n'));
    return;
  }

  const { editIds, resetIds } = resolveManageSelection(state.selected, possible);

  for (const id of resetIds) {
    const r = possible.find((p) => p.def.id === id);
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

  for (const id of editIds) {
    const r = possible.find((p) => p.def.id === id);
    const ms = state.values[id];
    const { applied, readBackMs } = await setTimeoutMs(ip, r.def, ms);
    print(
      applied
        ? chalk.green(`${r.def.label} set to ${msToLabel(ms)}.`)
        : chalk.red(`${r.def.label} did not accept that value. Read back: ${msToLabel(readBackMs)}.`)
    );
    if (!applied) {
      markFailed();
    }
  }

  print(chalk.green('\nDone.\n'));
}

/**
 * The combined command (`firetv-timeouts`): one checkbox picking any mix of
 * edits and resets across every timeout this TV actually supports, ending
 * in the standard summary/confirm screen.
 * @param {string} ip
 */
export async function manageAllTimeoutsStep(ip) {
  const probe = await probeTimeouts(ip);
  const possible = probe.filter((r) => r.possible);

  if (possible.length === 0) {
    print(chalk.red('\nNone of the known timeouts could be read from this TV. Run firetv-timeouts-possible for details.\n'));
    markFailed();
    return;
  }

  explainStep({
    title: 'Timeouts: review or change sleep and screensaver timing',
    body: [
      'Pick anything you want to edit or reset. Nothing changes until you confirm on the summary screen.',
      'To leave timeouts as they are, choose "Skip" (or select nothing) and press enter.',
    ],
  });

  await runWizard({
    steps: [
      {
        key: 'selected',
        prompt: async () => {
          const picked = await checkbox({
            message: 'What would you like to do?',
            choices: buildManageOptions(possible),
          });
          return picked.includes('skip') ? [] : picked;
        },
      },
      {
        key: 'values',
        prompt: (state) => promptEditValues(state),
      },
    ],
    buildSummary: (state) => buildManageSummary(state, possible),
    onConfirm: (state) => applyManageSelection(ip, state, possible),
  });
}

/**
 * Used only by the main guided installer, as an opt-in offered once, run
 * last in the initial setup sequence before the interactive menu takes
 * over.
 * @param {string} ip
 */
export async function reviewTimeoutsIfWanted(ip) {
  const wants = await promptYN('Would you like to review or adjust TV timeout settings (sleep, screensaver)?');
  if (!wants) {
    return;
  }
  await manageAllTimeoutsStep(ip);
}
