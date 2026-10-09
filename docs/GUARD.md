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
guard --unlock=screensaver   # stop guarding which screensaver is active
guard --lock=screensaver     # guard it again, as it is now
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

When Fire TV UI is installed, Home Redirect 1.2.3 leaves Home routing, the selected screensaver, its enabled state, the Alexa fix, and both timers to Fire TV UI's local guard. It removes its old copies of those values so they cannot be restored after the launcher is removed. The toolkit still protects the fallback screensaver, activation switches, Ambient Experience, and updater restrictions. The Fire TV UI installer updates an older helper before configuring the launcher.

`guard` enables Fire TV UI's settings protection too, and `guard --off` disables it. Screensaver unlock and lock apply to the native picker as well; the picker identifies an unlocked selection. The GUI's update-blocking toggle controls its VPN. Updater package restrictions applied by the toolkit are undone separately with `guard --off`.

## Unlocking the screensaver

`guard --unlock=screensaver` stops guarding which screensaver is active and
the fallback screensaver (`screensaver_components` and
`screensaver_default_component`), so any app or Fire OS Settings can change
them. Everything else stays guarded, including the screensaver switches and
timeouts. It stays unlocked when the guard is turned on again, until
`guard --lock=screensaver` locks it as it is at that moment.

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

## Keeping ADB debugging on

Home Redirect 1.2.4 turns ADB debugging back on whenever it is switched off,
and checks again every time the TV starts. This is on whether or not the
guard is on. ADB debugging is what opens port 5555, which is all the toolkit
needs.

It never touches **wireless debugging** (`adb_wifi_enabled`). The toolkit does
not use it, and while it is on, Fire OS asks after every restart whether to
allow debugging on this network: it does not remember the answer across
restarts, even with **Always allow on this network** ticked. Leave wireless
debugging off and the question does not come up. To stop Home Redirect
keeping ADB debugging on:

```bash
adb shell am broadcast -n com.jeremykenedy.firetv.homeredirect/.GuardReceiver \
  -a com.jeremykenedy.firetv.homeredirect.GUARD --es cmd adb --es value off
```

`--es value on` turns it back on, and leaving out `value` reports `adb=kept` or
`adb=released`.

## Turning it off

`guard --off`, or the first item in `firetv-revert`, unlocks the settings and
turns back on only the updaters the guard itself disabled. An updater that was
already disabled before the guard stays as it was.

## Needs

Home Redirect 1.2.0 or newer, or 1.2.3 when Fire TV UI is installed. `guard` installs or updates it from this
project's release, checked against its published SHA-256, and grants it
`WRITE_SECURE_SETTINGS`.
