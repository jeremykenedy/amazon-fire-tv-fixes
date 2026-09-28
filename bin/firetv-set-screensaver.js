#!/usr/bin/env node
import { renderBanner } from '../src/banner.js';
import { parseFlags, FlagError } from '../src/cli-args.js';
import { ensureConnected } from '../src/adb.js';
import { setScreensaver, FLAG_SPEC } from '../src/steps/set-screensaver.js';

async function main() {
  renderBanner();

  let flags;
  try {
    flags = parseFlags(FLAG_SPEC, process.argv.slice(2));
  } catch (err) {
    if (!(err instanceof FlagError)) throw err;
    console.error(err.message);
    console.error('Example: firetv-set-screensaver --set=aerial --yes');
    process.exit(1);
  }

  const ip = await ensureConnected();
  await setScreensaver(ip, flags);
}

main();
