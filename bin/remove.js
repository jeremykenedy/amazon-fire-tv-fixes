#!/usr/bin/env node
import { parseFlags, exitOnFlagError } from '../src/cli-args.js';
import { renderBanner } from '../src/banner.js';
import { runDeleteRepoFlow } from '../src/app-teardown.js';

try {
  parseFlags({}, process.argv.slice(2));
} catch (err) {
  exitOnFlagError(err, 'remove');
}

renderBanner();
runDeleteRepoFlow();
