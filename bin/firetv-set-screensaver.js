#!/usr/bin/env node
import { renderBanner } from '../src/banner.js';
import { parseFlags, exitOnFlagError } from '../src/cli-args.js';
import { ensureConnected } from '../src/adb.js';
import { requireInstalled } from '../src/device-config.js';
import { setScreensaver, FLAG_SPEC } from '../src/steps/set-screensaver.js';

async function main() {
  let flags;
  try {
    flags = parseFlags(FLAG_SPEC, process.argv.slice(2));
  } catch (err) {
    exitOnFlagError(err, 'firetv-set-screensaver --set=aerial --yes');
  }

  renderBanner();
  requireInstalled();

  const ip = await ensureConnected();
  await setScreensaver(ip, flags);
}

main();
