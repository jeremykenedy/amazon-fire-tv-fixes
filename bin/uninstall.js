#!/usr/bin/env node
import { parseFlags, exitOnFlagError } from '../src/cli-args.js';
import { renderBanner } from '../src/banner.js';
import { runUninstallCommand } from '../src/steps/app-uninstall.js';

try {
  parseFlags({}, process.argv.slice(2));
} catch (err) {
  exitOnFlagError(err, 'uninstall');
}

renderBanner();
runUninstallCommand();
