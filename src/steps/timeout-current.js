import chalk from 'chalk';
import { probeTimeouts, msToLabel } from './timeouts-shared.js';

/**
 * `firetv-timeouts-current`: prints the current value and captured baseline
 * for every known timeout.
 * @param {string} ip
 */
export async function currentTimeoutsReport(ip) {
  const results = await probeTimeouts(ip);
  console.log(chalk.bold.white('\nCurrent timeout values:\n'));
  for (const r of results) {
    if (!r.possible) {
      console.log(`${chalk.yellow(r.def.label)}: ${chalk.red('not available')} (${r.reason})`);
      continue;
    }
    console.log(`${chalk.yellow(r.def.label)}: ${msToLabel(r.currentMs)}`);
    console.log(chalk.gray(`  observed at first contact: ${msToLabel(r.baselineMs)}`));
  }
  console.log('');
}
