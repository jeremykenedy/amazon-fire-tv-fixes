import chalk from 'chalk';
import { renderBanner } from './banner.js';
import { isInstalled } from './device-config.js';

/**
 * Every command this package installs, and what it does. Kept in sync with
 * package.json's "bin" field by test/command-list.test.js, which diffs the
 * two, so this can never silently drift out of date.
 */
export const COMMANDS = [
  { name: 'amazon-fire-tv-fixes', desc: 'Runs the full guided installer: adb, device setup, Alexa fix, screensavers, and an optional timeout review.' },
  { name: 'amazon-fire-tv-fixes-uninstall', desc: 'Reverts what this tool changed on the TV (Alexa fix, active screensaver, installed screensavers, changed timeouts). Does not remove these commands; see uninstall.' },
  { name: 'firetv-install-adb', desc: 'Installs adb (Android SDK Platform Tools) if it is not already on your machine.' },
  { name: 'enable-alexa-fix', desc: 'Turns on the Alexa deep-sleep fix by itself.' },
  { name: 'disable-alexa-fix', desc: 'Reverts the Alexa deep-sleep fix back to the factory default.' },
  { name: 'firetv-screensavers', desc: 'Installs or removes the ad-free screensavers, by itself.' },
  { name: 'firetv-set-screensaver', desc: 'Chooses which installed screensaver is active, by itself.' },
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
  console.log(chalk.bold.white('Commands installed:\n'));
  for (const { name, desc } of COMMANDS) {
    console.log(`  ${chalk.green(name.padEnd(width))}  ${chalk.gray(desc)}`);
  }
  console.log('');
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
    console.log(chalk.yellow('Fire TV Tools is not installed yet. Nothing else will work until you run:\n'));
    const start = COMMANDS.find((c) => c.name === 'start');
    console.log(`  ${chalk.green(start.name)}  ${chalk.gray(start.desc)}\n`);
    console.log(chalk.gray('Once installed, this command will change to list every app command instead.\n'));
    return;
  }

  printCommandList();
}
