import crypto from 'node:crypto';
import { FIRE_TV_UI, HOME_REDIRECT } from '../../src/launcher-registry.js';
import { launcherFetch } from './launcher-fakes.js';

export function fireTvUiFetch() {
  const apps = [FIRE_TV_UI, HOME_REDIRECT];
  const checksum = (app) => crypto.createHash('sha256').update(`pkg:${app.pkg}`).digest('hex');
  return async (url) => {
    const value = String(url);
    const releaseApp = apps.find((app) => value === `https://api.github.com/repos/${app.repo}/releases/tags/${app.tag}`);
    if (releaseApp) {
      return Response.json({ tag_name: releaseApp.tag,
        body: apps.map((app) => `SHA-256 (${app.asset}): ${checksum(app)}`).join('\n'),
        assets: apps.map((app) => ({ name: app.asset,
          url: `https://api.github.com/repos/${app.repo}/releases/assets/${apps.indexOf(app) + 1}`,
          browser_download_url: `https://github.com/${app.repo}/releases/download/${app.tag}/${app.asset}` })) });
    }
    const app = apps.find((entry, index) => value === `https://github.com/${entry.repo}/releases/download/${entry.tag}/${entry.asset}`
      || value === `https://api.github.com/repos/${entry.repo}/releases/assets/${index + 1}`);
    if (app) return new Response(`pkg:${app.pkg}`);
    return launcherFetch()(url);
  };
}

globalThis.fetch = fireTvUiFetch();
