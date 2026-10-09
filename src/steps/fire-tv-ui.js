import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { select, input } from '../prompts.js';
import { explainStep } from '../ui.js';
import { runWizard, withBack, BACK } from '../wizard.js';
import { startSpinner } from '../spinner.js';
import { markFailed } from '../exit-status.js';
import { print } from '../output.js';
import { listPackages, remoteFileExists, openLauncher } from '../adb.js';
import { FIRE_TV_UI } from '../launcher-registry.js';
import {
  installFireTvUi, uninstallFireTvUi, retrieveBackup, placeBackup, readBackup,
  TV_BACKUP, UI_SCREENSAVERS,
} from '../apply/fire-tv-ui.js';

export const FLAG_SPEC = {
  install: { type: 'boolean', desc: 'Install or update Fire TV UI.' },
  uninstall: { type: 'boolean', desc: 'Remove Fire TV UI; save and keep its TV backup by default.' },
  setup: { type: 'string', choices: ['simple', 'keep', 'tv', 'import'], desc: 'Use the saved simple layout, keep settings, restore the TV backup, or import --file.' },
  home: { type: 'string', choices: ['fire-tv-ui', 'amazon', 'keep'], desc: 'Choose what the Home button opens.' },
  screensaver: { type: 'string', choices: ['keep', 'on', 'off', ...UI_SCREENSAVERS.map((entry) => entry.id)], desc: 'Keep, enable, disable, or choose an installed screensaver.' },
  protection: { type: 'string', choices: ['on', 'off', 'keep'], desc: 'Protect Home, screensaver, and timer settings from system reversion.' },
  backup: { type: 'string', choices: ['keep', 'delete'], desc: 'Keep or explicitly delete the TV backup when uninstalling.' },
  export: { type: 'string', desc: 'Retrieve a backup to a new file on this computer.' },
  file: { type: 'string', desc: 'Place this backup on the TV, or use it with --setup=import.' },
  restore: { type: 'boolean', desc: 'Also apply the backup supplied with --file.' },
  apk: { type: 'string', desc: 'Install a local signed APK instead of downloading the release.' },
  sha256: { type: 'string', validate: (value) => /^[a-fA-F0-9]{64}$/.test(value) ? null : 'Expected 64 hexadecimal characters.', desc: 'Required checksum for --apk.' },
  yes: { type: 'boolean', desc: 'Use explicit flags without interactive prompts.' },
};

export function optionsFromFlags(flags) {
  if (flags.install && flags.uninstall) {
    throw new Error('Choose either --install or --uninstall.');
  }
  const action = flags.install ? 'install' : flags.uninstall ? 'uninstall' : flags.file ? 'import' : flags.export ? 'export' : null;
  if (!action) {
    throw new Error('Choose --install, --uninstall, --file, or --export.');
  }
  if (flags.setup && action !== 'install') {
    throw new Error('--setup belongs with --install.');
  }
  if ((flags.home || flags.screensaver || flags.protection || flags.apk || flags.sha256) && action !== 'install') {
    throw new Error('--home, --screensaver, --protection, --apk, and --sha256 belong with --install.');
  }
  if (flags.backup && action !== 'uninstall') {
    throw new Error('--backup belongs with --uninstall.');
  }
  if (flags.restore && action !== 'import') {
    throw new Error('--restore belongs with --file. Install imports are restored automatically.');
  }
  if (flags.apk && !flags.sha256 || flags.sha256 && !flags.apk) {
    throw new Error('Pass both --apk and --sha256 for a local build.');
  }
  if (flags.setup === 'import' && !flags.file) {
    throw new Error('--setup=import requires --file.');
  }
  if (action === 'uninstall' && flags.file || action === 'import' && flags.export) {
    throw new Error('Choose one backup transfer direction.');
  }
  if (action === 'install' && flags.file && flags.setup !== 'import') {
    throw new Error('Use --setup=import with --file when installing.');
  }
  return { ...flags, action, setup: flags.setup || 'keep', home: flags.home || 'keep',
    screensaver: flags.screensaver || 'keep', protection: flags.protection || 'keep', backup: flags.backup || 'keep' };
}

function destinationError(filename) {
  const absolute = path.resolve(filename.trim());
  if (!filename.trim()) {
    return 'Enter a filename.';
  }
  if (fs.existsSync(absolute)) {
    return 'That file already exists. Choose a new filename to keep both backups.';
  }
  if (!fs.existsSync(path.dirname(absolute))) {
    return 'Choose a folder that already exists.';
  }
  return null;
}

