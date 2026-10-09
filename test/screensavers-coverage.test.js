import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { installFakeAdb, captured, AERIAL } from './helpers/fake-adb.js';
import { installFakeGit } from './helpers/ss-fake-git.js';
import { drive, DOWN, ENTER, SPACE } from './helpers/drive.js';
import * as sv from '../src/apply/screensavers.js';
import { manageScreensavers } from '../src/steps/screensavers.js';
import { setScreensaver } from '../src/steps/set-screensaver.js';
import { SCREENSAVERS, BUILT_IN_SCREENSAVERS, AMAZON_DEFAULT } from '../src/screensaver-registry.js';

const IP = '10.0.0.5';
const ANDRO = SCREENSAVERS.find((s) => s.id === 'androsaver');
const SNOOZY = SCREENSAVERS.find((s) => s.id === 'snoozy');
const ANDROSAVER = SCREENSAVERS.find((s) => s.id === 'androsaver');
const COLORS = BUILT_IN_SCREENSAVERS.find((s) => s.id === 'colors');
const AERIAL_ENTRY = SCREENSAVERS.find((s) => s.id === 'aerial');
const JELLYFISH_DRIFT = SCREENSAVERS.find((s) => s.id === 'jellyfish-drift');
const FIREFLY_GROVE = SCREENSAVERS.find((s) => s.id === 'firefly-grove');
const NEON_CORRIDOR = SCREENSAVERS.find((s) => s.id === 'neon-corridor');
const STARFIELD_DRIFT = SCREENSAVERS.find((s) => s.id === 'starfield-drift');
const RAIN_ON_GLASS = SCREENSAVERS.find((s) => s.id === 'rain-on-glass');
const RAINFOREST_CASCADE = SCREENSAVERS.find((s) => s.id === 'rainforest-cascade');
const BLUE_MERIDIAN = SCREENSAVERS.find((s) => s.id === 'blue-meridian');
const TWILIGHT_HEARTH = SCREENSAVERS.find((s) => s.id === 'twilight-hearth');
const NEBULA_DRIFT = SCREENSAVERS.find((s) => s.id === 'nebula-drift');
const VORTEX_SPIRAL = SCREENSAVERS.find((s) => s.id === 'vortex-spiral');
const SIGNAL_RAIN = SCREENSAVERS.find((s) => s.id === 'signal-rain');
const RETRO_FLIGHT = SCREENSAVERS.find((s) => s.id === 'retro-flight');
const PIPEWORKS_DREAM = SCREENSAVERS.find((s) => s.id === 'pipeworks-dream');
const AQUA_SURFACE = SCREENSAVERS.find((s) => s.id === 'aqua-surface');
const CLOUD_DRIFT_CLOCK = SCREENSAVERS.find((s) => s.id === 'cloud-drift-clock');
const apkBytes = (pkg) => Buffer.from(`pkg:${pkg}`);
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

let fake;
let git;

before(() => {
  fake = installFakeAdb();
  git = installFakeGit();
});

beforeEach(() => {
  fake.reset();
  git.failing(false);
  process.exitCode = undefined;
});

after(() => {
  git.restore();
  fake.restore();
  process.exitCode = undefined;
});

/**
 * A GitHub stand-in for one repo: the releases API plus the download URLs it
 * hands out. Anything else it is asked for is a test bug.
 */
function releaseFetch(options) {
  const { repo, bytes, notes, apiStatus = 200, apkStatus = 200, sumStatus = 200, assets, redirectNoLocation = false, seen = [] } = options;
  const apkUrl = `https://github.com/${repo}/releases/download/v1/app.apk`;
  const list = assets === undefined ? [{ name: 'app.apk', browser_download_url: apkUrl }] : assets;
  return async (url) => {
    const u = String(url);
    seen.push(u);
    if (u.startsWith(`https://api.github.com/repos/${repo}/releases/`)) {
      if (apiStatus !== 200) return new Response('nope', { status: apiStatus });
      return Response.json({ tag_name: 'v1', body: notes ?? `SHA-256: ${sha(bytes)}`, ...(list === null ? {} : { assets: list }) });
    }
    if (u.endsWith('.sha256')) return new Response(sha(bytes), { status: sumStatus });
    if (u === apkUrl) {
      if (redirectNoLocation) return new Response(null, { status: 302 });
      return new Response(bytes, { status: apkStatus });
    }
    throw new Error(`unexpected fetch ${u}`);
  };
}

