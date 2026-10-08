// Runs the dependency check against the package folder named in argv, with
// the real process.exit and child process runner.
import { ensureDependencies } from '../../src/setup-deps.js';

await ensureDependencies(process.argv[2]);
