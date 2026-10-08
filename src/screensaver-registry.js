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
];

export const AMAZON_DEFAULT = {
  id: 'amazon',
  name: 'Amazon (factory default)',
  pkg: 'com.amazon.ftv.screensaver',
  dreamComponent: 'com.amazon.ftv.screensaver/.app.services.ScreensaverService',
};
