# Commands

Every command explains what it is about to change and waits for you to
confirm. Every command accepts `--help`. At any prompt, Esc or Ctrl-C cancels;
Esc is ignored while a change is already running, so it can never stop one
halfway. Commands that fail or refuse to act exit with a non-zero status.

Until setup has finished (a valid `FIRE_TV_IP` and `INSTALLED=true` in
`.env`), every command except `start`, `update`, `info`, `uninstall`, `delete`
and `remove` refuses to run and points you at `start`.

## Setup and help

| Command | What it does | Flags |
|---------|--------------|-------|
| `start` | Opens the guided menu. Runs setup the first time, then hands off to `update`. | none |
| `update` | Re-runs setup, replacing the saved values. | none |
| `fire-tv-toolkit` | Runs the full guided installer. | none |
| `info`, `information`, `guide`, `firetv` | Lists every command. Shows only `start` until setup has finished. | none |
| `firetv-install-adb` | Installs adb with Homebrew on macOS or apt on Linux. | `--yes` installs without asking |

## Alexa deep-sleep fix

| Command | What it does | Flags |
|---------|--------------|-------|
| `enable-alexa-fix` | Turns the fix on. | `--yes` applies it without asking |
| `disable-alexa-fix` | Turns the fix off (factory behavior). | `--yes` skips the prompt, and needs `--force` too, since this brings the bug back |

## Screensavers

| Command | What it does | Flags |
|---------|--------------|-------|
| `firetv-screensavers` | Installs or removes screensavers with a checklist. | `--install=<ids>`, `--uninstall=<ids>` (needs `--force`), `--yes`, `--force` |
| `screensaver`, `firetv-set-screensaver` | Chooses which installed screensaver is active. | `--set=<aerial\|androsaver\|snoozy\|aquarium-live\|aquarium-4k\|jellyfish-drift\|colors\|amazon>`, `--yes` picks Aerial Views, or the only installed one |

Screensaver ids: `aerial` (the default), `androsaver`, `snoozy`,
`aquarium-live`, `aquarium-4k`, `jellyfish-drift`. `colors` (Android's built-in Colors) and
`amazon` (Amazon with Ads) come with the TV, for `--set` only.

## Optimizing for screensavers

| Command | What it does | Flags |
|---------|--------------|-------|
| `optimize`, `firetv-optimize` | Lists the settings this TV has that stop or spoil a screensaver, then fixes the ones you keep checked. See [Optimizing](OPTIMIZE.md). | `--yes` makes every change without asking |

## Guard

| Command | What it does | Flags |
|---------|--------------|-------|
| `guard`, `firetv-guard` | Keeps Amazon from undoing your setup. See [Guard](GUARD.md). | `--check` puts back anything Amazon changed and reports it, `--off` turns the guard off, `--unlock=screensaver` / `--lock=screensaver` stop or restart guarding which screensaver is active, `--yes` skips the confirmation |

## Home screen

| Command | What it does | Flags |
|---------|--------------|-------|
| `launcher`, `firetv-launcher` | Installs AT4K and the Home Redirect app, and switches the Home button between AT4K and the Amazon menu. | `--install`, `--use=<at4k\|amazon>`, `--yes` (still needs `--install` or `--use`) |

## Timeouts

| Command | What it does | Flags |
|---------|--------------|-------|
| `firetv-timeouts` | Reviews, edits or resets both timeouts in one checklist. Choose Skip to leave them. | none |
| `firetv-timeout-sleep` | Changes the sleep timeout. | `--ms=<n>` or `--minutes=<n>`, `--yes` (still needs a value) |
| `firetv-timeout-screensaver` | Changes the screensaver timeout. | `--ms=<n>` or `--minutes=<n>`, `--yes` (still needs a value) |
| `firetv-timeouts-reset` | Resets timeouts to the values first seen on your TV. | `--all` or `--only=<sleep,screensaver>`, `--yes` (still needs one of them) |
| `firetv-timeouts-current` | Shows each timeout's current value and its baseline. | none |
| `firetv-timeouts-possible` | Shows which timeouts this TV supports, and any other timeout-like settings it has. | none |

## Reverting and removing

| Command | What it does | Flags |
|---------|--------------|-------|
| `firetv-revert` | Puts the TV back how it was with a checklist: the Alexa fix, the active screensaver, installed screensavers, changed timeouts, the Home button, the launcher apps, the screensaver optimizations and the guard. | `--all` reverts everything, `--force` skips the typed confirmation, `--yes` (reverts nothing without `--all`) |
| `uninstall` | Runs `firetv-revert` first, then removes the commands and resets `.env`, then offers to delete the repo. | none |
| `delete`, `remove` | Deletes this repo from your computer after you type `confirm`. Does not touch the TV. | none |

## Examples

```bash
enable-alexa-fix --yes
firetv-screensavers --install=aquarium-4k,aquarium-live --yes
screensaver --set=aquarium-4k
firetv-screensavers --install=jellyfish-drift --yes
screensaver --set=jellyfish-drift
optimize --yes
guard --yes
guard --check
guard --unlock=screensaver
launcher --install --use=at4k
firetv-timeout-sleep --minutes=30 --yes
firetv-revert --all --force
```
