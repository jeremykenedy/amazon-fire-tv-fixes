// Preloaded through NODE_OPTIONS by the delete and remove command tests. It
// points the delete flow at a throwaway checkout, so even a mistaken answer
// could never reach this repository.
import { setProjectRootForTesting } from '../../src/app-teardown.js';
import { isUnderTmp } from './setup-fakes.js';

const dir = process.env.FIRE_TV_TEST_PROJECT_ROOT;
if (!dir || !isUnderTmp(dir)) {
  process.stderr.write('setup-root-preload: FIRE_TV_TEST_PROJECT_ROOT must be a temp folder\n');
  process.exit(2);
}
setProjectRootForTesting(dir);
