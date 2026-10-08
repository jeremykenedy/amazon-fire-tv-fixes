import chalk from 'chalk';
import { startSpinner } from '../spinner.js';
import { checkbox } from '../prompts.js';
import { explainStep } from '../ui.js';
import { runWizard } from '../wizard.js';
import { enforceGuardrail } from '../guardrail.js';
import { listPackages } from '../adb.js';
import { installScreensaver, uninstallScreensaver } from '../apply/screensavers.js';
import { SCREENSAVERS } from '../screensaver-registry.js';
import { markFailed } from '../exit-status.js';
import { print } from '../output.js';

const VALID_IDS = SCREENSAVERS.map((s) => s.id);

/**
 * @param {string} value comma-separated screensaver ids
 * @returns {string | null} an error message, or null when every id is valid
 */
export function validateIdList(value) {
  const ids = value.split(',').map((s) => s.trim());
  const unknown = ids.filter((id) => !VALID_IDS.includes(id));
  if (unknown.length > 0) {
    return `Unknown screensaver id(s): ${unknown.join(', ')}. Valid ids: ${VALID_IDS.join(', ')}`;
  }
  return null;
}

export const FLAG_SPEC = {
  install: { type: 'string', validate: validateIdList, desc: `Comma-separated screensaver ids to install (${SCREENSAVERS.map((s) => s.id).join(', ')}).` },
  uninstall: { type: 'string', validate: validateIdList, desc: 'Comma-separated screensaver ids to remove (needs --force).' },
  yes: { type: 'boolean', desc: 'Skip prompts.' },
  force: { type: 'boolean', desc: 'Allow removing screensavers without the typed confirmation.' },
};

/**
 * @param {string | undefined} value comma-separated screensaver ids
 * @returns {string[]}
 */
export function parseIdList(value) {
  return value ? value.split(',').map((s) => s.trim()) : [];
}

/**
 * @param {string} ip
 * @param {import('../apply/screensavers.js').ScreensaverEntry[]} toInstall
 * @param {import('../apply/screensavers.js').ScreensaverEntry[]} toUninstall
 * @returns {Promise<void>}
 */
async function applyChanges(ip, toInstall, toUninstall) {
  for (const entry of toInstall) {
    const spinner = startSpinner(`${entry.name}: starting`);
    try {
      await installScreensaver(ip, entry, { onProgress: (msg) => (spinner.text = `${entry.name}: ${msg}`) });
      spinner.succeed(`${entry.name} installed.`);
    } catch (err) {
      spinner.fail(`${entry.name}: ${err.message}`);
      markFailed();
    }
  }

  for (const entry of toUninstall) {
    const spinner = startSpinner(`Removing ${entry.name}`);
    if (await uninstallScreensaver(ip, entry)) {
      spinner.succeed(`${entry.name} removed.`);
    } else {
      spinner.fail(`${entry.name} could not be removed. It may still be installed.`);
      markFailed();
    }
  }
}

/**
 * @param {string} ip
 * @param {{install?: string, uninstall?: string, yes?: boolean, force?: boolean}} [flags]
 * @returns {Promise<void>}
 */
export async function manageScreensavers(ip, flags = {}) {
  const installedPkgs = await listPackages(ip);
  const alreadyInstalledIds = new Set(SCREENSAVERS.filter((s) => installedPkgs.includes(s.pkg)).map((s) => s.id));

  const flagDriven = flags.install !== undefined || flags.uninstall !== undefined || flags.yes;

  if (flagDriven) {
    const toInstall = SCREENSAVERS.filter((s) => parseIdList(flags.install).includes(s.id));
    const toUninstall = SCREENSAVERS.filter((s) => parseIdList(flags.uninstall).includes(s.id));

    if (toInstall.length === 0 && toUninstall.length === 0) {
      print(chalk.gray('\nNothing to do.\n'));
      return;
    }

    const allowed = await enforceGuardrail({
      risky: toUninstall.length > 0,
      warning: `This removes ${toUninstall.map((s) => s.name).join(', ')} from the TV.`,
      saferCommand: 'firetv-screensavers --install=<id>',
      force: Boolean(flags.force),
      interactive: false,
    });
    if (!allowed) {
      return;
    }

    await applyChanges(ip, toInstall, toUninstall);
    return;
  }

  explainStep({
    title: 'Step: Install or remove screensavers',
    body: [
      'Every screensaver here was reviewed for ads, tracking, and',
      'unnecessary permissions before being added, and each download is',
      'checked against its published SHA-256. Checked items below are',
      'already on your TV.',
      '',
      'Check a box to install it. Uncheck one to remove it.',
    ],
  });

  await runWizard({
    steps: [
      {
        key: 'selectedIds',
        prompt: () =>
          checkbox({
            message: 'Which screensavers do you want installed?',
            choices: SCREENSAVERS.map((s) => ({
              name: `${s.name} (${s.blurb})`,
              value: s.id,
              checked: alreadyInstalledIds.has(s.id),
            })),
          }),
      },
    ],
    buildSummary: (state) => {
      const toInstall = SCREENSAVERS.filter((s) => state.selectedIds.includes(s.id) && !alreadyInstalledIds.has(s.id));
      const toUninstall = SCREENSAVERS.filter((s) => !state.selectedIds.includes(s.id) && alreadyInstalledIds.has(s.id));
      return [
        ...toInstall.map((s) => ({ label: `Install ${s.name}`, detail: s.repo })),
        ...toUninstall.map((s) => ({ label: `Remove ${s.name}`, detail: s.pkg })),
      ];
    },
    onConfirm: async (state) => {
      const toInstall = SCREENSAVERS.filter((s) => state.selectedIds.includes(s.id) && !alreadyInstalledIds.has(s.id));
      const toUninstall = SCREENSAVERS.filter((s) => !state.selectedIds.includes(s.id) && alreadyInstalledIds.has(s.id));

      if (toInstall.length === 0 && toUninstall.length === 0) {
        print(chalk.gray('\nNothing to do: everything you checked is already on the TV, and nothing was unchecked.\n'));
        return;
      }

      const allowed = await enforceGuardrail({
        risky: toUninstall.length > 0,
        warning: `This removes ${toUninstall.map((s) => s.name).join(', ')} from the TV.`,
        saferCommand: 'firetv-screensavers --install=<id>',
        force: Boolean(flags.force),
        interactive: true,
      });
      if (!allowed) {
        return;
      }

      await applyChanges(ip, toInstall, toUninstall);
    },
  });
}
