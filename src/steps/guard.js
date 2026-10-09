import chalk from 'chalk';
import { explainStep, promptYN } from '../ui.js';
import { runWizard } from '../wizard.js';
import { turnGuardOn, checkGuard, turnGuardOff } from '../apply/guard.js';
import { guardState } from '../guard-config.js';
import { markFailed } from '../exit-status.js';
import { print } from '../output.js';

export const FLAG_SPEC = {
  check: { type: 'boolean', desc: 'Put back anything Amazon changed, and report it.' },
  off: { type: 'boolean', desc: 'Turn the guard off and undo what it did.' },
  yes: { type: 'boolean', desc: 'Skip the confirmation.' },
};

function report(results) {
  for (const r of results) {
    if (r.ok) {
      print(chalk.green(`  ✔ ${r.label}`));
    } else {
      const detail = r.detail ? ': ' + r.detail : '';
      print(chalk.red(`  ✖ ${r.label}${detail}`));
    }
  }
  const ok = results.every((r) => r.ok);
  if (!ok) {
    markFailed();
  }
  return ok;
}

async function on(ip) {
  if (report(await turnGuardOn(ip))) {
    print(chalk.green('\nThe guard is on. Change settings with this toolkit or the Screensavers tile so the guard keeps your change.\n'));
    print(chalk.gray('Fire OS does not let adb disable its main updater, so a Fire OS update can still arrive. Run guard --check after one.\n'));
  }
}

async function check(ip) {
  if (!guardState().on) {
    print(chalk.yellow('\nThe guard is off. Run guard to turn it on.\n'));
    return;
  }
  const { results, restored } = await checkGuard(ip);
  report(results);
  if (restored === null) {
    print(chalk.red('\nHome Redirect did not answer, so the settings could not be checked. Run guard to install it again.\n'));
    markFailed();
  } else if (restored.length === 0 && results.length === 0) {
    print(chalk.green('\nNothing changed. Everything is as the guard left it.\n'));
  } else {
    for (const setting of restored) {
      print(chalk.green(`  ✔ Put back ${setting}`));
    }
    print('');
  }
}

async function off(ip) {
  if (report(await turnGuardOff(ip))) {
    print(chalk.green('\nThe guard is off. Amazon can change these settings and update again.\n'));
  }
}

/**
 * Keeps Amazon from undoing this toolkit's changes, checks the guard, or turns
 * it off again.
 * @param {string} ip
 * @param {{check?: boolean, off?: boolean, yes?: boolean}} [flags]
 * @returns {Promise<void>}
 */
export async function manageGuard(ip, flags = {}) {
  if (flags.check) {
    await check(ip);
    return;
  }
  const action = flags.off ? off : on;
  if (flags.yes) {
    await action(ip);
    return;
  }

  explainStep({
    title: flags.off ? 'Step: Turn the guard off' : 'Step: Guard against Amazon undoing your setup',
    body: flags.off
      ? ['Stops putting settings back, and turns Amazon\'s updaters back on', 'if the guard turned them off.']
      : [
          'Home Redirect saves the screensaver, Alexa fix, Home and timeout',
          'settings as they are now, and puts them back whenever Amazon',
          'changes them: straight away, after a reboot, after an app update,',
          'and every 15 minutes. Amazon\'s updaters are held back as far as',
          'Fire OS allows.',
        ],
    settingChanged: flags.off ? 'only what the guard changed' : 'Home Redirect, Amazon updater packages',
    reversible: true,
    standaloneCommand: 'firetv-guard',
  });

  await runWizard({
    steps: [],
    buildSummary: () =>
      flags.off
        ? [{ label: 'Turn the guard off', detail: 'settings stop being put back' }]
        : [
            { label: 'Lock the screensaver, Alexa fix, Home and timeout settings', detail: 'Home Redirect puts them back' },
            { label: 'Hold back Amazon updates', detail: 'disable easyupgrade and forcedotaupdater, stop the main updater running in the background' },
          ],
    onConfirm: () => action(ip),
  });
}

/**
 * The optional step offered by start and update.
 * @param {string} ip
 * @returns {Promise<void>}
 */
export async function guardIfWanted(ip) {
  if (guardState().on) {
    return;
  }
  if (await promptYN('Would you like to guard these settings so Amazon cannot undo them?')) {
    await manageGuard(ip);
  }
}
