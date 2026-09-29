import { format } from 'node:util';

/**
 * The one place this CLI writes to the terminal. Plain stdout/stderr writes
 * keep every command's output going through a single function.
 * @param {...any} args printf-style arguments, like console.log
 */
export function print(...args) {
  process.stdout.write(`${format(...args)}\n`);
}

/**
 * @param {...any} args printf-style arguments, like console.error
 */
export function printError(...args) {
  process.stderr.write(`${format(...args)}\n`);
}
