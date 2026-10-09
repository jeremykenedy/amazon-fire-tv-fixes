# Screensavers

| Id | Name | Package | Source | What it is |
|----|------|---------|--------|------------|
| `aerial` | Aerial Views (the default) | `com.neilturner.aerialviews` | [jeremykenedy/AerialViews](https://github.com/jeremykenedy/AerialViews) | Aerial drone footage, the Apple TV screensaver look |
| `androsaver` | AndroSaver | `com.androsaver` | [jeremykenedy/androsaver](https://github.com/jeremykenedy/androsaver) | Photo slideshow or music visualizer |
| `snoozy` | Snoozy | `com.overdevs.snoozy` | [jeremykenedy/Snoozy](https://github.com/jeremykenedy/Snoozy) | Animated Snoopy screensaver |
| `aquarium-live` | Aquarium Live | `com.jeremykenedy.aquariumlive` | [jeremykenedy/aquarium-live](https://github.com/jeremykenedy/aquarium-live) | A living aquarium drawn in real time: four scenes, six looks, day and night |
| `aquarium-4k` | Aquarium 4K | `com.jeremykenedy.firetv.aquarium` | [jeremykenedy/fire-tv-aquarium](https://github.com/jeremykenedy/fire-tv-aquarium) | Offline 4K aquarium footage with custom fish, sea life and backgrounds |
| `jellyfish-drift` | Jellyfish Drift | `com.jeremykenedy.jellyfishdrift` | [jeremykenedy/jellyfish-drift](https://github.com/jeremykenedy/jellyfish-drift) | Animated jellyfish with adjustable water, density, motion, species and light rays |
| `firefly-grove` | Firefly Grove | `com.jeremykenedy.fireflygrove` | [jeremykenedy/firefly-grove](https://github.com/jeremykenedy/firefly-grove) | Animated fireflies in a grove with adjustable density, motion and color |
| `neon-corridor` | Neon Corridor | `com.jeremykenedy.neoncorridor` | [jeremykenedy/neon-corridor](https://github.com/jeremykenedy/neon-corridor) | A procedural neon tunnel with adjustable density, speed, color, brightness and geometry |
| `starfield-drift` | Starfield Drift | `com.jeremykenedy.starfielddrift` | [jeremykenedy/starfield-drift](https://github.com/jeremykenedy/starfield-drift) | A procedural starfield with adjustable density, speed, color, luminance and meteors |
| `rain-on-glass` | Rain on Glass | `com.jeremykenedy.rainonglass` | [jeremykenedy/rain-on-glass](https://github.com/jeremykenedy/rain-on-glass) | Animated rainfall with adjustable lighting, density, speed and glass focus |
| `rainforest-cascade` | Rainforest Cascade | `com.jeremykenedy.rainforestcascade` | [jeremykenedy/rainforest-cascade](https://github.com/jeremykenedy/rainforest-cascade) | An animated waterfall with adjustable surroundings, day or night, width, flow, mist and sunlight shimmer |
| `blue-meridian` | Blue Meridian | `com.jeremykenedy.bluemeridian` | [jeremykenedy/blue-meridian](https://github.com/jeremykenedy/blue-meridian) | A rotating Earth with moving camera, atmosphere, night lights, clouds and adjustable stars |
| `twilight-hearth` | Twilight Hearth | `com.jeremykenedy.twilighthearth` | [jeremykenedy/twilight-hearth](https://github.com/jeremykenedy/twilight-hearth) | An animated fireplace with adjustable surrounds, flame intensity, embers, motion and room lighting |
| `nebula-drift` | Nebula Drift | `com.jeremykenedy.nebuladrift` | [jeremykenedy/nebula-drift](https://github.com/jeremykenedy/nebula-drift) | Animated nebula clouds with adjustable structure, color, density, stars and meteors |
| `vortex-spiral` | Vortex Spiral | `com.jeremykenedy.vortexspiral` | [jeremykenedy/vortex-spiral](https://github.com/jeremykenedy/vortex-spiral) | Animated spiral ribbons with adjustable arms, winding, color, brightness and motion |
| `signal-rain` | Signal Rain | `com.jeremykenedy.signalrain` | [jeremykenedy/signal-rain](https://github.com/jeremykenedy/signal-rain) | Luminous abstract digital rain with adjustable streams, colors and motion |
| `retro-flight` | Retro Flight | `com.jeremykenedy.retroflight` | [jeremykenedy/retro-flight](https://github.com/jeremykenedy/retro-flight) | Continuous perspective flight through an original procedural star field |
| `pipeworks-dream` | Pipeworks Dream | `com.jeremykenedy.pipeworksdream` | [jeremykenedy/pipeworks-dream](https://github.com/jeremykenedy/pipeworks-dream) | Continuously growing geometric pipes with adjustable density, speed, palette and glow |
| `aqua-surface` | Aqua Surface Drift | `com.jeremykenedy.aquasurfacedrift` | [jeremykenedy/aqua-surface-drift](https://github.com/jeremykenedy/aqua-surface-drift) | Animated water with adjustable environment, lighting, ripples, motion and view |

The first three are forks of third-party projects (see Credits in the
README). Aquarium Live, Aquarium 4K, Jellyfish Drift, Firefly Grove, Neon Corridor, Starfield Drift, Rain on Glass, Rainforest Cascade, Blue Meridian, Twilight Hearth, Nebula Drift, Vortex Spiral, Signal Rain, Retro Flight, Pipeworks Dream and Aqua Surface Drift are original projects.

Aerial Views is the default: on a TV with none of these installed it starts
checked in `firetv-screensavers`, and `screensaver --yes` picks it whenever it
is installed.

## Built in

These come with the TV. There is nothing to install; they can only be made
active with `screensaver --set=<id>` or the Screensavers tile on the TV.

| Id | Name | Component | What it is |
|----|------|-----------|------------|
| `colors` | Colors | `com.android.dreams.basic/.Colors` | Android's built-in slow color wash |
| `amazon` | Amazon with Ads | `com.amazon.ftv.screensaver/.app.services.ScreensaverService` | Amazon's own screensaver, which shows ads |

## How each one was vetted

Before a screensaver is added, its latest release APK is checked: the
permissions it asks for, its network traffic and any hard-coded endpoints, and
that it has no ads, analytics or trackers.

## How downloads are checked

Every APK is downloaded from the latest GitHub release of its repository and
checked against a SHA-256 published with that release, before anything is
installed. The checksum is read from, in order:

1. a `SHA-256 (<file>.apk): <hash>` or `SHA-256: <hash>` line in the release notes, or
2. a `<file>.apk.sha256` file attached to the same release.

If neither is there, or the hash does not match, nothing is installed. The
download URL must be the repository's own release path on github.com, and
redirects may only go to GitHub's release asset hosts. Each download goes to
its own private temporary folder that is deleted afterwards.

## Notes

- Installing again updates in place with `adb install -r`, keeping each
  screensaver's own settings.
- Fire OS Settings only lists Amazon's screensaver. Use `screensaver` on your
  computer, or the Screensavers tile on the TV (see [Home screen](LAUNCHER.md)).
