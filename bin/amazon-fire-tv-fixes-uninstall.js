#!/usr/bin/env node
import { renderBanner } from '../src/banner.js';
import { parseFlags, exitOnFlagError } from '../src/cli-args.js';
import { ensureConnected } from '../src/adb.js';
import { requireInstalled } from '../src/device-config.js';
import { uninstallEverything, FLAG_SPEC } from '../src/steps/uninstall.js';

let flags;
try {
  flags = parseFlags(FLAG_SPEC, process.argv.slice(2));
} catch (err) {
  exitOnFlagError(err, 'amazon-fire-tv-fixes-uninstall --all --force');
}

renderBanner();
requireInstalled();

const ip = await ensureConnected();
await uninstallEverything(ip, flags);
