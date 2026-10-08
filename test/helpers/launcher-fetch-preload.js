// Preloaded into a child process (through NODE_OPTIONS) so the launcher's
// downloads are served by the stub instead of the network.
import { launcherFetch } from './launcher-fakes.js';

globalThis.fetch = launcherFetch();