async function withFetch(fn, body) {
  const real = globalThis.fetch;
  globalThis.fetch = fn;
  try {
    return await body();
  } finally {
    globalThis.fetch = real;
  }
}

const pkgFetch = (entry, extra = {}) => releaseFetch({ repo: entry.repo, bytes: apkBytes(entry.pkg), ...extra });

test('parseSha256FromNotes with an asset name reads only that file\'s line', () => {
  const a = 'a'.repeat(64);
  const b = 'B'.repeat(64);
  const notes = `SHA-256 (one.apk): ${a}\nSHA-256 (two.apk): ${b}`;
  assert.equal(sv.parseSha256FromNotes(notes, 'two.apk'), b.toLowerCase());
  assert.equal(sv.parseSha256FromNotes(notes, 'three.apk'), null);
  assert.equal(sv.parseSha256FromNotes(notes), null);
});

test('Jellyfish Drift registry entry points to its released app and installer repository', () => {
  assert.deepEqual(JELLYFISH_DRIFT, {
    id: 'jellyfish-drift',
    name: 'Jellyfish Drift',
    pkg: 'com.jeremykenedy.jellyfishdrift',
    dreamComponent: 'com.jeremykenedy.jellyfishdrift/.JellyfishDreamService',
    repo: 'jeremykenedy/jellyfish-drift',
    blurb: 'Animated jellyfish with adjustable water, density, motion, species and light rays. No ads, analytics or tracking.',
  });
});

test('Firefly Grove registry entry points to its released app and installer repository', () => {
  assert.deepEqual(FIREFLY_GROVE, {
    id: 'firefly-grove',
    name: 'Firefly Grove',
    pkg: 'com.jeremykenedy.fireflygrove',
    dreamComponent: 'com.jeremykenedy.fireflygrove/.FireflyDreamService',
    repo: 'jeremykenedy/firefly-grove',
    blurb: 'Animated fireflies in a quiet grove with adjustable density, motion and color. No ads, analytics or tracking.',
  });
});

test('Neon Corridor registry entry points to its released app and installer repository', () => {
  assert.deepEqual(NEON_CORRIDOR, {
    id: 'neon-corridor',
    name: 'Neon Corridor',
    pkg: 'com.jeremykenedy.neoncorridor',
    dreamComponent: 'com.jeremykenedy.neoncorridor/.NeonDreamService',
    repo: 'jeremykenedy/neon-corridor',
    blurb: 'A procedural neon tunnel with adjustable density, speed, color, brightness and geometry. No ads, analytics or tracking.',
  });
});

test('Starfield Drift registry entry points to its released app and installer repository', () => {
  assert.deepEqual(STARFIELD_DRIFT, {
    id: 'starfield-drift',
    name: 'Starfield Drift',
    pkg: 'com.jeremykenedy.starfielddrift',
    dreamComponent: 'com.jeremykenedy.starfielddrift/.StarfieldDreamService',
    repo: 'jeremykenedy/starfield-drift',
    blurb: 'A procedural animated starfield with adjustable density, speed, color, luminance and meteors. No ads, analytics or tracking.',
  });
});

test('Rain on Glass registry entry points to its released app and installer repository', () => {
  assert.deepEqual(RAIN_ON_GLASS, {
    id: 'rain-on-glass',
    name: 'Rain on Glass',
    pkg: 'com.jeremykenedy.rainonglass',
    dreamComponent: 'com.jeremykenedy.rainonglass/.RainDreamService',
    repo: 'jeremykenedy/rain-on-glass',
    blurb: 'Animated rainfall on soft or crisp glass with adjustable lighting, density, speed and distant lights. No ads, analytics or tracking.',
  });
});

test('Rainforest Cascade registry entry points to its released app and installer repository', () => {
  assert.deepEqual(RAINFOREST_CASCADE, {
    id: 'rainforest-cascade',
    name: 'Rainforest Cascade',
    pkg: 'com.jeremykenedy.rainforestcascade',
    dreamComponent: 'com.jeremykenedy.rainforestcascade/.WaterfallDreamService',
    repo: 'jeremykenedy/rainforest-cascade',
    blurb: 'An animated waterfall with adjustable surroundings, day or night, width, flow, mist and sunlight shimmer. No ads, analytics or tracking.',
  });
});

