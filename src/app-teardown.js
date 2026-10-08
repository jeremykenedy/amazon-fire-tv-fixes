import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { input } from './prompts.js';
import { writeEnvFile } from './device-config.js';
import { markFailed } from './exit-status.js';
import { print } from './output.js';

const execFileAsync = promisify(execFile);

// Resolved relative to this file, same convention as device-config.js.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.join(__dirname, '..');

let projectRootOverride = null;

/**
 * Test-only: points every path below at a throwaway checkout instead of
 * this repository, so the delete flow can never touch the real one.
 * @param {string | null} dir null restores the default
 */
export function setProjectRootForTesting(dir) {
  projectRootOverride = dir;
}

function projectRoot() {
  return projectRootOverride || PROJECT_ROOT;
}

function packageJsonPath() {
  return path.join(projectRoot(), 'package.json');
}

function packageName() {
  return JSON.parse(fs.readFileSync(packageJsonPath(), 'utf8')).name;
}

/**
 * Removes the global command symlinks `npm link` created. Modern npm (11+)
 * treats bare `npm unlink` (no args) as an alias for `npm uninstall` and
 * requires a package name; confirmed live that only `npm uninstall -g
 * <name>` actually removes the symlinks (the older "bare unlink from
 * inside the linked directory" behavior is gone).
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function unlinkCommands() {
  try {
    await execFileAsync('npm', ['uninstall', '-g', packageName()], { cwd: projectRoot() });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.stderr || err.message };
  }
}

/**
 * Resets .env to .env.example's placeholder contents (or an empty file if
 * no example exists), wiping the saved IP, INSTALLED flag, and captured
 * timeout baselines in one step.
 */
export function wipeEnvToTemplate() {
  const envExamplePath = path.join(projectRoot(), '.env.example');
  const template = fs.existsSync(envExamplePath) ? fs.readFileSync(envExamplePath, 'utf8') : '';
  writeEnvFile(template);
}

/**
 * @returns {string} the directory that will become the working directory's
 * parent once this repo is deleted.
 */
export function repoParentDir() {
  return path.dirname(projectRoot());
}

/**
 * Refuses to proceed unless the project root genuinely looks like this
 * package's own checkout, not some miscomputed path. The one hard guard
 * before anything gets deleted.
 * @returns {boolean}
 */
function looksSafeToDelete() {
  const root = projectRoot();
  if (root === path.parse(root).root) {
    return false;
  }
  if (root === osHomeDir()) {
    return false;
  }
  if (!fs.existsSync(packageJsonPath())) {
    return false;
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath(), 'utf8'));
    return pkg.name === 'fire-tv-toolkit';
  } catch {
    return false;
  }
}

function osHomeDir() {
  return os.homedir();
}

/**
 * Prints a clear, red, unmissable destructive-action warning and requires
 * the literal word "confirm" (not just "yes") before returning true.
 * Anything else, including a blank Enter, cancels.
 * @param {string} whatWillHappen one line describing exactly what will be deleted
 * @returns {Promise<boolean>}
 */
export async function confirmDestructive(whatWillHappen) {
  print(chalk.red.bold('\nThis is a destructive command and cannot be undone.'));
  print(chalk.red(whatWillHappen));
  const typed = await input({ message: 'Type "confirm" to proceed, anything else cancels:' });
  return typed.trim().toLowerCase() === 'confirm';
}

/**
 * The full delete-the-repo flow: warning, typed-confirm gate, then the
 * actual recursive delete. Used by both the standalone `delete`/`remove`
 * commands and `uninstall`'s optional follow-up.
 * @returns {Promise<void>}
 */
export async function runDeleteRepoFlow() {
  if (!looksSafeToDelete()) {
    print(chalk.red('\nRefusing to delete: this does not look like a genuine fire-tv-toolkit checkout. Nothing was deleted.\n'));
    markFailed();
    return;
  }

  const root = projectRoot();
  const parent = repoParentDir();
  const confirmed = await confirmDestructive(`This will permanently delete this entire repository from your machine:\n  ${root}`);
  if (!confirmed) {
    print(chalk.gray('\nCancelled. Nothing was deleted.\n'));
    return;
  }

  const unlinked = await unlinkCommands();
  if (!unlinked.ok) {
    print(chalk.yellow(`Could not unlink the commands first (${unlinked.error}). Run "npm uninstall -g fire-tv-toolkit" after this to clear them from your PATH.`));
  }

  fs.rmSync(root, { recursive: true, force: true });

  print(chalk.green('\nDeleted.\n'));
  print(chalk.yellow('Your shell is still sitting in the directory that was just deleted (a script cannot change your shell\'s directory for you). Run this yourself:\n'));
  print(`  ${chalk.green('cd ' + parent)}\n`);
}
