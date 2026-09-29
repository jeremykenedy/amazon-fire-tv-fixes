import chalk from 'chalk';
import { confirmSummary } from './ui.js';

export const BACK = '__wizard_back__';

/**
 * Prepends a '< Back' choice unless this is the first step. Steps build
 * their own @inquirer choices array and pass it through this before
 * calling select/checkbox, so Back is always the first option, never last.
 * @template T
 * @param {Array<{name: string, value: T}>} choices
 * @param {boolean} showBack
 * @returns {Array<{name: string, value: T | typeof BACK}>}
 */
export function withBack(choices, showBack) {
  return showBack ? [{ name: '< Back', value: BACK }, ...choices] : choices;
}

/**
 * Runs an ordered sequence of steps, each of which can return BACK to walk
 * to the previous step. After the last step, shows a Confirm and continue /
 * Start over / Cancel and exit screen built from buildSummary(state).
 * Nothing in onConfirm runs unless Confirm and continue is chosen.
 *
 * @param {Object} options
 * @param {Array<{key: string, prompt: (state: object, ctx: {showBack: boolean}) => Promise<any>}>} options.steps
 * @param {(state: object) => Array<{label: string, detail?: string}>} options.buildSummary
 * @param {(state: object) => Promise<void>} options.onConfirm
 * @param {(actions: Array<{label: string, detail?: string}>) => Promise<'continue' | 'restart' | 'cancel'>} [options.confirmFn]
 * @returns {Promise<object | null>} the final state on confirm, or null if cancelled
 */
export async function runWizard({ steps, buildSummary, onConfirm, confirmFn = confirmSummary }) {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let state = {};
    let stepIndex = 0;

    while (stepIndex < steps.length) {
      const step = steps[stepIndex];
      const result = await step.prompt(state, { showBack: stepIndex > 0 });

      if (result === BACK) {
        stepIndex -= 1;
        continue;
      }

      state = { ...state, [step.key]: result };
      stepIndex += 1;
    }

    // Nothing to confirm means nothing will change: skip the empty
    // "this is exactly what will happen" box and let onConfirm report it.
    const summary = buildSummary(state);
    if (summary.length === 0) {
      await onConfirm(state);
      return state;
    }

    const decision = await confirmFn(summary);

    if (decision === 'continue') {
      await onConfirm(state);
      return state;
    }

    if (decision === 'cancel') {
      console.log(chalk.gray('\nCancelled. Nothing was changed.\n'));
      return null;
    }

    // 'restart' falls through and the outer loop begins again at step 0.
  }
}
