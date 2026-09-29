import chalk from 'chalk';
import { explainStep, promptYesDefaultOrQuit } from '../ui.js';
import { connectAndCheck } from '../adb.js';
import { getSavedIp, saveIp, promptForIp } from '../device-config.js';
import { print } from '../output.js';

/**
 * The installer's first real step: confirm Developer Mode + ADB debugging
 * are on, then get a working IP address and save it to .env. Used only by
 * the main guided installer. Standalone commands call adb.ensureConnected()
 * directly instead, which reads the same .env but skips this instructional
 * framing.
 * @returns {Promise<string | null>} the working IP, or null if the user is not ready yet
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

  const ready = await promptYesDefaultOrQuit('Have you turned on Developer Mode and ADB debugging?');
  if (!ready) {
    print(chalk.yellow('\nNo changes were made. Run this again once Developer Mode and ADB debugging are on.\n'));
    return null;
  }

  let ip = getSavedIp();
  let connected = false;

  while (!connected) {
    ip = await promptForIp(ip || undefined);
    connected = await connectAndCheck(ip);
    if (!connected) {
      print(chalk.red(`\nCouldn't reach a Fire TV at ${ip}.`));
      print(
        chalk.gray(
          'Double-check the IP, and check the TV screen for a debugging-authorization prompt to accept.\n'
        )
      );
    }
  }

  saveIp(ip);
  print(chalk.green(`\nConnected to ${ip}. Saved to .env for next time.\n`));
  return ip;
}