test('Blue Meridian registry entry points to its released app and installer repository', () => {
  assert.deepEqual(BLUE_MERIDIAN, {
    id: 'blue-meridian',
    name: 'Blue Meridian',
    pkg: 'com.jeremykenedy.bluemeridian',
    dreamComponent: 'com.jeremykenedy.bluemeridian/.BlueMeridianDreamService',
    repo: 'jeremykenedy/blue-meridian',
    blurb: 'A rotating Earth with moving camera, atmosphere, night lights, clouds and adjustable stars. No ads, analytics or tracking.',
  });
});

test('Twilight Hearth registry entry points to its released app and installer repository', () => {
  assert.deepEqual(TWILIGHT_HEARTH, {
    id: 'twilight-hearth',
    name: 'Twilight Hearth',
    pkg: 'com.jeremykenedy.twilighthearth',
    dreamComponent: 'com.jeremykenedy.twilighthearth/.HearthDreamService',
    repo: 'jeremykenedy/twilight-hearth',
    blurb: 'An animated fireplace with adjustable surrounds, flame intensity, embers, motion and room lighting. No ads, analytics or tracking.',
  });
});

test('Nebula Drift registry entry points to its released app and installer repository', () => {
  assert.deepEqual(NEBULA_DRIFT, {
    id: 'nebula-drift',
    name: 'Nebula Drift',
    pkg: 'com.jeremykenedy.nebuladrift',
    dreamComponent: 'com.jeremykenedy.nebuladrift/.NebulaDreamService',
    repo: 'jeremykenedy/nebula-drift',
    blurb: 'Animated nebula clouds with adjustable structure, color, density, stars and meteors.',
  });
});

test('Vortex Spiral registry entry points to its released app and installer repository', () => {
  assert.deepEqual(VORTEX_SPIRAL, {
    id: 'vortex-spiral',
    name: 'Vortex Spiral',
    pkg: 'com.jeremykenedy.vortexspiral',
    dreamComponent: 'com.jeremykenedy.vortexspiral/.VortexDreamService',
    repo: 'jeremykenedy/vortex-spiral',
    blurb: 'Animated spiral ribbons with adjustable arms, winding, color, brightness and motion.',
  });
});

test('Signal Rain registry entry points to its released app and installer repository', () => {
  assert.deepEqual(SIGNAL_RAIN, {
    id: 'signal-rain',
    name: 'Signal Rain',
    pkg: 'com.jeremykenedy.signalrain',
    dreamComponent: 'com.jeremykenedy.signalrain/.SignalRainDreamService',
    repo: 'jeremykenedy/signal-rain',
    blurb: 'Luminous abstract digital rain with adjustable streams, colors and motion.',
  });
});

test('Retro Flight registry entry points to its released app and installer repository', () => {
  assert.deepEqual(RETRO_FLIGHT, {
    id: 'retro-flight',
    name: 'Retro Flight',
    pkg: 'com.jeremykenedy.retroflight',
    dreamComponent: 'com.jeremykenedy.retroflight/.RetroFlightDreamService',
    repo: 'jeremykenedy/retro-flight',
    blurb: 'Continuous perspective flight through an original procedural star field.',
  });
});

test('Pipeworks Dream registry entry points to its released app and installer repository', () => {
  assert.deepEqual(PIPEWORKS_DREAM, {
    id: 'pipeworks-dream',
    name: 'Pipeworks Dream',
    pkg: 'com.jeremykenedy.pipeworksdream',
    dreamComponent: 'com.jeremykenedy.pipeworksdream/.PipeworksDreamService',
    repo: 'jeremykenedy/pipeworks-dream',
    blurb: 'Continuously growing geometric pipes with adjustable density, speed, palette and glow.',
  });
});

test('Aqua Surface Drift registry entry points to its released app and installer repository', () => {
  assert.deepEqual(AQUA_SURFACE, {
    id: 'aqua-surface',
    name: 'Aqua Surface Drift',
    pkg: 'com.jeremykenedy.aquasurfacedrift',
    dreamComponent: 'com.jeremykenedy.aquasurfacedrift/.AquaSurfaceDreamService',
    repo: 'jeremykenedy/aqua-surface-drift',
    blurb: 'Animated water with adjustable environment, lighting, ripples, motion and view.',
  });
});

test('Cloud Drift Clock registry entry points to its released app and installer repository', () => {
  assert.deepEqual(CLOUD_DRIFT_CLOCK, {
    id: 'cloud-drift-clock',
    name: 'Cloud Drift Clock',
    pkg: 'com.jeremykenedy.clouddriftclock',
    dreamComponent: 'com.jeremykenedy.clouddriftclock/.CloudDreamService',
    repo: 'jeremykenedy/cloud-drift-clock',
    blurb: 'A moving cloudscape with an adjustable digital clock, sky palette, density, speed and motion. No ads, analytics or tracking.',
  });
});

