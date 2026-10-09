# How it works

Everything this tool does to the TV is a plain adb command over your network
(port 5555). Nothing is installed on the TV except the apps you choose.

## The Alexa deep-sleep fix

After about 20 minutes idle, a Fire TV Edition set suspends in a way that
drops it off Wi-Fi, so Alexa reports it offline until someone presses the
remote. The "Voice Commands When TV Screen is Off" toggle in Settings does not
write the setting the sleep code reads. The fix writes it directly:

```bash
adb shell settings put secure str.auto_wake_up_enabled 1   # fix on
adb shell settings put secure str.auto_wake_up_enabled 0   # fix off (factory)
```

## Screensavers

```bash
adb install -r <apk>                                                   # install or update, keeping its settings
adb shell settings put secure screensaver_components <package>/<service>   # make one active
adb shell pm uninstall <package>                                       # remove
```

See [Screensavers](SCREENSAVERS.md) for where each APK comes from and how it is
checked.

## Timeouts

```bash
adb shell settings put secure sleep_timeout <ms>        # sleep (deep-sleep/standby)
adb shell settings put system screen_off_timeout <ms>   # screensaver
```

See [Timeouts](TIMEOUTS.md).

## Optimizing for screensavers

```bash
adb shell settings put secure screensaver_enabled 1
adb shell settings put secure screensaver_activate_on_sleep 1
adb shell settings put secure screensaver_default_component <package>/<service>
adb shell settings put secure amazon_ambient_enabled 0
adb shell appops set com.neilturner.aerialviews SYSTEM_ALERT_WINDOW allow
```

Each one only when the TV has that setting and it is not already set. See
[Optimizing](OPTIMIZE.md) for every check.

## The guard

```bash
adb shell am broadcast -n com.jeremykenedy.firetv.homeredirect/.GuardReceiver \
  -a com.jeremykenedy.firetv.homeredirect.GUARD --es cmd lock     # or check, unlock
adb shell pm disable-user --user 0 com.amazon.tv.easyupgrade
adb shell appops set com.amazon.device.software.ota RUN_ANY_IN_BACKGROUND ignore
```

See [Guard](GUARD.md).

## The home screen

```bash
adb shell settings put secure enabled_accessibility_services <AT4K>:<Home Redirect>
adb shell settings put secure accessibility_enabled 1
adb shell pm grant com.jeremykenedy.firetv.homeredirect android.permission.WRITE_SECURE_SETTINGS
```

See [Home screen](LAUNCHER.md).

## Changes are read back

The Alexa fix, the timeouts, the Home button switch and every revert are read
back after writing, and only reported as done when the TV holds the new value.
A value the TV refused, or quietly ignored, is reported as a failure and the
command exits non-zero.
