// Preloaded into a child process (through NODE_OPTIONS) so the delete-the-repo
// flow points at a throwaway checkout, never this repository.
const teardown = await import('../../src/app-teardown.js');

if (process.env.FIRE_TV_TEST_PROJECT_ROOT) {
  teardown.setProjectRootForTesting?.(process.env.FIRE_TV_TEST_PROJECT_ROOT);
}
