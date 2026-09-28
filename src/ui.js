import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import boxen from 'boxen';

export const BACK = '__back__';
export const EXIT = '__exit__';

export function banner() {
  const title = chalk.bold.cyan('amazon-fire-tv-fixes');
  const subtitle = chalk.gray('Alexa deep-sleep fix + ad-free screensavers for Fire TV Edition');
  console.log(
    boxen(`${title}\n${subtitle}`, {
      padding: 1,
      margin: { top: 1, bottom: 1, left: 0, right: 0 },
      borderStyle: 'round',
      borderColor: 'cyan',
    })
  );
}

/**
 * Prints the longer per-step explanation before any prompts for that step.
 */
export function explainStep({ title, body, settingChanged, reversible, standaloneCommand }) {
  const lines = [chalk.bold.white(title), ''];
  for (const line of body) lines.push(line);
  if (settingChanged) {
    lines.push('');
    lines.push(chalk.gray('Setting changed: ') + chalk.yellow(settingChanged));
  }
  if (reversible) {
    lines.push(chalk.gray('This can be undone at any time.'));
  }
  if (standaloneCommand) {
    lines.push('');
    lines.push(chalk.gray('Standalone command: ') + chalk.green(standaloneCommand));
  }
  console.log(
    boxen(lines.join('\n'), {
      padding: 1,
      margin: { top: 0, bottom: 1, left: 0, right: 0 },
      borderStyle: 'round',
      borderColor: 'blue',
    })
  );
}

/**
 * Wraps @inquirer/prompts select. Automatically appends '‹ Back' (unless
 * top-level) and 'Exit'. Exit is handled here, printing a goodbye and
 * exits the process, so callers never see it. Back is returned to the
 * caller as the BACK sentinel so the caller decides what "back" means.
 */
export async function menu({ message, choices, top = false }) {
  const fullChoices = [...choices];
  if (!top) {
    fullChoices.push({ name: '‹ Back', value: BACK });
  }
  fullChoices.push({ name: 'Exit', value: EXIT });

  const answer = await select({ message, choices: fullChoices });

  if (answer === EXIT) {
    console.log(chalk.gray('\nNo changes were made. Bye!\n'));
    process.exit(0);
  }

  return answer;
}

/**
 * Reads a single raw keypress without requiring Enter. Resolves true only
 * for a literal 'y' or 'Y'. Any other key resolves false. Ctrl+C always
 * exits immediately, same as everywhere else in the tool.
 */
export function promptYN(message) {
  return new Promise((resolve) => {
    process.stdout.write(chalk.bold(`${message} `) + chalk.gray('[y/N] '));

    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.resume();
    if (stdin.setRawMode) stdin.setRawMode(true);

    const onData = (buf) => {
      const key = buf.toString('utf8');
      cleanup();

      if (key === '\u0003') {
        console.log('\n');
        process.exit(130);
      }

      const isYes = key === 'y' || key === 'Y';
      console.log(isYes ? chalk.green('y') : chalk.gray(key === '\r' ? '' : key));
      resolve(isYes);
    };

    function cleanup() {
      stdin.removeListener('data', onData);
      if (stdin.setRawMode) stdin.setRawMode(Boolean(wasRaw));
      stdin.pause();
    }

    stdin.once('data', onData);
  });
}

/**
 * The one choke point every command funnels through before touching the
 * device or the filesystem. Prints a boxed "this is exactly what will
 * happen" summary, then asks Continue / Change my answers / Cancel.
 * Nothing runs until this resolves 'continue'.
 */
export async function confirmSummary(actions) {
  const lines = actions.map(
    (a) => `${chalk.green('*')} ${chalk.bold(a.label)}${a.detail ? chalk.gray(` (${a.detail})`) : ''}`
  );
  console.log(
    boxen(lines.join('\n'), {
      title: 'This is exactly what will happen',
      titleAlignment: 'left',
      padding: 1,
      margin: { top: 1, bottom: 1, left: 0, right: 0 },
      borderStyle: 'round',
      borderColor: 'yellow',
    })
  );

  return select({
    message: 'Nothing has been installed or changed yet. Continue?',
    choices: [
      { name: 'Continue', value: 'continue' },
      { name: 'Change my answers', value: 'restart' },
      { name: 'Cancel, do nothing', value: 'cancel' },
    ],
  });
}
