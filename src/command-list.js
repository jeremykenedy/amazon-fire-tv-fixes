import chalk from 'chalk';
import { renderBanner } from './banner.js';
import { isInstalled } from './device-config.js';
import { print } from './output.js';

/**
 * Every command this package installs, and what it does. Kept in sync with
 * package.json's "bin" field by test/command-list.test.js, which diffs the
 * two, so this can never silently drift out of date.
 */
export const COMMANDS = [
  { name: 'fire-tv-toolkit', desc: 'Runs the full guided installer: adb, device setup, Alexa fix, screensavers, timeouts and optimizing.' },
  { name: 'firetv-revert', desc: 'Puts the TV back how it was, item by item. Keeps these commands installed; see uninstall.' },
  { name: 'firetv-install-adb', desc: 'Installs adb (Android SDK Platform Tools) if it is not already on your machine.' },
  { name: 'enable-alexa-fix', desc: 'Turns on the Alexa deep-sleep fix by itself.' },
  { name: 'disable-alexa-fix', desc: 'Reverts the Alexa deep-sleep fix back to the factory default.' },
  { name: 'firetv-screensavers', desc: 'Installs or removes the ad-free screensavers, by itself.' },
  { name: 'firetv-set-screensaver', desc: 'Chooses which installed screensaver is active, by itself.' },
  { name: 'screensaver', desc: 'Short for firetv-set-screensaver: chooses which installed screensaver is active.' },
  { name: 'firetv-launcher', desc: 'Installs the optional AT4K home screen and switches the Home button between it and the Amazon menu.' },
  { name: 'launcher', desc: 'Short for firetv-launcher: installs AT4K or switches the Home button.' },
  { name: 'firetv-optimize', desc: 'Checks the TV for settings that stop or spoil screensavers and fixes only those it has. firetv-revert puts them back.' },
  { name: 'optimize', desc: 'Short for firetv-optimize: sets the TV up for screensavers.' },
  { name: 'firetv-timeouts', desc: 'Review, edit, and/or reset any of the TV timeouts, all in one guided flow.' },
  { name: 'firetv-timeout-sleep', desc: 'Changes the sleep (deep-sleep/standby) timeout by itself.' },
  { name: 'firetv-timeout-screensaver', desc: 'Changes the screensaver timeout by itself.' },
  { name: 'firetv-timeouts-reset', desc: 'Resets one, several (--only=), or all (--all) timeouts back to their first-observed baseline.' },
  { name: 'firetv-timeouts-possible', desc: 'Reports which timeouts this specific TV actually supports right now.' },
  { name: 'firetv-timeouts-current', desc: 'Reports the current value and captured baseline for every known timeout.' },
  { name: 'info', desc: 'Lists every command installed and what it does, with the banner. Does not change or start anything.' },
  { name: 'information', desc: 'Alias for info: lists every command installed and what it does, with the banner.' },
  { name: 'guide', desc: 'Alias for info: lists every command installed and what it does, with the banner.' },
  { name: 'start', desc: 'Opens the guided menu. Runs setup if nothing is installed yet, or hands off to update if it already is.' },
  { name: 'update', desc: 'Re-runs setup, overriding what is already installed. Runs plain setup instead if nothing is installed yet.' },
  { name: 'firetv', desc: 'Alias for info: lists every command installed and what it does, with the banner.' },
  { name: 'uninstall', desc: 'First offers to put the TV back how it was, then removes these commands, resets .env, and offers to delete the repo.' },
  { name: 'delete', desc: 'Permanently deletes this repo from your machine, after a typed "confirm". Does not touch the TV.' },
  { name: 'remove', desc: 'Alias for delete: permanently deletes this repo from your machine, after a typed "confirm".' },
];

/**
 * Prints COMMANDS as an aligned, colored list.
 */
export function printCommandList() {
  const width = Math.max(...COMMANDS.map((c) => c.name.length));
  print(chalk.bold.white('Commands installed:\n'));
  for (const { name, desc } of COMMANDS) {
    print(`  ${chalk.green(name.padEnd(width))}  ${chalk.gray(desc)}`);
  }
  print('');
}

/**
 * The full `info` screen, shared by `info` and `firetv` (a true alias, not
 * just similar behavior). Banner first, always. If setup has never
 * completed, only the command that starts setup is shown, since nothing
 * else will work yet; otherwise the full command list is shown.
 */
export function printInfoScreen() {
  renderBanner();

  if (!isInstalled()) {
    print(chalk.yellow('Fire TV Toolkit is not installed yet. Nothing else will work until you run:\n'));
    const start = COMMANDS.find((c) => c.name === 'start');
    print(`  ${chalk.green(start.name)}  ${chalk.gray(start.desc)}\n`);
    print(chalk.gray('Once installed, this command will change to list every app command instead.\n'));
    return;
  }

  printCommandList();
}
