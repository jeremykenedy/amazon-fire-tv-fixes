import crypto from 'node:crypto';
import { FIRE_TV_UI, HOME_REDIRECT } from '../../src/launcher-registry.js';
import { launcherFetch } from './launcher-fakes.js';

export function fireTvUiFetch() {
  const apps = [FIRE_TV_UI, HOME_REDIRECT];
  const checksum = (app) => crypto.createHash('sha256').update(`pkg:${app.pkg}`).digest('hex');
  return async (url) => {
    const value = String(url);
    const api = `https://api.github.com/repos/${FIRE_TV_UI.repo}/releases/tags/${FIRE_TV_UI.tag}`;
    if (value === api) {
      return Response.json({ tag_name: FIRE_TV_UI.tag,
        body: apps.map((app) => `SHA-256 (${app.asset}): ${checksum(app)}`).join('\n'),
        assets: apps.map((app) => ({ name: app.asset,
          browser_download_url: `https://github.com/${app.repo}/releases/download/${app.tag}/${app.asset}` })) });
    }
    const app = apps.find((entry) => value === `https://github.com/${entry.repo}/releases/download/${entry.tag}/${entry.asset}`);
    if (app) return new Response(`pkg:${app.pkg}`);
    return launcherFetch()(url);
  };
}

globalThis.fetch = fireTvUiFetch();
