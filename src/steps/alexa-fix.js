import chalk from 'chalk';
import { explainStep, promptYN } from '../ui.js';
import { enforceGuardrail } from '../guardrail.js';
import { isAlexaFixEnabled, setAlexaFix } from '../apply/alexa-fix.js';
import { markFailed } from '../exit-status.js';
import { print } from '../output.js';

export const ENABLE_FLAG_SPEC = {
  yes: { type: 'boolean', desc: 'Apply the fix without asking first.' },
};

export const DISABLE_FLAG_SPEC = {
  yes: { type: 'boolean', desc: 'Skip the confirmation prompt (also needs --force, since this brings the bug back).' },
  force: { type: 'boolean', desc: 'Allow re-introducing the deep-sleep bug without the typed confirmation.' },
};

const EXPLANATION = [
  'Fire TV Edition suspends to RAM after long enough idle, which drops it',
  "off Wi-Fi. That's why Alexa reports the TV as offline until someone",
  'walks over and presses the remote.',
  '',
  'Settings shows a toggle for this called "Voice Commands When TV Screen',
  'is Off" and it looks like turning it on should fix this. It does not:',
  'the toggle does not write the setting that actually controls the',
  'suspend behavior. This is a real bug in Fire OS, not a misconfiguration',
  'on your end.',
];

/**
 * Not risky: applying the recommended fix. flags.yes skips the prompt.
 * @param {string} ip
 * @param {{yes?: boolean}} [flags]
 * @returns {Promise<void>}
 */
export async function enableAlexaFix(ip, flags = {}) {
  if (await isAlexaFixEnabled(ip)) {
    print(chalk.green('\nThe fix is already applied. Nothing to do.\n'));
    return;
  }

  explainStep({
    title: 'Fix: keep Alexa able to reach the TV while asleep',
    body: EXPLANATION,
    settingChanged: 'secure str.auto_wake_up_enabled (currently 0, will become 1)',
    reversible: true,
    standaloneCommand: 'disable-alexa-fix',
  });

  const proceed = flags.yes || (await promptYN('Apply the fix?'));
  if (!proceed) {
    print(chalk.gray('\nCancelled. Nothing was changed.\n'));
    return;
  }

  const confirmed = await setAlexaFix(ip, true);
  print(
    confirmed
      ? chalk.green('\nDone. Alexa should stay able to reach the TV when it is asleep.\n')
      : chalk.red('\nThe write did not take. Check the adb connection and try again.\n')
  );
  if (!confirmed) {
    markFailed();
  }
}

async function confirmRevert() {
  const proceed = await promptYN('Revert now?');
  if (proceed) {
    return true;
  }
  print(chalk.gray('\nCancelled. Nothing was changed.\n'));
  return false;
}

function printRevertResult(confirmed) {
  print(
    !confirmed
      ? chalk.green('\nDone. Factory deep-sleep behavior is restored.\n')
      : chalk.red('\nThe write did not take. Check the adb connection and try again.\n')
  );
  if (confirmed) {
    markFailed();
  }
}

/**
 * Risky: reintroduces the deep-sleep bug on purpose. Gated by the guardrail
 * so this can't happen by a stray --yes in a script without --force too.
 * @param {string} ip
 * @param {{yes?: boolean, force?: boolean}} [flags]
 * @returns {Promise<void>}
 */
export async function disableAlexaFix(ip, flags = {}) {
  const interactive = !flags.yes;

  if (!(await isAlexaFixEnabled(ip))) {
    print(chalk.green('\nThe fix is not currently applied. Nothing to do.\n'));
    return;
  }

  explainStep({
    title: 'Revert: restore factory deep-sleep behavior',
    body: [
      'This puts the TV back exactly how it shipped: it will suspend to RAM',
      'after being idle, and Alexa may report it offline until someone',
      'presses the remote, same as before the fix was applied.',
    ],
    settingChanged: 'secure str.auto_wake_up_enabled (currently 1, will become 0)',
    reversible: true,
    standaloneCommand: 'enable-alexa-fix',
  });

  if (interactive && !(await confirmRevert())) {
    return;
  }

  const allowed = await enforceGuardrail({
    risky: true,
    warning: 'This brings back the Alexa deep-sleep bug you fixed earlier.',
    saferCommand: 'enable-alexa-fix',
    force: Boolean(flags.force),
    interactive,
  });
  if (!allowed) {
    return;
  }

  const confirmed = await setAlexaFix(ip, false);
  printRevertResult(confirmed);
}

/**
 * @param {string} ip
 * @returns {Promise<void>}
 */
export async function alexaFixMenu(ip) {
  const enabled = await isAlexaFixEnabled(ip);
  print(chalk.gray(`\nCurrent state: fix is ${enabled ? 'ON' : 'OFF'}.\n`));
  if (enabled) {
    await disableAlexaFix(ip);
  } else {
    await enableAlexaFix(ip);
  }
}
