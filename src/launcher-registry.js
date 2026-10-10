// The optional AT4K and LTvLauncher home screens. Fire OS has no setting for
// choosing a Home app, so the Home Redirect app built from
// android/home-redirect in this repo reopens the chosen launcher whenever the
// Amazon menu comes to the front. With AT4K, AT4K's own accessibility service
// runs beside it. Home Redirect also carries the on-TV screensaver picker.

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
 * LTvLauncher publishes no checksum, so this release's universal APK is pinned
 * by tag and hash. It runs on 32 and 64-bit Fire TVs and has no internet
 * permission.
 */
export const LTV = {
  id: 'ltv',
  name: 'LTvLauncher',
  pkg: 'com.leanbitlab.ltvL',
  repo: 'leanbitlab-org/LtvLauncher',
  tag: 'v2026.10.03',
  asset: 'LTvLauncher-universal-release.apk',
  sha256: '9ec0dd7941642ed68ace39d013890e360dfa77c0eeb1ab9589097626be99f459',
};

/**
 * The newest release with a Home Redirect APK attached. Move it to the new
 * tag whenever a release attaches a newer build.
 */
const HOME_REDIRECT_RELEASE = 'v3.9.1';

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

/** The launchers Home Redirect can open, each installed together with it. */
export const HOME_LAUNCHERS = [AT4K, LTV];

/** Home Redirect version that can open a launcher other than AT4K. */
export const HOME_TARGET_VERSION = '1.2.5';

/**
 * @param {string} id a launcher id from HOME_LAUNCHERS
 * @returns {Array<typeof AT4K | typeof HOME_REDIRECT>} the apps that launcher needs
 */
export function launcherApps(id) {
  return [HOME_LAUNCHERS.find((app) => app.id === id), HOME_REDIRECT];
}

export const FIRE_TV_UI = {
  id: 'fire-tv-ui',
  name: 'Fire TV UI',
  pkg: 'com.jeremykenedy.firetv.ui',
  service: 'com.jeremykenedy.firetv.ui/com.jeremykenedy.firetv.ui.HomeRedirectService',
  controls: 'com.jeremykenedy.firetv.ui/com.jeremykenedy.firetv.ui.Hra',
  repo: 'jeremykenedy/fire-tv-ui',
  tag: 'v1.0.1',
  private: true,
  asset: 'fire-tv-ui-1.0.1.apk',
  grants: ['android.permission.WRITE_SECURE_SETTINGS'],
};