test('latestRelease asks for a pinned tag by name when one is given', async () => {
  const seen = [];
  const r = await withFetch(pkgFetch(ANDRO, { seen }), () => sv.latestRelease(ANDRO.repo, undefined, 'v 1/x'));
  assert.equal(seen[0], `https://api.github.com/repos/${ANDRO.repo}/releases/tags/v%201%2Fx`);
  assert.equal(r.tag, 'v1');
  assert.equal(r.sha256Url, null);
});

test('latestRelease explains a repo with no release, and any other API failure', async () => {
  await assert.rejects(withFetch(pkgFetch(ANDRO, { apiStatus: 404 }), () => sv.latestRelease(ANDRO.repo)), /no published release/);
  await assert.rejects(withFetch(pkgFetch(ANDRO, { apiStatus: 503 }), () => sv.latestRelease(ANDRO.repo)), /GitHub API returned 503/);
});

test('latestRelease refuses a release with no matching APK asset', async () => {
  await assert.rejects(withFetch(pkgFetch(ANDRO, { assets: null }), () => sv.latestRelease(ANDRO.repo)), /No \.apk asset found/);
  await assert.rejects(withFetch(pkgFetch(ANDRO), () => sv.latestRelease(ANDRO.repo, 'other.apk')), /No other\.apk asset found/);
  const named = await withFetch(pkgFetch(ANDRO), () => sv.latestRelease(ANDRO.repo, 'app.apk'));
  assert.match(named.apkUrl, /app\.apk$/);
});

test('latestReleaseApkUrl returns just the APK download URL', async () => {
  const url = await withFetch(pkgFetch(ANDRO), () => sv.latestReleaseApkUrl(ANDRO.repo));
  assert.equal(url, `https://github.com/${ANDRO.repo}/releases/download/v1/app.apk`);
});

test('downloadApk refuses a redirect that names no destination', async () => {
  await assert.rejects(withFetch(pkgFetch(ANDRO, { redirectNoLocation: true }), () => sv.downloadApk(ANDRO)), /redirected without a destination/);
});

test('downloadApk stops when the APK or its checksum file fails to download', async () => {
  await assert.rejects(withFetch(pkgFetch(ANDRO, { apkStatus: 500 }), () => sv.downloadApk(ANDRO)), /Download failed with status 500/);
  const withSumFile = [
    { name: 'app.apk', browser_download_url: `https://github.com/${ANDRO.repo}/releases/download/v1/app.apk` },
    { name: 'app.apk.sha256', browser_download_url: `https://github.com/${ANDRO.repo}/releases/download/v1/app.apk.sha256` },
  ];
  await assert.rejects(
    withFetch(pkgFetch(ANDRO, { notes: 'none', assets: withSumFile, sumStatus: 404 }), () => sv.downloadApk(ANDRO)),
    /checksum file failed with status 404/
  );
});

test('downloadApk trusts a checksum pinned in the registry over the release', async () => {
  const bytes = apkBytes(ANDRO.pkg);
  const p = await withFetch(pkgFetch(ANDRO, { notes: 'none' }), () => sv.downloadApk({ ...ANDRO, sha256: sha(bytes) }));
  assert.deepEqual(fs.readFileSync(p), bytes);
  sv.removeDownload(p);
});

test('cloneIfMissing clones once into the test folder, then leaves it alone', async () => {
  assert.equal(await sv.cloneIfMissing(ANDRO), true);
  assert.ok(fs.existsSync(path.join(sv.getScreensaversDir(), ANDRO.id)));
  assert.match(git.calls().at(-1), new RegExp(`clone --depth 1 https://github.com/${ANDRO.repo}.git `));
  const before = git.calls().length;
  assert.equal(await sv.cloneIfMissing(ANDRO), false);
  assert.equal(git.calls().length, before);
});

test('installScreensaver clones, downloads, installs, and cleans up the download', async () => {
  const steps = [];
  await withFetch(pkgFetch(ANDRO), () => sv.installScreensaver(IP, ANDRO, { onProgress: (m) => steps.push(m) }));
  assert.deepEqual(steps, ['cloning source', 'fetching latest release', 'installing on the TV']);
  const s = fake.readState();
  assert.ok(s.installed.includes(ANDRO.pkg));
  assert.equal(fs.existsSync(path.dirname(s.lastInstallPath)), false);
});

