import { randomInt } from 'node:crypto';
import figlet from 'figlet';
import chalk from 'chalk';
import { installCliRuntime } from './cli-runtime.js';
import { print } from './output.js';

// Picked fresh, at random, on every invocation. Not meant to mean anything,
// just keeps the tool from looking the same twice in a row.
const COLOR_PALETTE = ['cyan', 'magenta', 'green', 'yellow', 'blue', 'red'];

function randomColor() {
  return COLOR_PALETTE[randomInt(COLOR_PALETTE.length)];
}

export const TAGLINE = 'Ad-free screensavers, a better home screen, and the Alexa deep-sleep fix for your Fire TV.';

/**
 * Pure: the widest title art that fits the terminal, falling back to a
 * smaller font and then plain text, so a narrow window never wraps it.
 * @param {number | undefined} columns
 * @returns {string}
 */
export function bannerArt(columns) {
  for (const font of ['Standard', 'Small', 'Mini']) {
    const art = figlet.textSync('FIRE TV TOOLKIT', { font });
    const widest = Math.max(...art.split('\n').map((line) => line.length));
    if (!columns || widest <= columns) {
      return art;
    }
  }
  return 'FIRE TV TOOLKIT';
}

/**
 * Renders the ASCII banner. Called first thing by every command.
 */
export function renderBanner() {
  installCliRuntime();
  const color = randomColor();
  print(chalk[color](bannerArt(process.stdout.columns)));
  print(chalk.gray(`${TAGLINE}\n`));
}
