import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { COMMANDS } from '../src/command-list.js';

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));

test('COMMANDS lists every command in package.json "bin", and nothing else', () => {
  const pkgNames = Object.keys(pkg.bin).sort();
  const listedNames = COMMANDS.map((c) => c.name).sort();
  assert.deepEqual(listedNames, pkgNames);
});

test('every COMMANDS entry has a non-empty name and description', () => {
  for (const { name, desc } of COMMANDS) {
    assert.ok(name && name.trim().length > 0);
    assert.ok(desc && desc.trim().length > 0);
  }
});

test('the banner art fits the terminal: full size, then a smaller font, then plain text', async () => {
  const { bannerArt, TAGLINE } = await import('../src/banner.js');
  const widest = (art) => Math.max(...art.split('\n').map((line) => line.length));
  const full = bannerArt(undefined);
  assert.ok(widest(full) <= 200 && full.includes('\n'));
  assert.ok(widest(bannerArt(80)) <= 80);
  for (const columns of [75, 60]) {
    const art = bannerArt(columns);
    assert.ok(widest(art) <= columns && art.includes('\n'), `${columns} columns`);
  }
  assert.equal(bannerArt(10), 'FIRE TV TOOLKIT');
  assert.match(TAGLINE, /Alexa deep-sleep fix/);
});
