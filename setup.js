#!/usr/bin/env node
// This file must only import Node built-ins, directly or through the modules
// it imports. On a fresh clone nothing is installed yet, and this is the
// script that installs it, so importing any dependency here would crash
// before it could (see test/packaging.test.js).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDependencies } from './src/setup-deps.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

await ensureDependencies(ROOT);
const { runSetup } = await import('./src/setup-flow.js');
await runSetup();