async function askDestination() {
  return path.resolve(await input({ message: 'Save the backup on this computer as:',
    validate: (value) => destinationError(value) || true }));
}

async function askSource() {
  return path.resolve(await input({ message: 'Path to the settings backup:', validate: (value) => {
    try {
      readBackup(path.resolve(value.trim()));
      return true;
    } catch (error) {
      return error.message;
    }
  } }));
}

async function askExport(showBack) {
  const answer = await select({ message: 'Also save a copy on this computer?', choices: withBack([
    { name: 'Keep the backup on the TV', value: false },
    { name: 'Retrieve a copy to this computer', value: true },
  ], showBack) });
  if (answer === BACK || !answer) {
    return answer;
  }
  return askDestination();
}

export function planSummary(options) {
  if (options.action === 'install') {
    const setups = { simple: 'Apply the saved simple layout', keep: 'Keep the current app settings',
      tv: 'Restore the backup saved on the TV', import: 'Restore the supplied settings backup' };
    const actions = [{ label: 'Install or update Fire TV UI', detail: options.apk || 'Verified GitHub release' },
      { label: setups[options.setup], detail: options.file },
      { label: 'Allow TV screensaver control and persistent backups' },
      { label: `Home button: ${options.home}` }, { label: `TV screensaver: ${options.screensaver}` },
      { label: `Settings protection: ${options.protection || 'keep'}` }];
    if (options.export) actions.push({ label: 'Retrieve the current settings backup', detail: options.export });
    return actions;
  }
  if (options.action === 'uninstall') {
    const actions = [{ label: 'Return the Home button to Amazon and uninstall Fire TV UI' },
      { label: options.backup === 'delete' ? 'Delete the Fire TV UI backup files on the TV' : 'Save and keep the layout backup on the TV' }];
    if (options.export) actions.push({ label: 'Retrieve a backup before uninstalling', detail: options.export });
    return actions;
  }
  if (options.action === 'export') {
    return [{ label: 'Retrieve the TV settings backup', detail: options.export }];
  }
  return [{ label: 'Place a backup in TV Downloads', detail: options.file },
    { label: options.restore ? 'Apply this backup to Fire TV UI' : 'Leave it ready for Restore backup sent from computer' }];
}

async function execute(ip, options, installed) {
  if (options.file) readBackup(options.file);
  if (options.export && destinationError(options.export)) throw new Error(destinationError(options.export));
  if (options.action === 'install' && options.export && !installed) {
    throw new Error('There is no installed Fire TV UI layout to export before this install.');
  }
  const spinner = startSpinner('Preparing Fire TV UI');
  const progress = (message) => { spinner.text = message; };
  try {
    if (options.action === 'install') {
      await installFireTvUi(ip, options, progress);
      spinner.succeed('Fire TV UI is ready. Open Settings for Screensavers, Backup/Restore, and Startup and protection.');
    } else if (options.action === 'uninstall') {
      await uninstallFireTvUi(ip, options, progress);
      spinner.succeed(options.backup === 'delete' ? 'Fire TV UI and its TV backups were removed.' : 'Fire TV UI was removed. Your backup remains in TV Downloads.');
    } else if (options.action === 'export') {
      await retrieveBackup(ip, options.export, { refresh: installed });
      spinner.succeed(`Backup retrieved: ${options.export}`);
    } else {
      await placeBackup(ip, options.file, { restore: Boolean(options.restore) });
      if (options.restore) await openLauncher(ip, FIRE_TV_UI.pkg);
      spinner.succeed(options.restore ? 'Backup transferred and restored.' : 'Backup transferred. Open Backup/Restore on the TV to restore it.');
    }
  } catch (error) {
    spinner.fail(error.message);
    markFailed();
  }
}

