#!/usr/bin/env node
import { renderBanner } from '../src/banner.js';
import { parseFlags, exitOnFlagError } from '../src/cli-args.js';
import { ensureConnected } from '../src/adb.js';
import { requireInstalled } from '../src/device-config.js';
import { enableAlexaFix, ENABLE_FLAG_SPEC } from '../src/steps/alexa-fix.js';

async function main() {
  let flags;
  try {
    flags = parseFlags(ENABLE_FLAG_SPEC, process.argv.slice(2));
  } catch (err) {
    exitOnFlagError(err, 'enable-alexa-fix --yes');
  }

  renderBanner();
  requireInstalled();

  const ip = await ensureConnected();
  await enableAlexaFix(ip, flags);
}

main();
