#!/usr/bin/env node
import { renderBanner } from '../src/banner.js';
import { parseFlags, FlagError } from '../src/cli-args.js';
import { ensureConnected } from '../src/adb.js';
import { enableAlexaFix, ENABLE_FLAG_SPEC } from '../src/steps/alexa-fix.js';

async function main() {
  renderBanner();

  let flags;
  try {
    flags = parseFlags(ENABLE_FLAG_SPEC, process.argv.slice(2));
  } catch (err) {
    if (!(err instanceof FlagError)) throw err;
    console.error(err.message);
    console.error('Example: enable-alexa-fix --yes');
    process.exit(1);
  }

  const ip = await ensureConnected();
  await enableAlexaFix(ip, flags);
}

main();
