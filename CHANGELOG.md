# Changelog

## [3.0.0] - 2026-10-08

Renamed from amazon-fire-tv-fixes to Fire TV Toolkit, since it now does much
more than fixes.

### Added
- Aquarium Live and Aquarium 4K screensavers.
- `launcher` / `firetv-launcher`: installs the optional AT4K home screen and switches the Home button between it and the Amazon menu.
- Home Redirect app (`android/home-redirect`) with an on-TV Screensavers picker, since Fire OS Settings only lists Amazon's screensaver.
- `screensaver`: a short name for `firetv-set-screensaver`.
- Screenshots of every screen, and a docs folder with a guide for each part.
- Issue forms for bugs, feature requests, screensaver requests and device reports.

### Changed
- Commands renamed: `amazon-fire-tv-fixes` is now `fire-tv-toolkit`, and `amazon-fire-tv-fixes-uninstall` is now `firetv-revert`.
- Screensaver checksums can now come from a `.sha256` file attached to the release, as well as from the release notes.
- `firetv-revert` and `uninstall` also send the Home button back and can remove the launcher apps.
- The title banner shrinks to fit narrow terminals.

### Fixed
- Updating Home Redirect no longer leaves the Home button on the Amazon menu.
- SonarCloud reliability findings: unawaited promises, misplaced doc comments and exported mutable bindings.
- Environment variables can no longer redirect where `.env` is written or which folder is deleted.

## [2.0.0] - 2026-09-29

### Added
- Timeout commands: view, change and reset the sleep and screensaver timeouts, with first-observed baselines.
- `start`, `update`, `info`, `uninstall`, `delete` and `remove`.
- `--help` on every command, Esc to cancel at any prompt, and non-zero exit codes on failure.

### Changed
- Uninstall offers to put the TV back first, and reports when a revert did not take effect.
- Screensaver APKs are checked against a published SHA-256 before installing.

## [1.0.0] - 2026-09-28

### Added
- The Alexa deep-sleep fix and ad-free screensavers, each with a guided installer and a standalone command.

[3.0.0]: https://github.com/jeremykenedy/fire-tv-toolkit/releases/tag/v3.0.0
[2.0.0]: https://github.com/jeremykenedy/fire-tv-toolkit/releases/tag/v2.0.0
[1.0.0]: https://github.com/jeremykenedy/fire-tv-toolkit/releases/tag/v1.0.0
