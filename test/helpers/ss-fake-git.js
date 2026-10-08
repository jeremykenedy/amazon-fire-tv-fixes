import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Stands in for `git clone --depth 1 <url> <dest>`: logs the call and makes
// the destination folder, or fails like a missing repo when "fail" exists
// next to it. Never touches the network.
const SCRIPT = `#!/bin/sh
here="$(dirname "$0")"
echo "$@" >> "$here/calls"
if [ -f "$here/fail" ]; then
  echo "fatal: repository '$4' not found" >&2
  exit 128
fi
mkdir -p "$5"
`;

/**
 * Puts a fake git first on this process's PATH.
 * @returns {{calls: () => string[], failing: (on: boolean) => void, restore: () => void}}
 */
export function installFakeGit() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'firetv-git-'));
  fs.writeFileSync(path.join(dir, 'git'), SCRIPT, { mode: 0o755 });
  const savedPath = process.env.PATH;
  process.env.PATH = `${dir}${path.delimiter}${savedPath}`;
  const log = path.join(dir, 'calls');
  const flag = path.join(dir, 'fail');
  return {
    calls: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : []),
    failing(on) {
      if (on) fs.writeFileSync(flag, '');
      else fs.rmSync(flag, { force: true });
    },
    restore() {
      process.env.PATH = savedPath;
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
