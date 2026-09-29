#!/usr/bin/env node
import { renderBanner } from '../src/banner.js';
import { parseFlags, exitOnFlagError } from '../src/cli-args.js';
import { ensureConnected } from '../src/adb.js';
import { requireInstalled } from '../src/device-config.js';
import { resetTimeoutsStep, RESET_FLAG_SPEC } from '../src/steps/timeout-reset.js';

async function main() {
  let flags;
  try {
    flags = parseFlags(RESET_FLAG_SPEC, process.argv.slice(2));
  } catch (err) {
    exitOnFlagError(err, 'firetv-timeouts-reset --all');
  }

  renderBanner();
  requireInstalled();

  const ip = await ensureConnected();
  await resetTimeoutsStep(ip, flags);
}

main();