async function installWizard(ip, installed, hasBackup, available) {
  await runWizard({
    steps: [
      { key: 'layout', prompt: async (_state, { showBack }) => {
        const kind = await select({ message: 'How would you like to set up Fire TV UI?', choices: withBack([
          { name: 'Clean, simple install with the saved TV layout', value: 'simple' },
          { name: installed ? 'Keep my current Fire TV UI settings' : 'Start with the app defaults', value: 'keep' },
          ...(hasBackup ? [{ name: 'Restore the backup already on the TV', value: 'tv' }] : []),
          { name: 'Import a settings backup from this computer', value: 'import' },
        ], showBack) });
        return { kind, file: kind === 'import' ? await askSource() : undefined };
      } },
      ...(installed ? [{ key: 'export', prompt: (_state, { showBack }) => askExport(showBack) }] : []),
      { key: 'home', prompt: (_state, { showBack }) => select({ message: 'What should the Home button open?', choices: withBack([
        { name: 'Fire TV UI', value: 'fire-tv-ui' }, { name: 'Keep the current Home button', value: 'keep' },
        { name: 'Amazon home screen', value: 'amazon' },
      ], showBack) }) },
      { key: 'screensaver', prompt: (_state, { showBack }) => select({ message: 'TV screensaver:', choices: withBack([
        { name: 'Keep my current screensaver and On/Off setting', value: 'keep' },
        { name: 'Turn the current screensaver on', value: 'on' }, { name: 'Turn it off', value: 'off' },
        ...available.map((entry) => ({ name: `Use ${entry.name}`, value: entry.id })),
      ], showBack) }) },
      { key: 'protection', prompt: (_state, { showBack }) => select({ message: 'Protect your device settings from system reversion?', choices: withBack([
        { name: 'Protect Home, screensaver and timers', value: 'on' },
        { name: 'Keep my protection setting', value: 'keep' },
        { name: 'Allow other apps and CLI tools to change settings', value: 'off' },
      ], showBack) }) },
    ],
    buildSummary: (state) => planSummary({ ...state, action: 'install', setup: state.layout.kind, file: state.layout.file }),
    onConfirm: (state) => execute(ip, { ...state, action: 'install', setup: state.layout.kind, file: state.layout.file }, installed),
  });
}

export async function manageFireTvUi(ip, flags = {}) {
  const packages = await listPackages(ip);
  const installed = packages.includes(FIRE_TV_UI.pkg);
  if (Object.keys(flags).length) {
    try {
      const options = optionsFromFlags(flags);
      if (flags.yes) {
        await execute(ip, options, installed);
      } else {
        await runWizard({ steps: [], buildSummary: () => planSummary(options),
          onConfirm: () => execute(ip, options, installed) });
      }
    } catch (error) {
      print(chalk.red(`\n${error.message}\n`));
      markFailed();
    }
    return;
  }
  const hasBackup = await remoteFileExists(ip, TV_BACKUP);
  explainStep({ title: 'Fire TV UI', body: [
    'Set up your home screen, Home button, screensaver, and backups.',
    'Choose every option first, review the plan, then apply it together.',
    'The simple setup uses the saved TV layout. Backups stay on the TV',
    'after uninstalling and can be retrieved or restored from your computer.',
  ], standaloneCommand: 'firetv-ui', reversible: true });
  const action = await select({ message: 'What would you like to do with Fire TV UI?', choices: [
    { name: installed ? 'Install a clean setup or update Fire TV UI' : 'Install Fire TV UI', value: 'install' },
    ...(installed ? [{ name: 'Uninstall Fire TV UI', value: 'uninstall' }] : []),
    ...(installed || hasBackup ? [{ name: 'Retrieve a backup to this computer', value: 'export' }] : []),
    { name: 'Place a backup on the TV', value: 'import' },
  ] });
  if (action === 'install') {
    await installWizard(ip, installed, hasBackup, UI_SCREENSAVERS.filter((entry) => packages.includes(entry.pkg)));
    return;
  }
  const steps = action === 'uninstall' ? [
    { key: 'export', prompt: (_state, { showBack }) => askExport(showBack) },
    { key: 'backup', prompt: (_state, { showBack }) => select({ message: 'Keep the backup after uninstalling?', choices: withBack([
      { name: 'Save and keep my TV backup for reinstalling', value: 'keep' },
      { name: 'Delete the Fire TV UI backup files from the TV', value: 'delete' },
    ], showBack) }) },
  ] : action === 'export' ? [{ key: 'export', prompt: () => askDestination() }] : [
    { key: 'file', prompt: () => askSource() },
    { key: 'restore', prompt: (_state, { showBack }) => select({ message: 'Apply the backup now?', choices: withBack([
      { name: 'Place it on the TV for later restore', value: false },
      ...(installed ? [{ name: 'Restore it now and reopen Fire TV UI', value: true }] : []),
    ], showBack) }) },
  ];
  await runWizard({ steps, buildSummary: (state) => planSummary({ ...state, action }),
    onConfirm: (state) => execute(ip, { ...state, action }, installed) });
}
