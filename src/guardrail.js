import chalk from 'chalk';
import { input } from '@inquirer/prompts';

/**
 * Gate for anything regressive or destructive. Not risky: no-op, returns
 * true immediately. Risky + force: warns once, returns true. Risky,
 * interactive, no force: warns, points at the safer command, and requires
 * typing the literal word "yes" or it returns false (nothing was changed).
 * Risky, non-interactive, no force: prints an error and returns false
 * without prompting for anything, since there is no one there to ask.
 * @param {Object} options
 * @param {boolean} options.risky
 * @param {string} options.warning
 * @param {string | null} [options.saferCommand]
 * @param {boolean} options.force
 * @param {boolean} options.interactive
 * @param {(config: {message: string}) => Promise<string>} [options.promptFn]
 * @returns {Promise<boolean>} whether the caller may proceed
 */
function printWarning(warning, saferCommand) {
  console.log(chalk.yellow(`\n${warning}`));
  if (saferCommand) {
    console.log(chalk.gray(`If that's not what you want, use: ${chalk.green(saferCommand)}`));
  }
}

async function confirmTyped(promptFn) {
  const typed = await promptFn({ message: 'Type "yes" to continue, anything else cancels:' });
  if (typed.trim() === 'yes') return true;
  console.log(chalk.gray('\nCancelled. Nothing was changed.\n'));
  return false;
}

export async function enforceGuardrail({ risky, warning, saferCommand, force, interactive, promptFn = input }) {
  if (!risky) return true;

  printWarning(warning, saferCommand);

  if (force) {
    console.log(chalk.gray('--force given, continuing.\n'));
    return true;
  }

  if (!interactive) {
    console.log(chalk.red('\nRefusing to continue without --force in non-interactive mode. Nothing was changed.\n'));
    return false;
  }

  return confirmTyped(promptFn);
}
