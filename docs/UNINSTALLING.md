# Uninstalling

## Put the TV back, keep the tool

```bash
firetv-revert
```

A checklist of everything this tool changed that is still in place. Everything
starts checked except removing AT4K or LTvLauncher; uncheck anything you want
to keep:

- the guard, first, so it does not put the reverts below straight back
- the Alexa deep-sleep fix
- the active screensaver (back to Amazon's)
- each installed screensaver
- each timeout that differs from its baseline
- the Home button (back to the Amazon menu) and the launcher apps. AT4K and
  LTvLauncher start unchecked, because removing them deletes your home screen
  layout; check them to remove them
- the screensaver optimizations, each put back to the value it had before `optimize` changed it
- the local screensaver source in `./screensavers`

Reverting is a risky change, so it asks you to type `yes`. In scripts, use
`firetv-revert --all --force`, which reverts everything except removing AT4K
and LTvLauncher.

## Remove everything

```bash
uninstall
```

1. Runs the same TV checklist first. If the TV cannot be reached, or you
   cancel, it asks before going on, because the next step deletes the saved IP
   and the timeout baselines it would need.
2. Removes the commands from your PATH (`npm uninstall -g fire-tv-toolkit`) and
   resets `.env` to its template.
3. Offers to delete the repo itself.

`delete` (or `remove`) does only the last step, after you type `confirm`.
