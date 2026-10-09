# Fire TV UI

Fire TV UI is a separate launcher maintained in the private [jeremykenedy/fire-tv-ui](https://github.com/jeremykenedy/fire-tv-ui) repository. It needs Android 8.1 / API 27 or newer. The installer uses `GH_TOKEN`, `GITHUB_TOKEN`, or your GitHub CLI login to download the published release. Your GitHub account needs access to the repository; a fine-grained token needs read access to its contents. Credentials are sent only to GitHub's API and are removed before following asset redirects. Downloads retain SHA-256 verification.

Sign in once with `gh auth login` before running the guided installer. The toolkit downloads Fire TV UI 1.0.1 from its private release, verifies the SHA-256, and updates the installed app without replacing its settings or backups. A local signed APK can also be supplied with `--apk` and `--sha256`. The toolkit does not upload that APK or your backups.

## Guided installer

Run `firetv-ui` or select Fire TV UI in the main menu. Choose installation, removal, or backup transfer. The installer asks for the layout, Home button, installed screensaver, settings protection, and optional computer backup. You review the complete plan before anything changes.

The simple setup supplies the saved blue layout, app rows, sorting, and visibility choices. It excludes personal weather locations and widget contents. Keeping settings preserves the current installation. Restoring the TV backup or importing a file uses your own saved layout instead.

```bash
firetv-ui --install --apk=/path/to/fire-tv-ui-1.0.1.apk --sha256=PUBLISHED_SHA256 --setup=simple --home=fire-tv-ui
firetv-ui
firetv-ui --install --setup=simple --home=fire-tv-ui --protection=on
firetv-ui --install --setup=keep --home=keep --screensaver=keep --yes
firetv-ui --install --setup=tv --home=fire-tv-ui
firetv-ui --install --setup=import --file=/path/to/backup.txt
```

The installer grants screensaver control, backup access, storage statistics, and permission to request screensaver installations. A fresh installation also grants TV listings access so the launcher can start without a first-launch permission dialog. Updates preserve an existing TV listings permission choice. It saves the existing settings before an update and rebinds Home routing if Android drops accessibility services during installation.

If the toolkit's Home Redirect helper is already installed, the installer updates it to a version that leaves the launcher's settings to Fire TV UI. This prevents the two guards from restoring different choices.

## Options

| Flag | Values or purpose |
| --- | --- |
| `--install` | Install or update the launcher. |
| `--setup` | `keep` (default), `simple`, `tv`, or `import`. |
| `--home` | `keep` (default), `fire-tv-ui`, or `amazon`. |
| `--screensaver` | `keep` (default), `on`, `off`, or an installed screensaver ID from the [screensaver registry](SCREENSAVERS.md), including `colors` and `amazon`. |
| `--protection` | `keep` (default), `on`, or `off`. Protects Home, screensaver selection, enabled state, and timers against reversion. |
| `--apk` and `--sha256` | Install a local signed APK with its required SHA-256. |
| `--uninstall` | Save settings, return Home to Amazon, and remove Fire TV UI. |
| `--backup` | `keep` (default) or explicitly `delete` when uninstalling. |
| `--export` | Retrieve a backup to a new computer file. Can also accompany install or uninstall. |
| `--file` | Send a backup to TV Downloads, or supply an installation import. |
| `--restore` | Apply the backup sent with `--file`. |
| `--yes` | Execute explicit flags without the interactive review. |

## Persistent backups

The canonical backup is `/sdcard/Download/fire-tv-ui-backup.txt`. It remains on the TV after uninstalling or reinstalling the launcher. Backups sent from a computer go to `/sdcard/Download/fire-tv-ui-import.txt`, preserving the TV's existing backup.

```bash
firetv-ui --export=/path/to/new-backup.txt
firetv-ui --file=/path/to/backup.txt
firetv-ui --file=/path/to/backup.txt --restore
firetv-ui --uninstall --backup=keep
```

Computer backups are created with private file permissions. An existing computer file is never overwritten. Transfers are validated and compared with the original bytes. Backups include launcher settings and layout; separately stored wallpaper images or videos must remain accessible on the TV.

On the TV, open Settings > Backup/Restore > Manage TV backups to save or restore the Downloads backup, or restore a file sent by the CLI.

## TV controls and privacy

Settings > Screensavers opens the installed picker directly. It shows a current selection, sample images, a Preview it button for each app, screensaver settings, system timers in minutes, RAM and TV storage usage, and installation or removal of the curated screensavers. Per-app sizes include installed files and app data when Android grants usage access. Cache is included in data and is not counted twice.

Settings > Startup and protection enables or disables the launcher as the startup and Home app. The local guard restores unwanted changes to Home routing, screensavers, and timers. Toolkit timer and screensaver commands update the guard's desired values so intentional CLI changes are preserved.

System timers also offers Keep Alexa available during sleep on Fire OS devices with the auto-wake setting. The toolkit's Alexa fix commands update that protected preference too.

Amazon update blocking needs the TV's VPN permission. It discards traffic locally for installed Amazon system updater packages. An optional Appstore toggle also blocks manual Amazon Appstore downloads until switched off. It has no VPN server and does not route streaming apps, weather, CDNs, or the launcher's screensaver downloads. Android allows one active VPN; another always-on VPN must be changed first.

The toolkit guard can also disable updater packages and restrict background execution. Those separate restrictions remain until `guard --off`; the GUI toggle controls the launcher's VPN.

The launcher has no analytics, tracking, rating, or project prompts. Online content services remain available. Firmware with different updater packages or restricted accessibility/VPN behavior may need additional support; the controls show their actual state rather than claiming success from a saved preference.
