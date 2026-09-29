/**
 * Marks the whole run as failed (exit code 1) without stopping it, so any
 * remaining output and cleanup still happen. Used wherever a command hits an
 * error or refuses to act, so scripts can tell it did not succeed.
 */
export function markFailed() {
  process.exitCode = 1;
}
