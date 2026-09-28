// The vetted screensaver forks. Each one was reviewed this way before being
// added here: pulled its latest GitHub release APK, checked its requested
// Android permissions, checked its actual network traffic and any hardcoded
// endpoints in its code, and confirmed no ads, analytics, or trackers.
// `repo` points at a fork under github.com/jeremykenedy, not the original
// author's repo. See the Credits section in the README for the originals.

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
];

export const AMAZON_DEFAULT = {
  id: 'amazon',
  name: 'Amazon (factory default)',
  pkg: 'com.amazon.ftv.screensaver',
  dreamComponent: 'com.amazon.ftv.screensaver/.app.services.ScreensaverService',
};
