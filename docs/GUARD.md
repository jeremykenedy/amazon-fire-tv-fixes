# Guard

Amazon puts settings back. A Fire OS or app update, a reboot, or Amazon's own
apps can turn the screensaver back to Amazon with Ads, switch the Alexa fix
off, drop Home Redirect from the Home button, or change the timeouts. The
guard puts them back.

```bash
guard            # explain, confirm, then turn it on
guard --yes      # turn it on without asking
guard --check    # put back anything Amazon changed, and say what it was
guard --off      # turn it off and undo what it did
```

`start` and `update` also offer it, after the optimize step.

## What it keeps

Home Redirect saves these settings as they are when the guard is turned on:

| Setting | What it is |
|---------|------------|
| `secure screensaver_components` | The active screensaver |
| `secure screensaver_default_component` | The fallback screensaver |
| `secure screensaver_enabled`, `screensaver_activate_on_sleep`, `screensaver_activate_on_dock` | The screensaver switches |
| `secure str.auto_wake_up_enabled` | The Alexa deep-sleep fix |
| `secure sleep_timeout`, `system screen_off_timeout` | The sleep and screensaver timeouts |
| `secure enabled_accessibility_services` | The Home button services (Android's `accessibility_enabled` is switched on with them) |
| `secure amazon_ambient_enabled` | Amazon's Ambient Experience, when the TV has it |

It puts a setting back:

- the moment it changes, while Home Redirect's Home service is running,
- when the TV starts,
- when Home Redirect itself is updated,
- and every 15 minutes.

Change settings with this toolkit (any command) or the Screensavers tile on the
TV, and the guard keeps your new value. A change made in Fire OS Settings is
put back, because to the guard it looks like Amazon.

## Amazon's updates

| Package | What the guard does |
|---------|---------------------|
| `com.amazon.tv.easyupgrade` | Disabled |
| `com.amazon.tv.forcedotaupdater.v2` | Disabled |
| `com.amazon.device.software.ota`, `.ota.override` | Stopped from running in the background. Fire OS refuses to disable these ("Cannot disable a protected package"). |

Fire OS can still install an update while the main updater runs in the
foreground, for example from Settings. After any update, run `guard --check`:
it disables any updater that came back and reports each setting the guard put
back.

## Turning it off

`guard --off`, or the first item in `firetv-revert`, unlocks the settings and
turns back on only the updaters the guard itself disabled. An updater that was
already disabled before the guard stays as it was.

## Needs

Home Redirect 1.2.0 or newer. `guard` installs or updates it from this
project's release, checked against its published SHA-256, and grants it
`WRITE_SECURE_SETTINGS`.
