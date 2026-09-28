import { parseArgs } from 'node:util';

export class FlagError extends Error {}

/**
 * @typedef {Object} FlagDef
 * @property {'boolean' | 'string'} type
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
      if (error) throw new FlagError(error);
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
