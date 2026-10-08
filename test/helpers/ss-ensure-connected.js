// Subprocess entry for the ensureConnected tests. --tty makes stdin report
// itself as a terminal so the IP prompt paths run; the answers are still
// piped in by drive().
import { ensureConnected } from '../../src/adb.js';
import { print } from '../../src/output.js';

if (process.argv.includes('--tty')) {
  process.stdin.isTTY = true;
}
print(`Resolved ${await ensureConnected()}`);
