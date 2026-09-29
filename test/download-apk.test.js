import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { downloadApk, removeDownload, assertTrustedApkUrl, assertTrustedRedirect } from '../src/apply/screensavers.js';

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
