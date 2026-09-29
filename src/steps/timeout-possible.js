import chalk from 'chalk';
import { listRelatedSettings } from '../apply/timeouts.js';
import { probeTimeouts } from './timeouts-shared.js';

/**
 * `firetv-timeouts-possible`: reports which known timeouts this TV actually
 * supports right now, with the reason for anything that isn't, plus any
 * other timeout/sleep/screensaver-looking setting detected on the device
 * that this tool doesn't yet support.
 * @param {string} ip
 */
export async function possibleTimeoutsReport(ip) {
  const results = await probeTimeouts(ip);
  console.log(chalk.bold.white('\nWhat this TV supports:\n'));
  for (const r of results) {
    console.log(
      r.possible ? `${chalk.green('possible')}      ${r.def.label}` : `${chalk.red('not possible')}  ${r.def.label} - ${r.reason}`
    );
  }

  const related = await listRelatedSettings(ip);
  if (related.length > 0) {
    console.log(chalk.gray('\nOther settings detected on your TV that might be timeout-related (not yet supported by this tool):'));
    for (const line of related) console.log(chalk.gray(`  ${line}`));
  }
  console.log('');
}
