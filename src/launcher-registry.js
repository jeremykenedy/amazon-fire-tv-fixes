import fs from 'node:fs';

// The optional AT4K home screen. Fire OS has no setting for choosing a Home
// app, so two accessibility services work together: AT4K's own, and the Home
// Redirect app built from android/home-redirect in this repo, which reopens
// AT4K whenever the Amazon menu comes to the front. Home Redirect also carries
// the on-TV screensaver picker.

const { version } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

/** AT4K comes from its author's own release, never a copy, checked against this pinned hash. */
export const AT4K = {
  id: 'at4k',
  name: 'AT4K Launcher',
  pkg: 'com.overdevs.at4k',
  service: 'com.overdevs.at4k/com.overdevs.at4k.Hra',
  repo: 'avadhesh18/at4k',
  tag: 'v1.2',
  asset: 'app-release.apk',
  sha256: 'ac34c0abf1ceee5d5133dc3e99bde9173a00c5a16132852507ed23c0fbd41341',
};

/**
 * The newest release with a Home Redirect APK attached. Move it to the new
 * tag whenever a release attaches a newer build.
 */
const HOME_REDIRECT_RELEASE = 'v3.2.2';

/** Built from android/home-redirect and attached to HOME_REDIRECT_RELEASE. */
export const HOME_REDIRECT = {
  id: 'home-redirect',
  name: 'Home Redirect and Screensaver Picker',
  pkg: 'com.jeremykenedy.firetv.homeredirect',
  service: 'com.jeremykenedy.firetv.homeredirect/com.jeremykenedy.firetv.homeredirect.HomeRedirectService',
  repo: 'jeremykenedy/fire-tv-toolkit',
  tag: HOME_REDIRECT_RELEASE,
  asset: 'firetv-home-redirect.apk',
  grants: ['android.permission.WRITE_SECURE_SETTINGS'],
};

export const LAUNCHER_APPS = [AT4K, HOME_REDIRECT];

export const FIRE_TV_UI = {
  id: 'fire-tv-ui',
  name: 'Fire TV UI',
  pkg: 'com.jeremykenedy.firetv.ui',
  service: 'com.jeremykenedy.firetv.ui/com.jeremykenedy.firetv.ui.HomeRedirectService',
  controls: 'com.jeremykenedy.firetv.ui/com.jeremykenedy.firetv.ui.Hra',
  repo: 'jeremykenedy/fire-tv-toolkit',
  tag: `v${version}`,
  asset: 'fire-tv-ui-1.0.0.apk',
  grants: ['android.permission.WRITE_SECURE_SETTINGS'],
};
