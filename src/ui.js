import { select } from './prompts.js';
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
    console.log(chalk.gray('\nBye!\n'));
    process.exit(0);
  }

  return answer;
}

/**
 * Shared raw single-keypress reader behind promptYN and
 * promptYesDefaultOrQuit. classify(key) decides the boolean result; Ctrl+C
 * and Esc always cancel immediately regardless of which prompt is asking.
 */
function readSingleKeypress(message, label, classify) {
  return new Promise((resolve) => {
    process.stdout.write(chalk.bold(`${message} `) + chalk.gray(`${label} `));

    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.resume();
    if (stdin.setRawMode) stdin.setRawMode(true);

    const onData = (buf) => {
      const key = buf.toString('utf8');

      if (key === '\u0003') {
        cleanup();
        console.log(chalk.gray('\n\nCancelled.\n'));
        process.exit(130);
      }

      // A lone Esc (arrow keys arrive as longer sequences starting with Esc).
      if (key === '\u001b') {
        cleanup();
        console.log(chalk.gray('\n\nCancelled.\n'));
        process.exit(0);
      }

      stdin.removeListener('data', onData);
      const result = classify(key);
      console.log(result ? chalk.green('y') : chalk.gray(key === '\r' ? '' : key));

      if (key === '\r' || key === '\n') {
        cleanup();
        resolve(result);
        return;
      }

      // Someone who types "y" then Enter would otherwise answer the next
      // prompt with that Enter, so hold the input briefly and drop it.
      const drop = () => {};
      stdin.on('data', drop);
      setTimeout(() => {
        stdin.removeListener('data', drop);
        cleanup();
        resolve(result);
      }, 150);
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
 * Reads a single raw keypress without requiring Enter. Resolves true only
 * for a literal 'y' or 'Y'. Any other key, including Enter, resolves false.
 * The safe default for anything consequential: doing nothing on Enter.
 */
export function promptYN(message) {
  return readSingleKeypress(message, '[y/N]', (key) => key === 'y' || key === 'Y');
}

/**
 * Same single-keypress mechanics as promptYN, but the default is yes:
 * Enter (or any key other than an explicit decline) resolves true. 'n'/'N'
 * and 'q'/'Q' both resolve false (quitting and declining are the same
 * outcome here). For prompts where continuing is the expected, common case
 * and declining is the rare one, not for anything consequential.
 */
export function promptYesDefaultOrQuit(message) {
  return readSingleKeypress(message, '[Y/n/q]', (key) => !(key === 'n' || key === 'N' || key === 'q' || key === 'Q'));
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
    message: 'Nothing has been changed yet. Continue?',
    choices: [
      { name: 'Continue', value: 'continue' },
      { name: 'Change my answers', value: 'restart' },
      { name: 'Cancel, do nothing', value: 'cancel' },
    ],
  });
}
