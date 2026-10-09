import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { downloadApk, removeDownload, assertTrustedApkUrl, assertTrustedRedirect, parseSha256File } from '../src/apply/screensavers.js';

const entry = { id: 'testsaver', name: 'Test Saver', repo: 'owner/repo' };
const bytes = Buffer.from('pretend this is an apk');
const goodSum = crypto.createHash('sha256').update(bytes).digest('hex');

function stubFetch(notes, apkBytes = bytes, apkUrl = 'https://github.com/owner/repo/releases/download/v1/app.apk') {
  return async (url) => {
    if (String(url).includes('/releases/latest')) {
      return Response.json({
        tag_name: 'v1',
        body: notes,
        assets: [{ name: 'app.apk', browser_download_url: apkUrl }],
      });
    }
    return new Response(apkBytes, { status: 200 });
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

test('downloadApk accepts a download whose SHA-256 matches the release notes', async () => {
  const p = await withFetch(stubFetch(`SHA-256: ${goodSum}`), () => downloadApk(entry));
  assert.deepEqual(fs.readFileSync(p), bytes);
  removeDownload(p);
});

test('downloadApk rejects a download that does not match the recorded checksum', async () => {
  await assert.rejects(
    withFetch(stubFetch(`SHA-256: ${goodSum}`, Buffer.from('tampered')), () => downloadApk(entry)),
    /Checksum mismatch/
  );
});

test('downloadApk refuses a release that records no checksum at all (fails closed)', async () => {
  await assert.rejects(withFetch(stubFetch('no checksum in these notes'), () => downloadApk(entry)), /refusing to install an unverified download/);
});

test('downloadApk refuses a release whose APK URL points somewhere other than the repo release path', async () => {
  await assert.rejects(
    withFetch(stubFetch(`SHA-256: ${goodSum}`, bytes, 'https://evil.example/app.apk'), () => downloadApk(entry)),
    /unexpected location/
  );
});

test('assertTrustedApkUrl accepts this repo\'s own GitHub release download URL, any case', () => {
  assert.doesNotThrow(() => assertTrustedApkUrl('https://github.com/owner/repo/releases/download/v1/a.apk', 'owner/repo'));
  assert.doesNotThrow(() => assertTrustedApkUrl('https://github.com/Owner/Repo/releases/download/v1/a.apk', 'owner/repo'));
});

test('assertTrustedApkUrl rejects wrong host, http, another repo, userinfo tricks, ports, and junk', () => {
  const bad = [
    'https://example.com/owner/repo/releases/download/v1/a.apk',
    'http://github.com/owner/repo/releases/download/v1/a.apk',
    'https://github.com/other/repo/releases/download/v1/a.apk',
    'https://github.com/owner/repo/archive/main.zip',
    'https://github.com@evil.example/owner/repo/releases/download/v1/a.apk',
    'https://user:pw@github.com/owner/repo/releases/download/v1/a.apk',
    'https://github.com:8443/owner/repo/releases/download/v1/a.apk',
    'https://github.com.evil.example/owner/repo/releases/download/v1/a.apk',
    'not a url',
  ];
  for (const url of bad) {
    assert.throws(() => assertTrustedApkUrl(url, 'owner/repo'), Error, `should reject ${url}`);
  }
});

function redirectingFetch(hops, finalBytes = bytes) {
  const first = 'https://github.com/owner/repo/releases/download/v1/app.apk';
  return async (url) => {
    const u = String(url);
    if (u.includes('/releases/latest')) {
      return Response.json({ tag_name: 'v1', body: `SHA-256: ${goodSum}`, assets: [{ name: 'app.apk', browser_download_url: first }] });
    }
    const idx = u === first ? 0 : hops.indexOf(u) + 1;
    if (idx < hops.length) return new Response(null, { status: 302, headers: { location: hops[idx] } });
    return new Response(finalBytes, { status: 200 });
  };
}

test('downloadApk follows a redirect to GitHub\'s release asset host and verifies the bytes', async () => {
  const p = await withFetch(redirectingFetch(['https://release-assets.githubusercontent.com/x/app.apk']), () => downloadApk(entry));
  assert.deepEqual(fs.readFileSync(p), bytes);
  removeDownload(p);
});

test('downloadApk refuses a redirect to an untrusted host and never requests it', async () => {
  const requested = [];
  const inner = redirectingFetch(['https://evil.example/app.apk']);
  await assert.rejects(
    withFetch(async (url, opts) => { requested.push(String(url)); return inner(url, opts); }, () => downloadApk(entry)),
    /unexpected location/
  );
  assert.ok(!requested.some((u) => u.startsWith('https://evil.example')));
});

test('downloadApk gives up after too many redirects', async () => {
  const hops = ['a', 'b', 'c', 'd', 'e'].map((n) => `https://release-assets.githubusercontent.com/${n}`);
  await assert.rejects(withFetch(redirectingFetch(hops), () => downloadApk(entry)), /more than 3 times/);
});

test('assertTrustedRedirect only allows https GitHub asset hosts without userinfo or ports', () => {
  assert.doesNotThrow(() => assertTrustedRedirect(new URL('https://release-assets.githubusercontent.com/a')));
  assert.doesNotThrow(() => assertTrustedRedirect(new URL('https://objects.githubusercontent.com/a')));
  for (const bad of ['http://release-assets.githubusercontent.com/a', 'https://evil.example/a', 'https://github.com/a',
    'https://release-assets.githubusercontent.com.evil.example/a', 'https://release-assets.githubusercontent.com:8443/a', 'https://u:p@objects.githubusercontent.com/a']) {
    assert.throws(() => assertTrustedRedirect(new URL(bad)), Error, `should reject ${bad}`);
  }
});

test('each download gets its own private temp directory, removed by removeDownload', async () => {
  const p1 = await withFetch(stubFetch(`SHA-256: ${goodSum}`), () => downloadApk(entry));
  const p2 = await withFetch(stubFetch(`SHA-256: ${goodSum}`), () => downloadApk(entry));
  assert.notEqual(p1, p2);
  assert.match(p1, /firetv-apk-/);
  assert.equal(fs.statSync(path.dirname(p1)).mode & 0o077, 0, 'directory must not be readable by group/others');
  removeDownload(p1);
  removeDownload(p2);
  assert.equal(fs.existsSync(path.dirname(p1)), false);
  assert.equal(fs.existsSync(path.dirname(p2)), false);
});

function stubFetchWithChecksumFile(fileText, sumUrl = 'https://github.com/owner/repo/releases/download/v1/app.apk.sha256') {
  return async (url) => {
    if (String(url).includes('/releases/latest')) {
      return Response.json({
        tag_name: 'v1',
        body: 'No checksum in these notes.',
        assets: [
          { name: 'app.apk', browser_download_url: 'https://github.com/owner/repo/releases/download/v1/app.apk' },
          { name: 'app.apk.sha256', browser_download_url: sumUrl },
        ],
      });
    }
    if (String(url).endsWith('.sha256')) {
      return new Response(fileText, { status: 200 });
    }
    return new Response(bytes, { status: 200 });
  };
}

test('downloadApk falls back to the release\'s own .sha256 file when the notes record no checksum', async () => {
  const p = await withFetch(stubFetchWithChecksumFile(`${goodSum}  app.apk\n`), () => downloadApk(entry));
  assert.deepEqual(fs.readFileSync(p), bytes);
  removeDownload(p);
});

test('downloadApk rejects a download that does not match the .sha256 file', async () => {
  await assert.rejects(
    withFetch(stubFetchWithChecksumFile(`${'0'.repeat(64)}  app.apk\n`), () => downloadApk(entry)),
    /Checksum mismatch/
  );
});

test('downloadApk refuses a .sha256 file hosted outside the repo release path', async () => {
  await assert.rejects(
    withFetch(stubFetchWithChecksumFile(goodSum, 'https://evil.example.com/app.apk.sha256'), () => downloadApk(entry)),
    /unexpected location/
  );
});

test('downloadApk fails closed when the .sha256 file has no hash in it', async () => {
  await assert.rejects(withFetch(stubFetchWithChecksumFile('not a hash'), () => downloadApk(entry)), /No valid SHA-256/);
});

test('parseSha256File reads the sha256sum format and nothing else', () => {
  assert.equal(parseSha256File(`${goodSum.toUpperCase()}  app.apk`), goodSum);
  assert.equal(parseSha256File(goodSum), goodSum);
  assert.equal(parseSha256File('app.apk ' + goodSum), null);
  assert.equal(parseSha256File(''), null);
  assert.equal(parseSha256File(null), null);
});

const privateEntry = { ...entry, private: true };
const privateApiAsset = 'https://api.github.com/repos/owner/repo/releases/assets/123';
const testToken = 'test_private_release_token';

async function withToken(token, body) {
  const previous = { GH_TOKEN: process.env.GH_TOKEN, GITHUB_TOKEN: process.env.GITHUB_TOKEN };
  delete process.env.GITHUB_TOKEN;
  if (token === undefined) delete process.env.GH_TOKEN;
  else process.env.GH_TOKEN = token;
  try { return await body(); }
  finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function privateRelease(assetUrl = privateApiAsset, notes = `SHA-256: ${goodSum}`) {
  return Response.json({ tag_name: 'v1', body: notes, assets: [
    { name: 'app.apk', url: assetUrl, browser_download_url: 'https://github.com/owner/repo/releases/download/v1/app.apk' },
    { name: 'app.apk.sha256', url: privateApiAsset + '4', browser_download_url: 'https://github.com/owner/repo/releases/download/v1/app.apk.sha256' },
  ] });
}

test('private releases authenticate metadata and the API asset but never send credentials to redirects', async () => {
  const seen = [];
  const stub = async (url, options) => {
    seen.push({ url: String(url), headers: options.headers });
    if (String(url).includes('/releases/latest')) return privateRelease();
    if (String(url) === privateApiAsset) {
      return new Response(null, { status: 302, headers: { location: 'https://release-assets.githubusercontent.com/private/app.apk' } });
    }
    return new Response(bytes);
  };
  const filename = await withToken(testToken, () => withFetch(stub, () => downloadApk(privateEntry)));
  try {
    assert.deepEqual(fs.readFileSync(filename), bytes);
    assert.equal(seen[0].headers.Authorization, `Bearer ${testToken}`);
    assert.equal(seen[1].headers.Authorization, `Bearer ${testToken}`);
    assert.equal(seen[1].headers.Accept, 'application/octet-stream');
    assert.equal(seen[2].headers.Authorization, undefined);
    assert.equal(fs.statSync(path.dirname(filename)).mode & 0o077, 0);
  } finally { removeDownload(filename); }
});

test('private releases verify an authenticated checksum file and reject changed APK bytes', async () => {
  const seen = [];
  const stub = async (url, options) => {
    seen.push(options.headers.Authorization);
    if (String(url).includes('/releases/latest')) return privateRelease(privateApiAsset, 'No checksum in notes');
    if (String(url) === privateApiAsset + '4') return new Response(`${goodSum}  app.apk\n`);
    return new Response('tampered');
  };
  await assert.rejects(withToken(testToken, () => withFetch(stub, () => downloadApk(privateEntry))), /Checksum mismatch/);
  assert.deepEqual(seen, Array(3).fill(`Bearer ${testToken}`));
});

test('private release asset URLs cannot send a token to another host, repository or endpoint', async () => {
  for (const url of ['https://evil.example/app.apk', 'https://api.github.com/repos/other/repo/releases/assets/123',
    'https://api.github.com/repos/owner/repo/releases/assets/123?extra=1',
    'https://api.github.com/repos/owner/repo/releases/assets/not-an-id']) {
    let requests = 0;
    await assert.rejects(withToken(testToken, () => withFetch(async () => {
      requests += 1;
      return privateRelease(url);
    }, () => downloadApk(privateEntry))), /unexpected release asset API location/);
    assert.equal(requests, 1, 'Only release metadata may be requested');
  }
});

test('private release access failures explain authentication without exposing the token', async () => {
  await assert.rejects(withToken(testToken, () => withFetch(async () => new Response(null, { status: 404 }),
    () => downloadApk(privateEntry))), (error) => /repository access/.test(error.message) && !error.message.includes(testToken));
  let requested = false;
  await assert.rejects(withToken('invalid\r\ntoken', () => withFetch(async () => {
    requested = true;
  }, () => downloadApk(privateEntry))), /GitHub token is invalid/);
  assert.equal(requested, false);
});

test('public APK downloads remain anonymous when GitHub credentials are present', async () => {
  const stub = stubFetch(`SHA-256: ${goodSum}`);
  const filename = await withToken(testToken, () => withFetch((url, options) => {
    assert.equal(options.headers.Authorization, undefined);
    return stub(url);
  }, () => downloadApk(entry)));
  removeDownload(filename);
});

test('private downloads can use the GitHub CLI login and give a clear error when it is unavailable', async () => {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'firetv-gh-test-'));
  const executable = path.join(dir, 'gh');
  const previousPath = process.env.PATH;
  fs.writeFileSync(executable, `#!/bin/sh\nprintf '%s\\n' '${testToken}'\n`, { mode: 0o700 });
  process.env.PATH = dir + path.delimiter + previousPath;
  try {
    const filename = await withToken(undefined, () => withFetch(async (url, options) => {
      assert.equal(options.headers.Authorization, `Bearer ${testToken}`);
      return String(url).includes('/releases/latest') ? privateRelease() : new Response(bytes);
    }, () => downloadApk(privateEntry)));
    removeDownload(filename);
    fs.writeFileSync(executable, '#!/bin/sh\nexit 1\n', { mode: 0o700 });
    await assert.rejects(withToken(undefined, () => downloadApk(privateEntry)), /Sign in with gh auth login/);
  } finally {
    process.env.PATH = previousPath;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
