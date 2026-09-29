#!/usr/bin/env node
import { renderBanner } from '../src/banner.js';
import { parseFlags, exitOnFlagError } from '../src/cli-args.js';
import { requireInstalled } from '../src/device-config.js';
import { installAdbStep, FLAG_SPEC } from '../src/steps/install-adb.js';

async function main() {
  let flags;
  try {
    flags = parseFlags(FLAG_SPEC, process.argv.slice(2));
  } catch (err) {
    exitOnFlagError(err, 'firetv-install-adb --yes');
  }

  renderBanner();
  requireInstalled();

  await installAdbStep(flags);
}

main();
