import chalk from 'chalk';
import { startSpinner } from '../spinner.js';
import { checkbox } from '../prompts.js';
import { explainStep } from '../ui.js';
import { runWizard } from '../wizard.js';
import { enforceGuardrail } from '../guardrail.js';
import { listPackages } from '../adb.js';
import { isAlexaFixEnabled } from '../apply/alexa-fix.js';
import { getActiveScreensaver } from '../apply/set-screensaver.js';
import { hasLocalClones } from '../apply/screensavers.js';
import { revertAlexaFix, revertActiveScreensaver, removeScreensaver, removeLocalClones } from '../apply/uninstall.js';
import { SCREENSAVERS, AMAZON_DEFAULT } from '../screensaver-registry.js';
import { markFailed } from '../exit-status.js';
import { setTimeoutMs } from '../apply/timeouts.js';
import { probeTimeouts, msToLabel } from './timeouts-shared.js';

export const FLAG_SPEC = {
  all: { type: 'boolean', desc: 'Revert everything that is currently applied.' },
  yes: { type: 'boolean', desc: 'Skip prompts (reverts nothing unless --all is also given).' },
  force: { type: 'boolean', desc: 'Skip the typed confirmation for the revert.' },
};

/**
 * Pure: revert options for every timeout whose current value differs from the
 * value first observed on this TV (so there is something to put back).
 * @param {Array<{def: {id: string, label: string}, possible: boolean, currentMs?: number, baselineMs?: number | null}>} probed
 * @returns {Array<{name: string, value: string}>}
 */
export function buildTimeoutRevertOptions(probed) {
  return probed
    .filter((r) => r.possible && r.baselineMs !== null && r.baselineMs !== undefined && r.currentMs !== r.baselineMs)
    .map((r) => ({
      name: `Reset ${r.def.label} to its first-observed value (${msToLabel(r.baselineMs)}, currently ${msToLabel(r.currentMs)})`,
      value: `timeout:${r.def.id}`,
    }));
}

/**
 * @param {string} ip
 * @returns {Promise<{options: Array<{name: string, value: string}>, installedScreensavers: import('../apply/screensavers.js').ScreensaverEntry[], probedTimeouts: Array<object>}>}
 */
async function findOptions(ip) {
  const alexaFixOn = await isAlexaFixEnabled(ip);
  const activeScreensaver = await getActiveScreensaver(ip);
  const installedPkgs = await listPackages(ip);
  const installedScreensavers = SCREENSAVERS.filter((s) => installedPkgs.includes(s.pkg));
  const localClones = hasLocalClones();
  const probedTimeouts = await probeTimeouts(ip);

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
  options.push(...buildTimeoutRevertOptions(probedTimeouts));
  if (localClones) {
    options.push({ name: 'Delete locally cloned screensaver source (./screensavers)', value: 'local' });
  }

  return { options, installedScreensavers, probedTimeouts };
}

/**
 * @param {string} ip
 * @param {string[]} selected
 * @param {import('../apply/screensavers.js').ScreensaverEntry[]} installedScreensavers
 * @param {Array<{def: object, baselineMs?: number | null}>} probedTimeouts
 * @returns {Promise<boolean>} whether every selected revert actually took effect
 */
async function applySelection(ip, selected, installedScreensavers, probedTimeouts) {
  let ok = true;
  const fail = (message) => {
    console.log(chalk.red(message));
    markFailed();
    ok = false;
  };

  if (selected.includes('alexa')) {
    if (await revertAlexaFix(ip)) console.log(chalk.green('Alexa deep-sleep fix reverted.'));
    else fail('The Alexa deep-sleep fix is still on after the revert.');
  }

  if (selected.includes('active')) {
    if (await revertActiveScreensaver(ip)) console.log(chalk.green('Active screensaver reset to Amazon default.'));
    else fail('The active screensaver did not switch back to the Amazon default.');
  }

  for (const s of installedScreensavers) {
    if (!selected.includes(`pkg:${s.id}`)) continue;
    const spinner = startSpinner(`Removing ${s.name}`);
    if (await removeScreensaver(ip, s)) {
      spinner.succeed(`${s.name} removed.`);
    } else {
      spinner.fail(`${s.name} could not be removed. It may still be installed.`);
      markFailed();
      ok = false;
    }
  }

  for (const r of probedTimeouts) {
    if (!selected.includes(`timeout:${r.def.id}`)) continue;
    const { applied, readBackMs } = await setTimeoutMs(ip, r.def, r.baselineMs);
    console.log(
      applied
        ? chalk.green(`${r.def.label} reset to ${msToLabel(r.baselineMs)}.`)
        : chalk.red(`${r.def.label} did not accept the reset. Read back: ${msToLabel(readBackMs)}.`)
    );
    if (!applied) {
      markFailed();
      ok = false;
    }
  }

  if (selected.includes('local')) {
    removeLocalClones();
    console.log(chalk.green('Local screensaver source removed.'));
  }

  console.log(ok ? chalk.green('\nDone.\n') : chalk.yellow('\nFinished with errors. The TV was not fully reverted.\n'));
  return ok;
}

/**
 * @param {string} ip
 * @param {{all?: boolean, yes?: boolean, force?: boolean}} [flags]
 * @returns {Promise<'nothing' | 'reverted' | 'cancelled' | 'failed'>} what happened, so a caller
 * that is about to remove the saved IP and baselines knows whether the TV was actually reverted
 */
export async function uninstallEverything(ip, flags = {}) {
  const { options, installedScreensavers, probedTimeouts } = await findOptions(ip);

  if (options.length === 0) {
    const unreadable = probedTimeouts.filter((r) => !r.possible);
    if (unreadable.length > 0) {
      console.log(chalk.red(`\nCould not check ${unreadable.map((r) => r.def.label).join(', ')} (${unreadable[0].reason}), so this cannot confirm the TV is at factory defaults.\n`));
      markFailed();
      return 'failed';
    }
    console.log(chalk.green('\nNothing to undo. The device is already at factory defaults.\n'));
    return 'nothing';
  }

  if (flags.yes && !flags.all) {
    console.log(chalk.red('\n--yes without --all reverts nothing. Pass --all to revert everything, or run this interactively to pick what to keep.\n'));
    markFailed();
    return 'failed';
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
    if (!allowed) return 'cancelled';
    return (await applySelection(ip, selected, installedScreensavers, probedTimeouts)) ? 'reverted' : 'failed';
  }

  explainStep({
    title: 'Revert the TV: put back what this tool changed',
    body: [
      'Everything below is unchecked or checked based on what is actually',
      'applied right now. Uncheck anything you want to keep.',
    ],
  });

  let outcome = 'cancelled';
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
        outcome = 'nothing';
        return;
      }

      const removesApps = state.selected.some((v) => v.startsWith('pkg:'));
      const allowed = await enforceGuardrail({
        risky: true,
        warning: removesApps ? 'This reverts changes and removes screensavers from the TV.' : 'This reverts changes on the TV.',
        saferCommand: null,
        force: Boolean(flags.force),
        interactive: true,
      });
      if (!allowed) return;

      outcome = (await applySelection(ip, state.selected, installedScreensavers, probedTimeouts)) ? 'reverted' : 'failed';
    },
  });
  return outcome;
}
