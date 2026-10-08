// Runs the delete flow against the throwaway checkout named in argv. Refuses
// anything outside the system temp folder.
import { setProjectRootForTesting, runDeleteRepoFlow, PROJECT_ROOT } from '../../src/app-teardown.js';
import { isUnderTmp } from './setup-fakes.js';

const dir = process.argv[2];
if (!dir || !isUnderTmp(dir) || dir === PROJECT_ROOT) {
  process.stderr.write('setup-delete-runner: refusing a folder outside the temp folder\n');
  process.exit(2);
}
setProjectRootForTesting(dir);
await runDeleteRepoFlow();