test('installScreensaver still installs when the source clone fails, and works without a progress callback', async () => {
  git.failing(true);
  const steps = [];
  await withFetch(pkgFetch(ANDRO), () => sv.installScreensaver(IP, ANDRO, { onProgress: (m) => steps.push(m) }));
  assert.match(steps[1], /^source clone skipped \(fatal: repository .* not found\)$/);
  assert.ok(fake.readState().installed.includes(ANDRO.pkg));
  fake.reset();
  await withFetch(pkgFetch(ANDRO), () => sv.installScreensaver(IP, ANDRO));
  assert.ok(fake.readState().installed.includes(ANDRO.pkg));
});

test('installScreensaver removes the download even when the TV rejects the install', async () => {
  fake.setState({ installFail: 'Failure [INSTALL_FAILED_INSUFFICIENT_STORAGE]' });
  await assert.rejects(withFetch(pkgFetch(ANDRO), () => sv.installScreensaver(IP, ANDRO)), /INSTALL_FAILED_INSUFFICIENT_STORAGE/);
  const s = fake.readState();
  assert.ok(!s.installed.includes(ANDRO.pkg));
  assert.equal(fs.existsSync(path.dirname(s.lastInstallPath)), false);
});

test('firetv-screensavers --install installs a screensaver and reports it', async () => {
  const { out } = await captured(() => withFetch(pkgFetch(ANDRO), () => manageScreensavers(IP, { install: 'androsaver' })));
  assert.match(out, /AndroSaver installed/);
  assert.ok(fake.readState().installed.includes(ANDRO.pkg));
  assert.notEqual(process.exitCode, 1);
});

test('Twilight Hearth can be installed and selected through the CLI', async () => {
  const installed = await captured(() => withFetch(
    pkgFetch(TWILIGHT_HEARTH),
    () => manageScreensavers(IP, { install: 'twilight-hearth' })
  ));
  assert.match(installed.out, /Twilight Hearth installed/);
  assert.ok(fake.readState().installed.includes(TWILIGHT_HEARTH.pkg));

  const selected = await captured(() => setScreensaver(IP, { set: 'twilight-hearth' }));
  assert.match(selected.out, /Active screensaver is now Twilight Hearth/);
  assert.equal(fake.readState().secure.screensaver_components, TWILIGHT_HEARTH.dreamComponent);
});

for (const saver of [NEBULA_DRIFT, VORTEX_SPIRAL, SIGNAL_RAIN, RETRO_FLIGHT, PIPEWORKS_DREAM, CLOUD_DRIFT_CLOCK]) {
  test(`${saver.name} can be installed and selected through the CLI`, async () => {
    const installed = await captured(() => withFetch(
      pkgFetch(saver),
      () => manageScreensavers(IP, { install: saver.id })
    ));
    assert.match(installed.out, new RegExp(`${saver.name} installed`));
    assert.ok(fake.readState().installed.includes(saver.pkg));

    const selected = await captured(() => setScreensaver(IP, { set: saver.id }));
    assert.match(selected.out, new RegExp(`Active screensaver is now ${saver.name}`));
    assert.equal(fake.readState().secure.screensaver_components, saver.dreamComponent);
  });
}

test('firetv-screensavers --install reports a failed install and marks the run failed', async () => {
  const { out } = await captured(() => withFetch(pkgFetch(SNOOZY, { apiStatus: 404 }), () => manageScreensavers(IP, { install: 'snoozy' })));
  assert.match(out, /Snoozy: .*no published release/);
  assert.equal(process.exitCode, 1);
  assert.ok(!fake.readState().installed.includes(SNOOZY.pkg));
});

test('firetv-screensavers --yes with no ids has nothing to do', async () => {
  const { out } = await captured(() => manageScreensavers(IP, { yes: true }));
  assert.match(out, /Nothing to do/);
  assert.notEqual(process.exitCode, 1);
});

test('firetv-screensavers --uninstall without --force refuses and removes nothing', async () => {
  const { out } = await captured(() => manageScreensavers(IP, { uninstall: 'aerial' }));
  assert.match(out, /Refusing to continue without --force/);
  assert.equal(process.exitCode, 1);
  assert.deepEqual(fake.readState().installed, [AERIAL]);
});

