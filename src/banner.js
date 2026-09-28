import { randomInt } from 'crypto';
import figlet from 'figlet';
import chalk from 'chalk';

// Picked fresh, at random, on every invocation. Not meant to mean anything,
// just keeps the tool from looking the same twice in a row.
const COLOR_PALETTE = ['cyan', 'magenta', 'green', 'yellow', 'blue', 'red'];

function randomColor() {
  return COLOR_PALETTE[randomInt(COLOR_PALETTE.length)];
}

/**
 * Renders the ASCII banner. Called first thing by every command.
 */
export function renderBanner() {
  const text = figlet.textSync('FIRE TV FIXES', { font: 'Standard' });
  const color = randomColor();
  console.log(chalk[color](text));
  console.log(chalk.gray('Alexa deep-sleep fix + ad-free screensavers for Fire TV Edition\n'));
}
