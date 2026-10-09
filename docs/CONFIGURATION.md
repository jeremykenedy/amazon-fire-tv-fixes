# Configuration

There is nothing to configure by hand. The guided menus and the command flags
do everything, and the tool keeps what it needs in a `.env` file in the repo
folder. `.env` is ignored by git, so it never ends up in a commit.

On a fresh clone the first run copies `.env.example` to `.env` and fills it in.

## Saved values

| Key | Written by | What it is |
|-----|------------|------------|
| `FIRE_TV_IP` | `start`, `update`, any command that connects | The TV's IP address. Port 5555 is added automatically. |
| `INSTALLED` | `start`, `update` | `true` once setup has connected to the TV. Together with a valid `FIRE_TV_IP` this is what unlocks the other commands. |
| `FIRE_TV_TIMEOUT_SLEEP_FACTORY_MS` | The first command that reads the sleep timeout | The sleep timeout first seen on this TV, in milliseconds. Resets go back to this. |
| `FIRE_TV_TIMEOUT_SCREENSAVER_FACTORY_MS` | The first command that reads the screensaver timeout | The screensaver timeout first seen on this TV, in milliseconds. |
| `FIRE_TV_GUARD` | `guard` | `on` while the guard is on. Settings this tool changes are then passed to the guard first, so it keeps the new value. |
| `FIRE_TV_GUARD_DISABLED` | `guard` | The Amazon updater packages the guard disabled, so `guard --off` turns back on only those. |
| `FIRE_TV_GUARD_BACKGROUND` | `guard` | Each updater the guard stopped running in the background, with its mode from before. |
| `FIRE_TV_OPTIMIZE_<SETTING>` | `optimize`, the first time it changes that setting | The value the setting had before `optimize` changed it (`null` if the TV had none). `firetv-revert` puts it back and then removes the line. |

## Changing TVs

Run `update` and enter the new IP address. The timeout baselines are not tied
to one TV: to capture fresh ones for a different TV, delete the two
`FIRE_TV_TIMEOUT_*` lines from `.env` before the first timeout command.

## Starting over

`uninstall` resets `.env` back to `.env.example`. You can also delete `.env`
yourself and run `start`.