test('set-screensaver --set on the screensaver already active changes nothing', async () => {
  fake.setState({ secure: { ...fake.readState().secure, screensaver_components: AMAZON_DEFAULT.dreamComponent } });
  const { out } = await captured(() => setScreensaver(IP, { set: 'amazon' }));
  assert.match(out, /already the active screensaver/);
  assert.notEqual(process.exitCode, 1);
});

test('set-screensaver --yes refuses to guess with no forks, or several forks and no Aerial Views', async () => {
  fake.setState({ installed: [] });
  const none = await captured(() => setScreensaver(IP, { yes: true }));
  assert.match(none.out, /No screensaver forks are installed/);
  assert.equal(process.exitCode, 1);
  process.exitCode = undefined;
  fake.setState({ installed: [ANDROSAVER.pkg, SNOOZY.pkg] });
  const many = await captured(() => setScreensaver(IP, { yes: true }));
  assert.match(many.out, /More than one screensaver is installed/);
  assert.equal(process.exitCode, 1);
});

test('set-screensaver --yes picks the one installed fork, or says it is already active', async () => {
  const set = await captured(() => setScreensaver(IP, { yes: true }));
  assert.match(set.out, /Active screensaver is now Aerial Views/);
  assert.equal(fake.readState().secure.screensaver_components, AERIAL_ENTRY.dreamComponent);
  const again = await captured(() => setScreensaver(IP, { yes: true }));
  assert.match(again.out, /Aerial Views is already the active screensaver/);
  assert.notEqual(process.exitCode, 1);
});

function installedEnv() {
  fs.writeFileSync(fake.envFile, `FIRE_TV_IP=${IP}\nINSTALLED=true\n`);
}

test('screensaver --set=amazon switches the active screensaver end to end', async () => {
  installedEnv();
  const r = await drive('bin/screensaver.js', ['--set=amazon'], []);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Active screensaver is now Amazon/);
  assert.equal(fake.readState().secure.screensaver_components, AMAZON_DEFAULT.dreamComponent);
});

test('the built-in Colors screensaver is offered when the TV has it, and --set=colors makes it active', async () => {
  installedEnv();
  fake.setState({ installed: [AERIAL, COLORS.pkg] });
  const r = await drive('bin/firetv-set-screensaver.js', [], [{ expect: 'Set the active screensaver to:', send: `${DOWN}${ENTER}` }, { expect: 'Nothing has been changed yet. Continue?', send: ENTER }]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Colors[\s\S]*Amazon with Ads/);
  assert.equal(fake.readState().secure.screensaver_components, COLORS.dreamComponent);

  fake.setState({ installed: [AERIAL] });
  const missing = await captured(() => setScreensaver(IP, { set: 'colors' }));
  assert.match(missing.out, /Colors is not installed/);
  assert.equal(process.exitCode, 1);
});

test('on a TV with no screensavers yet, Aerial Views starts checked as the default', async () => {
  installedEnv();
  fake.setState({ installed: [] });
  const r = await drive('bin/firetv-screensavers.js', [], [
    { expect: 'Which screensavers do you want installed?', send: ENTER },
    { expect: 'Nothing has been changed yet. Continue?', send: `${DOWN}${DOWN}${ENTER}` },
  ]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Install Aerial Views/, r.out);
  assert.deepEqual(fake.readState().installed, []);
  assert.doesNotMatch(r.out, /Install Snoozy/);
});

test('choosing the current screensaver in the picker skips the summary and changes nothing', async () => {
  installedEnv();
  fake.setState({ secure: { ...fake.readState().secure, screensaver_components: AMAZON_DEFAULT.dreamComponent } });
  const r = await drive('bin/firetv-set-screensaver.js', [], [{ expect: 'Set the active screensaver to:', send: `${DOWN}${ENTER}` }]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Amazon with Ads \(current\)/);
  assert.match(r.out, /already the active screensaver/);
  assert.doesNotMatch(r.out, /This is exactly what will happen/);
});

test('unchecking a screensaver and not typing yes cancels the removal', async () => {
  installedEnv();
  const r = await drive('bin/firetv-screensavers.js', [], [
    { expect: 'Which screensavers do you want installed?', send: `${SPACE}${ENTER}` },
    { expect: 'Nothing has been changed yet. Continue?', send: ENTER },
    { expect: 'Type "yes"', send: `no${ENTER}` },
  ]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Cancelled\. Nothing was changed/);
  assert.deepEqual(fake.readState().installed, [AERIAL]);
});
