# Timeouts

| Timeout | Setting | Notes |
|---------|---------|-------|
| Sleep (deep-sleep/standby) | `secure sleep_timeout` | `0` means never sleep |
| Screensaver | `system screen_off_timeout` | `0` is not honored. About 25 days (2147460000 ms) is the practical ceiling to effectively turn it off; larger values are refused by the TV |

## Baselines

The first time a timeout is read, its value is saved to `.env` as its baseline,
because the stock values differ between TVs. `firetv-timeouts-reset` puts back
that value, not a guessed default. The value is what was first seen by this
tool, which may not be the factory value if it had already been changed.

## Commands

```bash
firetv-timeouts                         # one checklist for everything
firetv-timeout-sleep --minutes=30 --yes
firetv-timeout-screensaver --ms=600000 --yes
firetv-timeouts-reset --all
firetv-timeouts-reset --only=sleep
firetv-timeouts-current
firetv-timeouts-possible
```

Every new value is read back. A value the TV refuses or ignores is reported as
a failure.
