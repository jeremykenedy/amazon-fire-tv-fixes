import ora from 'ora';

/**
 * Starts a spinner that is safe everywhere. ora animates by measuring the
 * terminal width, and on a TTY that reports zero columns (some SSH and CI
 * setups) it redraws forever, so the animation is only enabled when the
 * terminal has a real width; otherwise it prints plain lines instead.
 * @param {string} text
 * @param {{quiet?: boolean}} [options] quiet: print nothing when there is no TTY at all
 * @returns {import('ora').Ora}
 */
export function startSpinner(text, { quiet = false } = {}) {
  const stream = process.stderr;
  const animated = Boolean(stream.isTTY) && stream.columns > 0;
  return ora({ text, isEnabled: animated, isSilent: quiet && !stream.isTTY }).start();
}
