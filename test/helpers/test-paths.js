// Preloaded into child processes with `node --import` by the subprocess
// tests. It is the only place the throwaway paths come from the environment,
// and it only ever runs under the test suite.
import { setEnvPathForTesting } from '../../src/device-config.js';
import { setScreensaversDirForTesting } from '../../src/apply/screensavers.js';

setEnvPathForTesting(process.env.FIRE_TV_TEST_ENV_FILE || null);
setScreensaversDirForTesting(process.env.FIRE_TV_TEST_SCREENSAVERS_DIR || null);
