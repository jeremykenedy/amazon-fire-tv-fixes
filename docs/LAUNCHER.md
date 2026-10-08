# Home screen

The AT4K home screen is optional. It replaces the Amazon menu with a clean,
ad-free home screen, and it can be switched back at any time.

## How it works

Fire OS has no setting for choosing a home app, so two accessibility services
work together:

- **AT4K's own service** (`com.overdevs.at4k/.Hra`), part of AT4K.
- **Home Redirect** (`com.jeremykenedy.firetv.homeredirect`), built from
  [`android/home-redirect`](../android/home-redirect) in this repo. It watches
  for the Amazon home screen coming to the front and opens AT4K over it. It is
  told which app is in front, never what is on the screen, and it keeps and
  sends nothing. When the Amazon home screen appears straight after AT4K or
  Settings, it waits briefly, so the Settings gear in AT4K still works.

## The on-TV screensaver picker

Home Redirect also adds a **Screensavers** tile to the TV. It lists every
screensaver installed on the TV and makes the one you pick active, from the
couch. Fire OS Settings only offers Amazon's own. The picker needs the
`WRITE_SECURE_SETTINGS` permission, which `launcher --install` grants over adb.

## Commands

```bash
launcher                    # guided menu
launcher --install          # install or update AT4K and Home Redirect
launcher --use=at4k         # Home goes to AT4K
launcher --use=amazon       # Home goes back to the Amazon menu
```

## Where the apps come from

- **AT4K** is installed from its author's own release
  ([avadhesh18/at4k](https://github.com/avadhesh18/at4k), v1.2), unmodified, and
  checked against a SHA-256 pinned in `src/launcher-registry.js`.
- **Home Redirect** is attached to this tool's release of the same version,
  with its SHA-256 in the release notes.

## Things to know

- If a different build of AT4K is already on the TV, signed by someone else,
  Android will not replace it. The install reports that and leaves your copy
  exactly as it is; switching the Home button still works with it.
- Updating Home Redirect in place can make Android drop it from the enabled
  accessibility services, which sends Home back to the Amazon menu.
  `launcher --install` checks for this and switches Home back to AT4K.
- `firetv-revert` and `uninstall` can send Home back to the Amazon menu and
  remove both apps.
