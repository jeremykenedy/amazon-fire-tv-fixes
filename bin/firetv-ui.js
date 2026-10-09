#!/usr/bin/env node
import { renderBanner } from '../src/banner.js';
import { parseFlags, exitOnFlagError } from '../src/cli-args.js';
import { requireInstalled } from '../src/device-config.js';
import { ensureConnected } from '../src/adb.js';
import { manageFireTvUi, FLAG_SPEC } from '../src/steps/fire-tv-ui.js';

let flags;
try {
  flags = parseFlags(FLAG_SPEC, process.argv.slice(2));
} catch (error) {
  exitOnFlagError(error, 'firetv-ui --install --setup=simple --home=fire-tv-ui');
}
renderBanner();
requireInstalled();
await manageFireTvUi(await ensureConnected(), flags);
