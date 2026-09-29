#!/usr/bin/env node
import { renderBanner } from '../src/banner.js';
import { parseFlags, exitOnFlagError } from '../src/cli-args.js';
import { ensureConnected } from '../src/adb.js';
import { requireInstalled } from '../src/device-config.js';
import { manageAllTimeoutsStep } from '../src/steps/timeout-manage.js';

async function main() {
  try {
    parseFlags({}, process.argv.slice(2));
  } catch (err) {
    exitOnFlagError(err, 'firetv-timeouts');
  }

  renderBanner();
  requireInstalled();
  const ip = await ensureConnected();
  await manageAllTimeoutsStep(ip);
}

main();
