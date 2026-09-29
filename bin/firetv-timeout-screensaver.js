#!/usr/bin/env node
import { renderBanner } from '../src/banner.js';
import { parseFlags, exitOnFlagError } from '../src/cli-args.js';
import { ensureConnected } from '../src/adb.js';
import { requireInstalled } from '../src/device-config.js';
import { setOneTimeoutStep, FLAG_SPEC } from '../src/steps/timeout-set.js';
import { findTimeoutById } from '../src/apply/timeouts.js';

let flags;
try {
  flags = parseFlags(FLAG_SPEC, process.argv.slice(2));
} catch (err) {
  exitOnFlagError(err, 'firetv-timeout-screensaver --minutes=10');
}

renderBanner();
requireInstalled();

const ip = await ensureConnected();
await setOneTimeoutStep(ip, findTimeoutById('screensaver'), flags);
