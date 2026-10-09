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

The first three are forks of third-party projects (see Credits in the
README). Aquarium Live, Aquarium 4K, Jellyfish Drift, Firefly Grove, Neon Corridor and Starfield Drift are original projects.

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
