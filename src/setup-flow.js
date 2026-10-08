import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { startSpinner } from './spinner.js';
import { checkbox } from './prompts.js';
import { renderBanner } from './banner.js';
import { explainStep, promptYN } from './ui.js';
import { runWizard } from './wizard.js';
import { runStartCommand } from './steps/main-menu.js';
import { printCommandList } from './command-list.js';
import { isInstalled } from './device-config.js';
import { markFailed } from './exit-status.js';
import { print } from './output.js';

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

async function runInstallAndLink() {
  const installSpinner = startSpinner('Installing dependencies (npm install)...');
  try {
    await execFileAsync('npm', ['install'], { cwd: PROJECT_ROOT });
    installSpinner.succeed('Dependencies installed.');
  } catch (err) {
    installSpinner.fail('npm install failed.');
    print(chalk.red(err.stderr || err.message));
    markFailed();
    return false;
  }

  const linkSpinner = startSpinner('Linking commands onto your PATH (npm link)...');
  try {
    await execFileAsync('npm', ['link'], { cwd: PROJECT_ROOT });
    linkSpinner.succeed('Commands linked.');
    return true;
  } catch (err) {
    linkSpinner.fail('npm link failed.');
    print(chalk.red(err.stderr || err.message));
    markFailed();
    return false;
  }
}

function printFinishMessage({ willRun, linked }) {
  if (!linked) {
    if (willRun) {
      print(chalk.gray('\nStarting the guided setup now.\n'));
    }
    return;
  }

  if (!isInstalled()) {
    // Linking the commands does not connect to a TV, so nothing but start
    // works yet. Say so instead of listing commands that would refuse to run.
    print(chalk.green('\nCommands linked.'));
    print(
      willRun
        ? chalk.gray('Starting the guided setup now. Once it finishes, run ') + chalk.green('info') + chalk.gray(' any time to see every command.\n')
        : chalk.gray('Next, run ') + chalk.green('start') + chalk.gray(' to connect to your TV and finish setup. Until then, ') + chalk.green('info') + chalk.gray(' shows only ') + chalk.green('start') + chalk.gray('.\n')
    );
    return;
  }

  print(
    chalk.bold.white('\nTip: run ') +
      chalk.green('info') +
      chalk.bold.white(' any time to see this list again, or ') +
      chalk.green('start') +
      chalk.bold.white(' to reopen the guided menu.\n')
  );
  printCommandList();
}

/**
 * The guided setup: install/link the commands and/or launch the app. Lives
 * here (not in the root setup.js) because it needs the project's
 * dependencies, which setup.js installs first on a fresh clone.
 * @returns {Promise<void>}
 */
export async function runSetup() {
  renderBanner();

  explainStep({
    title: 'Set up Fire TV Toolkit',
    body: [
      'This can install this tool\'s dependencies and link its commands onto',
      'your PATH (firetv, firetv-timeouts, enable-alexa-fix, and the rest),',
      'and/or launch the guided app right after. Nothing runs until you',
      'confirm on the summary screen.',
    ],
  });

  const wantsSetup = await promptYN('Start setting up Fire TV Toolkit?');
  if (!wantsSetup) {
    print(chalk.gray('\nNo changes were made.\n'));
    return;
  }

  await runWizard({
    steps: [
      {
        key: 'selected',
        prompt: () =>
          checkbox({
            message: 'What would you like to do?',
            choices: [
              { name: 'Install/Link firetv commands', value: 'install', checked: true },
              { name: 'Run FireTV App now', value: 'run', checked: true },
            ],
          }),
      },
    ],
    buildSummary: (state) =>
      [
        state.selected.includes('install') ? { label: 'Run npm install and npm link' } : null,
        state.selected.includes('run') ? { label: 'Launch the guided FireTV app' } : null,
      ].filter(Boolean),
    onConfirm: async (state) => {
      if (state.selected.length === 0) {
        print(chalk.gray('\nNothing selected. No changes were made.\n'));
        return;
      }

      let installOk = true;
      if (state.selected.includes('install')) {
        installOk = await runInstallAndLink();
      }

      printFinishMessage({ willRun: state.selected.includes('run'), linked: state.selected.includes('install') && installOk });

      if (state.selected.includes('run')) {
        if (!installOk) {
          print(chalk.yellow('Continuing to launch the app even though install/link had a problem above.\n'));
        }
        await runStartCommand();
      }
    },
  });
}
