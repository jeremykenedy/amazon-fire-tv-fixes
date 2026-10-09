# Changelog

## [3.3.0] - 2026-10-08

### Added in 3.3.0

- Jellyfish Drift, Firefly Grove, Neon Corridor, Starfield Drift and Rain on Glass screensavers, as optional installs in `firetv-screensavers`, with screenshots in the README.
- `firetv-ui`: guided installation, update, removal, and backup transfer for Fire TV UI. Choose the saved simple layout, keep current settings, restore the TV backup, or import a file, then review Home, screensaver, protection, and backup choices before execution.
- Fire TV UI in the main menu, launcher selection, and full revert options.
- Persistent TV Downloads backups with validated computer import/export and private computer files. Uninstall keeps the TV backup unless deletion is explicitly selected.
- Add Twilight Hearth, Nebula Drift, Vortex Spiral, and Signal Rain to the guided screensaver installer and selector.

### Fixed in 3.3.0

- Home routing is rebound after Fire TV UI updates. Opening the launcher no longer force-stops its accessibility services.
- Intentional CLI timer and screensaver changes update Fire TV UI's desired settings so its protection service does not revert them.
- Home Redirect 1.2.2 delegates shared settings to Fire TV UI and retires stale snapshots, preserving the GUI's Home and timer choices. Guard enable, disable, and screensaver unlock commands also control the native protector.

### Changed in 3.3.0

- Scrutinizer integration and badges removed.
- Existing commands, AT4K installation, saved IP, and first-observed timeout baselines remain supported. Upgrade with `git pull`, then `node setup.js` to link the new command. Fire TV UI is optional; run `firetv-ui` to install it.

## [3.2.2] - 2026-10-08

### Added in 3.2.2

- Seven new screensavers as optional installs in `firetv-screensavers`: Jellyfish Drift, Firefly Grove, Neon Corridor, Starfield Drift, Rain on Glass, Rainforest Cascade and Blue Meridian, with screenshots in the README.
- A [project site](https://jeremykenedy.github.io/fire-tv-toolkit/), built from the README and docs and deployed on every push to `main`.

### Changed in 3.2.2

- Images optimized.

## [3.2.1] - 2026-10-08

### Added in 3.2.1

- `guard --unlock=screensaver` stops guarding which screensaver is active, so it can be changed from anywhere, and `guard --lock=screensaver` guards it again (Home Redirect 1.2.1).

## [3.2.0] - 2026-10-08

### Added in 3.2.0

- `guard` / `firetv-guard`: Home Redirect 1.2.0 saves the screensaver, Alexa fix, Home and timeout settings and puts them back when Amazon changes them (straight away, at boot, after an app update, and every 15 minutes). Amazon's `easyupgrade` and `forcedotaupdater` are disabled and its main updater is stopped from running in the background. `--check` puts back anything that slipped through, `--off` undoes it all. Offered during `start` and `update`, and turned off first by `firetv-revert`.

### Changed in 3.2.0

- Scrutinizer removed.

## [3.1.0] - 2026-10-08

### Added in 3.1.0

- `optimize` / `firetv-optimize`: checks the TV for settings that stop or spoil a screensaver and fixes only the ones it has. Offered during `start` and `update`, and undone by `firetv-revert`.
- Android's built-in Colors screensaver can be made active with `screensaver --set=colors`.

### Changed in 3.1.0

- Aerial Views is the default: it starts checked on a TV with no screensavers yet, and `screensaver --yes` picks it whenever it is installed.
- Amazon's screensaver is listed as "Amazon with Ads", in the commands and in the on-TV picker (Home Redirect 1.1.1).
- The Aerial Views screenshot shows the screensaver playing instead of its menu.

### Fixed in 3.1.0

- A screensaver written in its long form (`package/package.Class`) is now recognized as the same screensaver.

## [3.0.0] - 2026-10-08

Renamed from amazon-fire-tv-fixes to Fire TV Toolkit, since it now does much
more than fixes.

### Added in 3.0.0

- Aquarium Live and Aquarium 4K screensavers.
- `launcher` / `firetv-launcher`: installs the optional AT4K home screen and switches the Home button between it and the Amazon menu.
- Home Redirect app (`android/home-redirect`) with an on-TV Screensavers picker, since Fire OS Settings only lists Amazon's screensaver.
- `screensaver`: a short name for `firetv-set-screensaver`.
- Screenshots of every screen, and a docs folder with a guide for each part.
- Issue forms for bugs, feature requests, screensaver requests and device reports.

### Changed in 3.0.0

- Commands renamed: `amazon-fire-tv-fixes` is now `fire-tv-toolkit`, and `amazon-fire-tv-fixes-uninstall` is now `firetv-revert`.
- Screensaver checksums can now come from a `.sha256` file attached to the release, as well as from the release notes.
- `firetv-revert` and `uninstall` also send the Home button back and can remove the launcher apps.
- The title banner shrinks to fit narrow terminals.

### Fixed in 3.0.0

- Updating Home Redirect no longer leaves the Home button on the Amazon menu.
- SonarCloud reliability findings: unawaited promises, misplaced doc comments and exported mutable bindings.
- Environment variables can no longer redirect where `.env` is written or which folder is deleted.

## [2.0.0] - 2026-09-29

### Added in 2.0.0

- Timeout commands: view, change and reset the sleep and screensaver timeouts, with first-observed baselines.
- `start`, `update`, `info`, `uninstall`, `delete` and `remove`.
- `--help` on every command, Esc to cancel at any prompt, and non-zero exit codes on failure.

### Changed in 2.0.0

- Uninstall offers to put the TV back first, and reports when a revert did not take effect.
- Screensaver APKs are checked against a published SHA-256 before installing.

## [1.0.0] - 2026-09-28

### Added in 1.0.0

- The Alexa deep-sleep fix and ad-free screensavers, each with a guided installer and a standalone command.

[3.3.0]: https://github.com/jeremykenedy/fire-tv-toolkit/releases/tag/v3.3.0
[3.2.2]: https://github.com/jeremykenedy/fire-tv-toolkit/releases/tag/v3.2.2
[3.2.1]: https://github.com/jeremykenedy/fire-tv-toolkit/releases/tag/v3.2.1
[3.2.0]: https://github.com/jeremykenedy/fire-tv-toolkit/releases/tag/v3.2.0
[3.1.0]: https://github.com/jeremykenedy/fire-tv-toolkit/releases/tag/v3.1.0
[3.0.0]: https://github.com/jeremykenedy/fire-tv-toolkit/releases/tag/v3.0.0
[2.0.0]: https://github.com/jeremykenedy/fire-tv-toolkit/releases/tag/v2.0.0
[1.0.0]: https://github.com/jeremykenedy/fire-tv-toolkit/releases/tag/v1.0.0
