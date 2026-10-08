# Optimizing the TV for screensavers

`optimize` (also `firetv-optimize`) reads the TV first and lists only the
settings it actually has that stop a screensaver from showing or make it
worse. A setting the TV does not have is skipped, and one that is already
right is left alone. Every change starts checked; uncheck anything you want to
keep. `start` and `update` offer the same step after the timeout review.

```bash
optimize          # checklist, then the usual summary and confirm
optimize --yes    # make every listed change without asking
```

## What it checks

| Check | Setting | Changed to | When |
|-------|---------|------------|------|
| Screensaver switched on | `secure screensaver_enabled` | `1` | The TV has it and it is not `1` |
| Starts when the TV is idle | `secure screensaver_activate_on_sleep` | `1` | The TV has it and it is not `1` |
| Android's start-when-docked switch | `secure screensaver_activate_on_dock` | `1` | The TV has it and it is not `1` |
| Screensaver comes before sleep | `system screen_off_timeout` | 5 minutes, or half the sleep timeout if sleep is 5 minutes or less | The screensaver timeout is the same as or longer than the sleep timeout, so the TV would sleep first |
| Alexa deep-sleep fix | `secure str.auto_wake_up_enabled` | `1` | The TV has it and it is not `1` |
| Active screensaver | `secure screensaver_components` | Aerial Views | Aerial Views is installed and the active screensaver is Amazon with Ads, or one that is not installed |
| Fallback screensaver | `secure screensaver_default_component` | The active ad-free screensaver | The TV has it and it still points somewhere else, usually Amazon with Ads |
| Ambient Experience | `secure amazon_ambient_enabled` | `0` | The TV has it (Fire OS 8.1 and later) and it is not `0`. Restart the TV once afterwards. |
| Aerial Views frame rate matching | app op `SYSTEM_ALERT_WINDOW` for `com.neilturner.aerialviews` | `allow` | Aerial Views is installed. Fire OS has no screen for this permission; Aerial Views needs it for its "Auto refresh rate switching" option. |

The fallback, Ambient Experience and overlay checks follow the Fire TV notes
in the [Aerial Views README](https://github.com/theothernt/AerialViews#readme).

## Undoing it

Before the first change to each setting, its old value is saved in `.env` as
`FIRE_TV_OPTIMIZE_<SETTING>`. A second run never overwrites a value that is
already saved, so it always holds what the TV started with. `firetv-revert`
(and `uninstall`) offers "Undo the screensaver optimizations", which puts each
one back, reads it back, and removes its line from `.env`.

The timeout baselines are recorded before `optimize` can change a timeout, so
`firetv-timeouts-reset` still goes back to the first value seen on the TV.
