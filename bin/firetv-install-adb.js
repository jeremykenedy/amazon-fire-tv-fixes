#!/usr/bin/env node
import { renderBanner } from '../src/banner.js';
import { parseFlags, FlagError } from '../src/cli-args.js';
import { installAdbStep, FLAG_SPEC } from '../src/steps/install-adb.js';

async function main() {
  renderBanner();

  let flags;
  try {
    flags = parseFlags(FLAG_SPEC, process.argv.slice(2));
  } catch (err) {
    if (!(err instanceof FlagError)) throw err;
    console.error(err.message);
    console.error('Example: firetv-install-adb --yes');
    process.exit(1);
  }

  await installAdbStep(flags);
}

main();
