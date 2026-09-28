import chalk from 'chalk';
import { explainStep, promptYN } from '../ui.js';
import { connect, isReachable } from '../adb.js';
import { getSavedIp, saveIp, promptForIp } from '../device-config.js';

/**
 * The installer's first real step: confirm Developer Mode + ADB debugging
 * are on, then get a working IP address and save it to .env. Used only by
 * the main guided installer. Standalone commands call adb.ensureConnected()
 * directly instead, which reads the same .env but skips this instructional
 * framing.
 * @returns {Promise<string>} the working IP
 */
export async function ensureDeviceReady() {
  explainStep({
    title: 'Step: Connect to your Fire TV',
    body: [
      'This tool talks to your Fire TV over adb, which is off by default and',
      'has to be turned on once, on the TV itself, before anything here works.',
      '',
      chalk.bold('1. Turn on Developer Mode:'),
      '   Settings › Device & Software › About, then select "Your TV" 7',
      '   times in a row until it says "You are now a developer!"',
      '',
      chalk.bold('2. Turn on ADB debugging:'),
      '   Settings › Device & Software › Developer options › ADB debugging → On',
      '',
      chalk.bold("3. Find your TV's IP address:"),
      '   Settings › Device & Software › About › Network',
    ],
  });

  const ready = await promptYN('Have you turned on Developer Mode and ADB debugging?');
  if (!ready) {
    console.log(chalk.yellow('\nNo changes were made. Turn those on, then run this again.\n'));
    process.exit(0);
  }

  let ip = getSavedIp();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    ip = await promptForIp(ip || undefined);
    await connect(ip);

    if (await isReachable(ip)) {
      saveIp(ip);
      console.log(chalk.green(`\nConnected to ${ip}. Saved to .env for next time.\n`));
      return ip;
    }

    console.log(chalk.red(`\nCouldn't reach a Fire TV at ${ip}.`));
    console.log(
      chalk.gray(
        'Double-check the IP, and check the TV screen for a debugging-authorization prompt to accept.\n'
      )
    );
  }
}
