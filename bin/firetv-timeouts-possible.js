#!/usr/bin/env node
import { renderBanner } from '../src/banner.js';
import { parseFlags, exitOnFlagError } from '../src/cli-args.js';
import { ensureConnected } from '../src/adb.js';
import { requireInstalled } from '../src/device-config.js';
import { possibleTimeoutsReport } from '../src/steps/timeout-possible.js';

try {
  parseFlags({}, process.argv.slice(2));
} catch (err) {
  exitOnFlagError(err, 'firetv-timeouts-possible');
}

renderBanner();
requireInstalled();
const ip = await ensureConnected();
await possibleTimeoutsReport(ip);
