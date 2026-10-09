import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { installFakeAdb } from './helpers/fake-adb.js';
import { drive, DOWN, ENTER } from './helpers/drive.js';
import { fakeBinDir } from './helpers/setup-fakes.js';

let fake;

before(() => {
  fake = installFakeAdb();
});
beforeEach(() => fake.reset());
after(() => fake.restore());

const START = { expect: 'Start setting up Fire TV Toolkit?', send: 'y' };
const LIST = /Install\/Link firetv commands/;
const CONTINUE = { expect: 'Nothing has been changed yet. Continue?', send: ENTER };

// Only node, the fake adb and a fake npm are on PATH; no real npm can run.
function withNpm(codes) {
  return { PATH: `${path.dirname(process.env.FAKE_ADB_STATE)}${path.delimiter}${fakeBinDir({ npm: codes })}` };
}

test('setup links the commands and points to start when the TV is not set up yet', async () => {
  const r = await drive('setup.js', [], [START, { expect: LIST, send: `${DOWN} ${ENTER}` }, CONTINUE], { env: withNpm({ install: 0, link: 0 }) });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Dependencies installed/);
  assert.match(r.out, /Commands linked/);
  assert.match(r.out, /Next, run start/);
});

test('setup lists every command once the TV is already set up', async () => {
  fs.writeFileSync(fake.envFile, 'FIRE_TV_IP=192.168.1.49\nINSTALLED=true\n');
  const r = await drive('setup.js', [], [START, { expect: LIST, send: `${DOWN} ${ENTER}` }, CONTINUE], { env: withNpm({ install: 0, link: 0 }) });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Tip: run info/);
  assert.match(r.out, /firetv-launcher/);
});

test('setup reports a failed npm install and a failed npm link', async () => {
  const install = await drive('setup.js', [], [START, { expect: LIST, send: `${DOWN} ${ENTER}` }, CONTINUE], { env: withNpm({ install: 1 }) });
  assert.equal(install.code, 1, install.out);
  assert.match(install.out, /npm install failed/);
  assert.doesNotMatch(install.out, /Commands linked/);

  const link = await drive('setup.js', [], [START, { expect: LIST, send: `${DOWN} ${ENTER}` }, CONTINUE], { env: withNpm({ install: 0, link: 1 }) });
  assert.equal(link.code, 1, link.out);
  assert.match(link.out, /npm link failed/);
});

test('setup still launches the app after a failed install, and says so', async () => {
  const r = await drive(
    'setup.js',
    [],
    [
      START,
      { expect: LIST, send: ENTER },
      CONTINUE,
      { expect: 'Developer Mode and ADB debugging?', send: 'y' },
      { expect: 'IP address', send: `192.168.1.49${ENTER}` },
      { expect: 'review or adjust TV timeout', send: 'n' },
      { expect: 'optimize the TV for screensavers', send: 'n' },
      { expect: 'guard these settings', send: 'n' },
      { expect: 'What would you like to do?', send: `${DOWN.repeat(6)}${ENTER}` },
    ],
    { env: withNpm({ install: 1 }) }
  );
  assert.match(r.out, /Continuing to launch the app even though install\/link had a problem/);
  assert.match(r.out, /Bye!/);
});
