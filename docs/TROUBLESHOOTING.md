# Troubleshooting

## The TV cannot be reached

The tool prints what adb said. The usual causes:

- **ADB debugging is off.** A Fire OS update, and sometimes a restart, can turn
  it off. Turn it back on in `Settings > Device & Software > Developer options`.
- **The pairing prompt was not accepted.** After a reset the TV may ask again
  to allow this computer. Accept it on the TV.
- **The IP address changed.** Run `update` and enter the new one.
- **The TV is off or still starting.** The adb port can take a few minutes to
  open after a restart.

## The Alexa fix turned itself off

On the TV this was tested on, a restart set `str.auto_wake_up_enabled` back to
`0`: Amazon's Alexa app writes its default at boot. Run `enable-alexa-fix`
again after a restart or an update.

## Home goes to the Amazon menu instead of AT4K or LTvLauncher

Run `launcher --use=at4k` or `launcher --use=ltv`. Updating Home Redirect can
make Android drop it from the enabled accessibility services; `launcher
--install` and `launcher --install-ltv` put it back for you.

## A screensaver will not install

The download is refused when its checksum is missing or does not match, or
when the URL is not the repository's own release. Nothing is installed in that
case, which is the point. Try again later, or open an issue.

## Cancelling

Esc or Ctrl-C cancels at any prompt. Nothing has changed until you confirm on
the summary screen.
