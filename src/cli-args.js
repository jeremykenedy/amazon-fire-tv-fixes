import path from 'node:path';
import { parseArgs } from 'node:util';
import { COMMANDS } from './command-list.js';

export class FlagError extends Error {}

/** Thrown by parseFlags when --help / -h is passed; its message is the usage text. */
export class HelpRequested extends Error {}

/**
 * @typedef {Object} FlagDef
 * @property {'boolean' | 'string'} type
 * @property {string} [desc] one-line description shown by --help
 * @property {string[]} [choices]
 * @property {(value: string) => string | null} [validate]
 */

/**
 * Thin wrapper around node:util parseArgs. spec is a plain object:
 *   { flagName: { type: 'boolean' | 'string', choices: [...], validate(v) } }
 * choices and validate are both optional; either can reject a value by
 * throwing/returning a FlagError-worthy message. Unknown flags throw
 * (parseArgs strict mode) so a typo never gets silently ignored.
 * @param {Record<string, FlagDef>} spec
 * @param {string[]} argv
 * @returns {Record<string, string | boolean>}
 */
export function parseFlags(spec, argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    throw new HelpRequested(buildUsage(commandName(), spec));
  }

  const options = Object.fromEntries(Object.entries(spec).map(([name, def]) => [name, { type: def.type }]));

  let values;
  try {
    ({ values } = parseArgs({ args: argv, options, strict: true }));
  } catch (err) {
    throw new FlagError(err.message);
  }

  for (const [name, def] of Object.entries(spec)) {
    const value = values[name];
    if (value === undefined) continue;

    if (def.choices && !def.choices.includes(value)) {
      throw new FlagError(`--${name} must be one of: ${def.choices.join(', ')} (got "${value}")`);
    }
    if (def.validate) {
      const error = def.validate(value);
      if (error) throw new FlagError(`--${name}: ${error}`);
    }
  }

  return values;
}

/**
 * True when the command was given enough flags to skip prompting entirely.
 * A command is "flag-driven" once at least one non-`--yes`/`--force` flag
 * was passed; `--yes` alone without a choice flag falls back to a
 * documented default instead (handled by the caller, not here).
 * @param {Record<string, string | boolean>} values
 * @param {string[]} choiceFlagNames
 * @returns {boolean}
 */
export function hasChoiceFlags(values, choiceFlagNames) {
  return choiceFlagNames.some((name) => values[name] !== undefined);
}

function commandName() {
  return path.basename(process.argv[1] || '', '.js');
}

/**
 * Pure: the --help text for one command, built from its flag spec and the
 * command list's description so neither can drift from what really exists.
 * @param {string} name
 * @param {Record<string, FlagDef>} spec
 * @returns {string}
 */
export function buildUsage(name, spec) {
  const description = COMMANDS.find((c) => c.name === name)?.desc;
  const rows = Object.entries(spec).map(([flag, def]) => {
    const label = def.type === 'string' ? `--${flag} <${def.choices ? def.choices.join('|') : 'value'}>` : `--${flag}`;
    return [label, def.desc || ''];
  });
  rows.push(['-h, --help', 'Show this help.']);

  const width = Math.max(...rows.map(([label]) => label.length));
  const lines = [`Usage: ${name}${Object.keys(spec).length ? ' [options]' : ''}`];
  if (description) lines.push('', description);
  lines.push('', 'Options:');
  for (const [label, desc] of rows) lines.push(`  ${label.padEnd(width)}${desc ? `  ${desc}` : ''}`);
  return lines.join('\n');
}

/**
 * The catch-block every command shares: --help prints usage and exits 0; a
 * bad flag prints the problem plus an example and exits 1; anything else is
 * a real bug and is rethrown.
 * @param {unknown} err
 * @param {string} example
 * @returns {never}
 */
export function exitOnFlagError(err, example) {
  if (err instanceof HelpRequested) {
    console.log(err.message);
    console.log(`\nExample: ${example}`);
    process.exit(0);
  }
  if (!(err instanceof FlagError)) throw err;
  console.error(err.message);
  console.error(`Example: ${example}`);
  process.exit(1);
}
