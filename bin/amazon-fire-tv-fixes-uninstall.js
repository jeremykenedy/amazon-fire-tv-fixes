#!/usr/bin/env node
import { renderBanner } from '../src/banner.js';
import { parseFlags, FlagError } from '../src/cli-args.js';
import { ensureConnected } from '../src/adb.js';
import { uninstallEverything, FLAG_SPEC } from '../src/steps/uninstall.js';

async function main() {
  renderBanner();

  let flags;
  try {
    flags = parseFlags(FLAG_SPEC, process.argv.slice(2));
  } catch (err) {
    if (!(err instanceof FlagError)) throw err;
    console.error(err.message);
    console.error('Example: amazon-fire-tv-fixes-uninstall --all --force');
    process.exit(1);
  }

  const ip = await ensureConnected();
  await uninstallEverything(ip, flags);
}

main();
