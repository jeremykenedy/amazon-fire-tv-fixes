import chalk from 'chalk';
import { probeTimeouts, msToLabel } from './timeouts-shared.js';
import { print } from '../output.js';

/**
 * `firetv-timeouts-current`: prints the current value and captured baseline
 * for every known timeout.
 * @param {string} ip
 */
export async function currentTimeoutsReport(ip) {
  const results = await probeTimeouts(ip);
  print(chalk.bold.white('\nCurrent timeout values:\n'));
  for (const r of results) {
    if (!r.possible) {
      print(`${chalk.yellow(r.def.label)}: ${chalk.red('not available')} (${r.reason})`);
      continue;
    }
    print(`${chalk.yellow(r.def.label)}: ${msToLabel(r.currentMs)}`);
    print(chalk.gray(`  observed at first contact: ${msToLabel(r.baselineMs)}`));
  }
  print('');
}
