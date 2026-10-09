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
    id: 'cloud-drift-clock',
    name: 'Cloud Drift Clock',
    pkg: 'com.jeremykenedy.clouddriftclock',
    dreamComponent: 'com.jeremykenedy.clouddriftclock/.CloudDreamService',
    repo: 'jeremykenedy/cloud-drift-clock',
    blurb: 'A moving cloudscape with an adjustable digital clock, sky palette, density, speed and motion. No ads, analytics or tracking.',
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
  {
    id: 'starfield-drift',
    name: 'Starfield Drift',
    pkg: 'com.jeremykenedy.starfielddrift',
    dreamComponent: 'com.jeremykenedy.starfielddrift/.StarfieldDreamService',
    repo: 'jeremykenedy/starfield-drift',
    blurb: 'A procedural animated starfield with adjustable density, speed, color, luminance and meteors. No ads, analytics or tracking.',
  },
  {
    id: 'rain-on-glass',
    name: 'Rain on Glass',
    pkg: 'com.jeremykenedy.rainonglass',
    dreamComponent: 'com.jeremykenedy.rainonglass/.RainDreamService',
    repo: 'jeremykenedy/rain-on-glass',
    blurb: 'Animated rainfall on soft or crisp glass with adjustable lighting, density, speed and distant lights. No ads, analytics or tracking.',
  },
  {
    id: 'rainforest-cascade',
    name: 'Rainforest Cascade',
    pkg: 'com.jeremykenedy.rainforestcascade',
    dreamComponent: 'com.jeremykenedy.rainforestcascade/.WaterfallDreamService',
    repo: 'jeremykenedy/rainforest-cascade',
    blurb: 'An animated waterfall with adjustable surroundings, day or night, width, flow, mist and sunlight shimmer. No ads, analytics or tracking.',
  },
  {
    id: 'blue-meridian',
    name: 'Blue Meridian',
    pkg: 'com.jeremykenedy.bluemeridian',
    dreamComponent: 'com.jeremykenedy.bluemeridian/.BlueMeridianDreamService',
    repo: 'jeremykenedy/blue-meridian',
    blurb: 'A rotating Earth with moving camera, atmosphere, night lights, clouds and adjustable stars. No ads, analytics or tracking.',
  },
  {
    id: 'twilight-hearth',
    name: 'Twilight Hearth',
    pkg: 'com.jeremykenedy.twilighthearth',
    dreamComponent: 'com.jeremykenedy.twilighthearth/.HearthDreamService',
    repo: 'jeremykenedy/twilight-hearth',
    blurb: 'An animated fireplace with adjustable surrounds, flame intensity, embers, motion and room lighting. No ads, analytics or tracking.',
  },
  {
    id: 'nebula-drift',
    name: 'Nebula Drift',
    pkg: 'com.jeremykenedy.nebuladrift',
    dreamComponent: 'com.jeremykenedy.nebuladrift/.NebulaDreamService',
    repo: 'jeremykenedy/nebula-drift',
    blurb: 'Animated nebula clouds with adjustable structure, color, density, stars and meteors.',
  },
  {
    id: 'vortex-spiral',
    name: 'Vortex Spiral',
    pkg: 'com.jeremykenedy.vortexspiral',
    dreamComponent: 'com.jeremykenedy.vortexspiral/.VortexDreamService',
    repo: 'jeremykenedy/vortex-spiral',
    blurb: 'Animated spiral ribbons with adjustable arms, winding, color, brightness and motion.',
  },
  {
    id: 'signal-rain',
    name: 'Signal Rain',
    pkg: 'com.jeremykenedy.signalrain',
    dreamComponent: 'com.jeremykenedy.signalrain/.SignalRainDreamService',
    repo: 'jeremykenedy/signal-rain',
    blurb: 'Luminous abstract digital rain with adjustable streams, colors and motion.',
  },
  {
    id: 'retro-flight',
    name: 'Retro Flight',
    pkg: 'com.jeremykenedy.retroflight',
    dreamComponent: 'com.jeremykenedy.retroflight/.RetroFlightDreamService',
    repo: 'jeremykenedy/retro-flight',
    blurb: 'Continuous perspective flight through an original procedural star field.',
  },
  {
    id: 'pipeworks-dream',
    name: 'Pipeworks Dream',
    pkg: 'com.jeremykenedy.pipeworksdream',
    dreamComponent: 'com.jeremykenedy.pipeworksdream/.PipeworksDreamService',
    repo: 'jeremykenedy/pipeworks-dream',
    blurb: 'Continuously growing geometric pipes with adjustable density, speed, palette and glow.',
  },
  {
    id: 'aqua-surface',
    name: 'Aqua Surface Drift',
    pkg: 'com.jeremykenedy.aquasurfacedrift',
    dreamComponent: 'com.jeremykenedy.aquasurfacedrift/.AquaSurfaceDreamService',
    repo: 'jeremykenedy/aqua-surface-drift',
    blurb: 'Animated water with adjustable environment, lighting, ripples, motion and view.',
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
