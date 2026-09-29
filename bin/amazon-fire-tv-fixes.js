#!/usr/bin/env node
import { parseFlags, exitOnFlagError } from '../src/cli-args.js';
import { runMainMenu } from '../src/steps/main-menu.js';

try {
  parseFlags({}, process.argv.slice(2));
} catch (err) {
  exitOnFlagError(err, 'amazon-fire-tv-fixes');
}

runMainMenu();
