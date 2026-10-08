# Screensavers

| Id | Name | Package | Source | What it is |
|----|------|---------|--------|------------|
| `aerial` | Aerial Views | `com.neilturner.aerialviews` | [jeremykenedy/AerialViews](https://github.com/jeremykenedy/AerialViews) | Aerial drone footage, the Apple TV screensaver look |
| `androsaver` | AndroSaver | `com.androsaver` | [jeremykenedy/androsaver](https://github.com/jeremykenedy/androsaver) | Photo slideshow or music visualizer |
| `snoozy` | Snoozy | `com.overdevs.snoozy` | [jeremykenedy/Snoozy](https://github.com/jeremykenedy/Snoozy) | Animated Snoopy screensaver |
| `aquarium-live` | Aquarium Live | `com.jeremykenedy.aquariumlive` | [jeremykenedy/aquarium-live](https://github.com/jeremykenedy/aquarium-live) | A living aquarium drawn in real time: four scenes, six looks, day and night |
| `aquarium-4k` | Aquarium 4K | `com.jeremykenedy.firetv.aquarium` | [jeremykenedy/fire-tv-aquarium](https://github.com/jeremykenedy/fire-tv-aquarium) | Offline 4K aquarium footage with custom fish, sea life and backgrounds |

The first three are forks of third-party projects (see Credits in the
README). Aquarium Live and Aquarium 4K are original projects.

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

- Aerial Views plays its video on a hardware layer that screenshots cannot
  capture, so its screenshot shows its on-TV menu instead.
- Installing again updates in place with `adb install -r`, keeping each
  screensaver's own settings.
- Fire OS Settings only lists Amazon's screensaver. Use `screensaver` on your
  computer, or the Screensavers tile on the TV (see [Home screen](LAUNCHER.md)).
