# Home screen

Two optional home screens can replace the Amazon menu: AT4K and LTvLauncher.
Both are clean and ad-free, both can be installed side by side, and the Home
button can be switched between them, or back to the Amazon menu, at any time.

## How it works

Fire OS has no setting for choosing a home app, and it does not hand the Home
key to accessibility services, so the toolkit uses its own helper:

- **Home Redirect** (`com.jeremykenedy.firetv.homeredirect`), built from
  [`android/home-redirect`](../android/home-redirect) in this repo. It watches
  for the Amazon home screen coming to the front and opens the chosen launcher
  over it. It is told which app is in front, never what is on the screen, and
  it keeps and sends nothing. When the Amazon home screen appears straight
  after the launcher or Settings, it waits briefly, so the launcher's Settings
  gear still works. It opens AT4K unless told to open LTvLauncher.
- **AT4K's own service** (`com.overdevs.at4k/.Hra`), part of AT4K, runs beside
  it while Home goes to AT4K. It is switched off while Home goes to
  LTvLauncher, so it cannot pull Home back to AT4K, and switched on again when
  Home goes back to AT4K. Switching never changes AT4K itself or its settings.

LTvLauncher ships a "Home Button Fix" accessibility service that listens for
the Home key. Since Fire OS keeps that key from accessibility services, the
toolkit leaves it off and uses Home Redirect instead.

## The on-TV screensaver picker

Home Redirect also adds a **Screensavers** tile to the TV. It lists every
screensaver installed on the TV and makes the one you pick active, from the
couch. Fire OS Settings only offers Amazon's own. The picker needs the
`WRITE_SECURE_SETTINGS` permission, which the install grants over adb.

## Commands

```bash
launcher                    # guided menu
launcher --install          # install or update AT4K and Home Redirect
launcher --install-ltv      # install or update LTvLauncher and Home Redirect
launcher --use=at4k         # Home goes to AT4K
launcher --use=ltv          # Home goes to LTvLauncher
launcher --use=amazon       # Home goes back to the Amazon menu
```

## Where the apps come from

- **AT4K** is installed from its author's own release
  ([avadhesh18/at4k](https://github.com/avadhesh18/at4k), v1.2), unmodified, and
  checked against a SHA-256 pinned in `src/launcher-registry.js`.
- **LTvLauncher** is installed from its authors' own release
  ([leanbitlab-org/LtvLauncher](https://github.com/leanbitlab-org/LtvLauncher),
  v2026.10.03, GPL-3.0), unmodified. Its releases publish no checksum, so the
  universal APK, which runs on 32 and 64-bit Fire TVs, is pinned by tag and
  SHA-256 in `src/launcher-registry.js`. It has no internet permission.
- **Home Redirect** is attached to this tool's release of the same version,
  with its SHA-256 in the release notes. Opening LTvLauncher needs Home
  Redirect 1.2.5 or newer; `launcher --install-ltv` updates it.

## Things to know

- If a different build of AT4K is already on the TV, signed by someone else,
  Android will not replace it. The install reports that and leaves your copy
  exactly as it is; switching the Home button still works with it.
- Installing or switching to LTvLauncher never installs, updates or removes
  AT4K.
- Updating Home Redirect in place can make Android drop it from the enabled
  accessibility services, which sends Home back to the Amazon menu. The
  install checks for this and switches Home back to the launcher it was on.
- `firetv-revert` and `uninstall` can send Home back to the Amazon menu and
  remove the apps. AT4K and LTvLauncher hold your home screen layout, which
  uninstalling deletes, so they start unticked and `firetv-revert --all` leaves
  them installed. Tick them to remove them.
