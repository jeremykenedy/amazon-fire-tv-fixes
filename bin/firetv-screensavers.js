#!/usr/bin/env node
import { renderBanner } from '../src/banner.js';
import { parseFlags, FlagError } from '../src/cli-args.js';
import { ensureConnected } from '../src/adb.js';
import { manageScreensavers, FLAG_SPEC } from '../src/steps/screensavers.js';

async function main() {
  renderBanner();

  let flags;
  try {
    flags = parseFlags(FLAG_SPEC, process.argv.slice(2));
  } catch (err) {
    if (!(err instanceof FlagError)) throw err;
    console.error(err.message);
    console.error('Example: firetv-screensavers --install=aerial,snoozy --uninstall=androsaver --force');
    process.exit(1);
  }

  const ip = await ensureConnected();
  await manageScreensavers(ip, flags);
}

main();
