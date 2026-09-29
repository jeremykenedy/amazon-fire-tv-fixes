import { TIMEOUTS, getTimeoutMs } from '../apply/timeouts.js';
import { getFactoryBaseline, hasFactoryBaseline, saveFactoryBaseline } from '../timeout-config.js';

// The largest ms value that survives an exact round-trip through adb as a
// decimal string. Above this, a "whole number" can still pass
// Number.isInteger while silently losing precision (or, for --minutes,
// overflowing past this bound the moment it's multiplied by 60000).
const MAX_SAFE_MS = Number.MAX_SAFE_INTEGER;
const MAX_SAFE_MINUTES = Math.floor(MAX_SAFE_MS / 60000);

// Digits only, at least one, so an empty string, whitespace, a sign, a
// decimal point, or scientific notation (e.g. "1e21") are rejected outright
// instead of being silently coerced by Number() -- Number('') is 0, which
// would otherwise pass as a valid "whole number 0 or greater" and silently
// set a timeout to zero on a blank flag value or a blank Enter.
const WHOLE_NUMBER_RE = /^\d+$/;

/**
 * @param {string} value
 * @returns {string | null}
 */
export function mustBeNonNegativeInteger(value) {
  if (!WHOLE_NUMBER_RE.test(value)) return 'must be a whole number 0 or greater';
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n > MAX_SAFE_MS) return `must be ${MAX_SAFE_MS} or less`;
  return null;
}

/**
 * Same as mustBeNonNegativeInteger, but bounded so the value can't overflow
 * once it's converted to ms (value * 60000).
 * @param {string} value
 * @returns {string | null}
 */
export function mustBeValidMinutes(value) {
  if (!WHOLE_NUMBER_RE.test(value)) return 'must be a whole number 0 or greater';
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n > MAX_SAFE_MINUTES) return `must be ${MAX_SAFE_MINUTES} or less`;
  return null;
}

/**
 * @param {string} value comma-separated list of timeout ids
 * @returns {string | null}
 */
export function mustBeKnownTimeoutIds(value) {
  const parts = value.split(',').map((s) => s.trim());
  if (parts.some((id) => !id)) return 'provide one or more timeout ids, e.g. sleep,screensaver';
  const validIds = TIMEOUTS.map((t) => t.id);
  const unknown = parts.filter((id) => !validIds.includes(id));
  if (unknown.length > 0) {
    return `Unknown timeout id(s): ${unknown.join(', ')}. Valid ids: ${validIds.join(', ')}`;
  }
  return null;
}

/**
 * @param {number | null | undefined} ms
 * @returns {string}
 */
export function msToLabel(ms) {
  if (ms === null || ms === undefined) return 'unknown';
  if (ms === 0) return '0 ms (never)';
  if (ms % 60000 === 0) return `${ms / 60000} min (${ms} ms)`;
  return `${ms} ms`;
}

/**
 * Reads every known timeout from the TV. On the first successful read of a
 * given timeout, silently captures the observed value as its baseline if
 * none has been captured yet, so a later reset has something real to go
 * back to. Never claims this baseline is a guaranteed factory value, only
 * the value observed the first time this tool checked. The single source of
 * truth every timeout command (current/possible/set/manage/reset) reads
 * device state through.
 * @param {string} ip
 * @returns {Promise<Array<{def: object, possible: boolean, currentMs?: number, baselineMs?: number | null, reason?: string}>>}
 */
export async function probeTimeouts(ip) {
  const results = [];
  for (const def of TIMEOUTS) {
    try {
      const currentMs = await getTimeoutMs(ip, def);
      if (currentMs === null) {
        results.push({ def, possible: false, reason: 'Could not read a value for this setting from your TV.' });
        continue;
      }
      if (!hasFactoryBaseline(def.id)) saveFactoryBaseline(def.id, currentMs);
      results.push({ def, possible: true, currentMs, baselineMs: getFactoryBaseline(def.id) });
    } catch (err) {
      results.push({ def, possible: false, reason: err.message || String(err) });
    }
  }
  return results;
}
