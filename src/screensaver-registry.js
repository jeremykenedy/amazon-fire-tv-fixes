// The vetted screensavers. Each one was reviewed this way before being added
// here: pulled its latest GitHub release APK, checked its requested Android
// permissions, checked its actual network traffic and any hardcoded endpoints
// in its code, and confirmed no ads, analytics, or trackers. `repo` is always
// under github.com/jeremykenedy: a fork for the third-party ones (see the
// Credits section in the README for the originals), or one of Jeremy's own.

export const SCREENSAVERS = [
  {
    id: 'aerial',
    name: 'Aerial Views',
    pkg: 'com.neilturner.aerialviews',
    dreamComponent: 'com.neilturner.aerialviews/.ui.screensaver.DreamActivity',
    repo: 'jeremykenedy/AerialViews',
    blurb: 'Aerial drone footage, the Apple TV screensaver look. No ads.',
  },
  {
    id: 'androsaver',
    name: 'AndroSaver',
    pkg: 'com.androsaver',
    dreamComponent: 'com.androsaver/.ScreensaverService',
    repo: 'jeremykenedy/androsaver',
    blurb: 'Photo slideshow or music visualizer. No ads.',
  },
  {
    id: 'snoozy',
    name: 'Snoozy',
    pkg: 'com.overdevs.snoozy',
    dreamComponent: 'com.overdevs.snoozy/.SnoozyDreamService',
    repo: 'jeremykenedy/Snoozy',
    blurb: 'Animated Snoopy screensaver. No ads, no analytics, confirmed by its own author.',
  },
  {
    id: 'aquarium-live',
    name: 'Aquarium Live',
    pkg: 'com.jeremykenedy.aquariumlive',
    dreamComponent: 'com.jeremykenedy.aquariumlive/.AquariumDream',
    repo: 'jeremykenedy/aquarium-live',
    blurb: 'A living aquarium drawn in real time. Four scenes, six looks, day and night. No ads.',
  },
  {
    id: 'aquarium-4k',
    name: 'Aquarium 4K',
    pkg: 'com.jeremykenedy.firetv.aquarium',
    dreamComponent: 'com.jeremykenedy.firetv.aquarium/.AquariumDreamService',
    repo: 'jeremykenedy/fire-tv-aquarium',
    blurb: 'Offline 4K aquarium footage with custom fish, sea life and backgrounds. No ads.',
  },
  {
    id: 'jellyfish-drift',
    name: 'Jellyfish Drift',
    pkg: 'com.jeremykenedy.jellyfishdrift',
    dreamComponent: 'com.jeremykenedy.jellyfishdrift/.JellyfishDreamService',
    repo: 'jeremykenedy/jellyfish-drift',
    blurb: 'Animated jellyfish with adjustable water, density, motion, species and light rays. No ads, analytics or tracking.',
  },
  {
    id: 'firefly-grove',
    name: 'Firefly Grove',
    pkg: 'com.jeremykenedy.fireflygrove',
    dreamComponent: 'com.jeremykenedy.fireflygrove/.FireflyDreamService',
    repo: 'jeremykenedy/firefly-grove',
    blurb: 'Animated fireflies in a quiet grove with adjustable density, motion and color. No ads, analytics or tracking.',
  },
  {
    id: 'neon-corridor',
    name: 'Neon Corridor',
    pkg: 'com.jeremykenedy.neoncorridor',
    dreamComponent: 'com.jeremykenedy.neoncorridor/.NeonDreamService',
    repo: 'jeremykenedy/neon-corridor',
    blurb: 'A procedural neon tunnel with adjustable density, speed, color, brightness and geometry. No ads, analytics or tracking.',
  },
];

/**
 * Pure: whether two "package/class" components name the same screensaver.
 * Apps write either the short form ("pkg/.Cls") or the full one
 * ("pkg/pkg.Cls"), so both are expanded before comparing.
 * @param {string | null} a
 * @param {string | null} b
 * @returns {boolean}
 */
export function sameComponent(a, b) {
  const full = (c) => (c || '').replace(/^([^/]+)\/\./, '$1/$1.');
  return full(a) === full(b);
}

/** Aerial Views is what the installer suggests and what --yes picks. */
export const DEFAULT_SCREENSAVER_ID = 'aerial';

// Screensavers that ship with the TV. Nothing to install or vet; they can
// only be made active.
export const BUILT_IN_SCREENSAVERS = [
  {
    id: 'colors',
    name: 'Colors',
    pkg: 'com.android.dreams.basic',
    dreamComponent: 'com.android.dreams.basic/.Colors',
    blurb: "Android's built-in slow color wash. Comes with the TV.",
  },
];

export const AMAZON_DEFAULT = {
  id: 'amazon',
  name: 'Amazon with Ads',
  pkg: 'com.amazon.ftv.screensaver',
  dreamComponent: 'com.amazon.ftv.screensaver/.app.services.ScreensaverService',
};
