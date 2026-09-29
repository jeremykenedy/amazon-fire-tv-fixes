import chalk from 'chalk';
import { input } from '../prompts.js';
import { explainStep } from '../ui.js';
import { runWizard } from '../wizard.js';
import { setTimeoutMs } from '../apply/timeouts.js';
import { mustBeNonNegativeInteger, mustBeValidMinutes, msToLabel, probeTimeouts } from './timeouts-shared.js';
import { markFailed } from '../exit-status.js';

export const FLAG_SPEC = {
  ms: { type: 'string', validate: mustBeNonNegativeInteger, desc: 'New timeout in milliseconds.' },
  minutes: { type: 'string', validate: mustBeValidMinutes, desc: 'New timeout in minutes.' },
  yes: { type: 'boolean', desc: 'For scripts; a value (--ms or --minutes) is still required.' },
};

/**
 * Pure: resolves the requested ms value from --ms/--minutes flags. Both at
 * once is rejected; neither given resolves ms: undefined so the caller can
 * fall through to interactive prompting. Bound-checks independently of
 * FLAG_SPEC's own validators (this is the actual conversion point, so it's
 * where an overflow would happen if nothing upstream had already caught it).
 * @param {{ms?: string, minutes?: string}} flags
 * @returns {{ok: true, ms: number | undefined} | {ok: false, error: string}}
 */
export function resolveRequestedMs(flags) {
  const hasMs = flags.ms !== undefined;
  const hasMinutes = flags.minutes !== undefined;
  if (hasMs && hasMinutes) {
    return { ok: false, error: 'Pass only one of --ms or --minutes, not both.' };
  }
  if (hasMs) {
    const error = mustBeNonNegativeInteger(flags.ms);
    if (error) return { ok: false, error: `--ms ${error}.` };
    return { ok: true, ms: Number(flags.ms) };
  }
  if (hasMinutes) {
    const error = mustBeValidMinutes(flags.minutes);
    if (error) return { ok: false, error: `--minutes ${error}.` };
    return { ok: true, ms: Number(flags.minutes) * 60000 };
  }
  return { ok: true, ms: undefined };
}

/**
 * Used by the two individual timeout commands (`firetv-timeout-sleep`,
 * `firetv-timeout-screensaver`).
 * @param {string} ip
 * @param {object} def a TIMEOUTS entry
 * @param {{ms?: string, minutes?: string, yes?: boolean}} [flags]
 */
export async function setOneTimeoutStep(ip, def, flags = {}) {
  const resolved = resolveRequestedMs(flags);
  if (!resolved.ok) {
    console.log(chalk.red(`\n${resolved.error}\n`));
    markFailed();
    return;
  }

  // Capture the first-observed baselines before anything is written.
  await probeTimeouts(ip);

  if (resolved.ms !== undefined) {
    const { applied, readBackMs } = await setTimeoutMs(ip, def, resolved.ms);
    console.log(
      applied
        ? chalk.green(`\nDone. ${def.label} is now ${msToLabel(resolved.ms)}.\n`)
        : chalk.red(`\nThe TV did not accept that value. Read back: ${msToLabel(readBackMs)}.\n`)
    );
    if (!applied) markFailed();
    return;
  }

  if (flags.yes) {
    console.log(chalk.red('\n--yes alone does not set a value. Pass --ms=<n> or --minutes=<n>.\n'));
    markFailed();
    return;
  }

  explainStep({
    title: `Step: Change ${def.label}`,
    body: [
      `This changes ${def.namespace} ${def.key} on your TV directly.`,
      def.zeroMeans ? `A value of 0 means: ${def.zeroMeans}.` : '',
      def.effectiveMaxMs ? `The community-documented practical ceiling to functionally disable it is ${msToLabel(def.effectiveMaxMs)}.` : '',
    ].filter(Boolean),
    settingChanged: `${def.namespace} ${def.key}`,
    reversible: true,
  });

  await runWizard({
    steps: [
      {
        key: 'minutes',
        prompt: () =>
          input({
            message: `New value for ${def.label}, in minutes:`,
            validate: (value) => mustBeValidMinutes(value) ?? true,
          }),
      },
    ],
    buildSummary: (state) => [{ label: `Set ${def.label} to ${msToLabel(Number(state.minutes) * 60000)}` }],
    onConfirm: async (state) => {
      const ms = Number(state.minutes) * 60000;
      const { applied, readBackMs } = await setTimeoutMs(ip, def, ms);
      console.log(
        applied
          ? chalk.green(`\nDone. ${def.label} is now ${msToLabel(ms)}.\n`)
          : chalk.red(`\nThe TV did not accept that value. Read back: ${msToLabel(readBackMs)}.\n`)
      );
      if (!applied) markFailed();
    },
  });
}
