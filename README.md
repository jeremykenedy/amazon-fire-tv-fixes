<p align="center">
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="art/banner-dark.svg">
        <source media="(prefers-color-scheme: light)" srcset="art/banner-light.svg">
        <img src="art/banner-light.svg" alt="amazon-fire-tv-fixes" width="800">
    </picture>
</p>

<p align="center">A guided command-line tool that fixes the Alexa deep-sleep bug on Fire TV Edition and replaces the ad-serving screensaver with ad-free alternatives.</p>

<p align="center">
    <a href="https://github.com/jeremykenedy/amazon-fire-tv-fixes/actions/workflows/tests.yml"><img src="https://github.com/jeremykenedy/amazon-fire-tv-fixes/actions/workflows/tests.yml/badge.svg" alt="Tests"></a>
    <a href="https://dashboard.gitguardian.com/"><img src="https://github.com/jeremykenedy/amazon-fire-tv-fixes/actions/workflows/gitguardian.yml/badge.svg" alt="GitGuardian scan"></a>
    <a href="https://sonarcloud.io/summary/new_code?id=jeremykenedy_amazon-fire-tv-fixes"><img src="https://sonarcloud.io/api/project_badges/measure?project=jeremykenedy_amazon-fire-tv-fixes&metric=alert_status" alt="Quality Gate Status"></a>
    <a href="https://scrutinizer-ci.com/g/jeremykenedy/amazon-fire-tv-fixes/build-status/main"><img src="https://scrutinizer-ci.com/g/jeremykenedy/amazon-fire-tv-fixes/badges/build.png?b=main" alt="Scrutinizer Build Status"></a>
    <a href="https://scrutinizer-ci.com/g/jeremykenedy/amazon-fire-tv-fixes/?branch=main"><img src="https://scrutinizer-ci.com/g/jeremykenedy/amazon-fire-tv-fixes/badges/quality-score.png?b=main" alt="Scrutinizer Code Quality"></a>
    <a href="https://app.codacy.com/gh/jeremykenedy/amazon-fire-tv-fixes/dashboard"><img src="https://app.codacy.com/project/badge/Grade/f18b3347eae54aeea4251575b7b2de1f" alt="Codacy Badge"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
</p>

<p align="center">
    <a href="https://app.aikido.dev/repositories/3225041"><img src="https://app.aikido.dev/assets/badges/full-light-theme.svg" alt="Secured by Aikido" height="32"></a>
</p>

<p align="center">
    <a href="https://github.com/jeremykenedy"><img src="https://img.shields.io/github/followers/jeremykenedy?label=Follow&amp;style=social" alt="Follow @jeremykenedy"></a>
    <a href="https://github.com/jeremykenedy/amazon-fire-tv-fixes/stargazers"><img src="https://img.shields.io/github/stars/jeremykenedy/amazon-fire-tv-fixes?style=social" alt="Star amazon-fire-tv-fixes on GitHub"></a>
    <a href="https://github.com/sponsors/jeremykenedy"><img src="https://img.shields.io/static/v1?label=Sponsor&amp;message=%E2%9D%A4&amp;logo=GitHub&amp;color=%23fe8e86" alt="Sponsor me on GitHub"></a>
</p>

## Table of Contents

- [What this fixes](#what-this-fixes)
- [Requirements](#requirements)
- [Putting your Fire TV in developer mode](#putting-your-fire-tv-in-developer-mode)
- [Installation](#installation)
- [Commands](#commands)
- [How it works](#how-it-works)
- [Uninstalling](#uninstalling)
- [Testing](#testing)
- [Credits](#credits)
- [License](#license)

## What this fixes

Fire TV Edition televisions (tested on an Insignia 4K Fire TV Edition) have two
long-standing problems this tool addresses directly, over adb:

1. **Alexa can't wake the TV from deep sleep.** After roughly 20 minutes idle,
   the TV suspends in a way that drops it off Wi-Fi, so Alexa reports it
   offline until someone walks over and presses the remote. The on-screen
   "Voice Commands When TV Screen is Off" toggle claims to prevent this, but
   it does not actually write the setting the sleep code reads. This is a
   real bug in Fire OS, confirmed by reading Amazon's own code.
2. **The stock screensaver serves full-screen ads.** There is no toggle
   anywhere in the TV's settings to turn off the ads without also giving up
   the screensaver entirely. This tool replaces it with a screensaver you
   pick, with no ads.

## Requirements

- Node.js 18 or later
- A Fire TV Edition device on the same network as your computer
- adb (this tool can install it for you)

## Putting your Fire TV in developer mode

Before running the installer, turn on Developer Mode and ADB debugging on the
TV itself. The exact menu names vary a little by Fire TV model and software
version. On a Fire TV Edition set (screenshots below), the path is `Settings >
Device & Software`:

<p align="center"><img src="docs/screenshots/settings-device-software.png" alt="Settings, Device and Software screen" width="700"></p>

1. **Turn on Developer Mode:** open `About`, then select "Your TV" 7 times in
   a row until it says "You are now a developer!"

<p align="center"><img src="docs/screenshots/settings-about.png" alt="About screen showing Your TV and Network entries" width="700"></p>

2. **Turn on ADB debugging:** back out to `Device & Software`, open
   `Developer options`, and turn `ADB debugging` on.

<p align="center"><img src="docs/screenshots/settings-developer-options.png" alt="Developer options screen with ADB debugging set to on" width="700"></p>

3. **Find your TV's IP address:** back in `About`, open `Network`. Numbers
   below are blurred out, this is just to show where to look on your own TV.

<p align="center"><img src="docs/screenshots/settings-network.png" alt="Network screen showing the IP address field, numbers blurred" width="700"></p>

The installer asks you to confirm this and prompts for the IP address before
doing anything else.

## Installation

```bash
git clone https://github.com/jeremykenedy/amazon-fire-tv-fixes.git
cd amazon-fire-tv-fixes
node setup.js
```

`setup.js` works on a fresh clone: if the dependencies are not installed yet
it offers to run `npm install` first. It then shows a checklist: install
dependencies and link every command onto your PATH, and/or launch the guided
app right away. Nothing runs until you confirm on the summary screen. To do it
by hand instead:

```bash
npm install
npm link
start
```

After that, run `start` any time to open the guided menu. The first run walks you through everything: installing
adb if you do not already have it, confirming developer mode, and entering
your TV's IP address. Nothing is installed or changed on your TV until you
confirm each step. Your TV's IP address is saved to a local `.env` file
(copied from `.env.example`) so you are not asked again. Once setup completes,
`.env` records `INSTALLED=true`.

The app counts as installed only when `INSTALLED=true` **and** `FIRE_TV_IP` is
a valid IP address. Until then, every command except `start`, `update`,
`info`, `uninstall`, `delete` and `remove` refuses to run and points you at
`start`, and `info` shows only `start`.

## Commands

Every step in the guided installer is also its own standalone command, so you
can run just the part you need without going through the full menu.

`info` (also `information`, `guide` and `firetv`) lists every command and what
it does. `start` opens the guided menu; if the app is already installed it
says so and runs `update`. `update` re-runs setup and warns that the values
you enter will override what is already installed.

| Command | What it does |
|---------|--------------|
| `start` | Opens the guided menu. Runs setup if nothing is installed yet, or hands off to `update` if it already is. |
| `update` | Re-runs setup, overriding what is already installed. Runs plain setup if nothing is installed yet. |
| `info`, `information`, `guide`, `firetv` | Lists every command and what it does, with the banner. Shows only `start` until the app is installed. |
| `amazon-fire-tv-fixes` | Runs the full guided installer with all the steps below. |
| `amazon-fire-tv-fixes-uninstall` | Reverses the fixes this tool applied to the TV, in the same guided fashion. |
| `firetv-install-adb` | Installs adb (Android SDK Platform Tools) if it is not already on your machine. |
| `enable-alexa-fix` | Turns on the Alexa deep-sleep fix by itself. |
| `disable-alexa-fix` | Reverts the Alexa deep-sleep fix back to the factory default. |
| `firetv-screensavers` | Installs or removes the ad-free screensavers, by itself. |
| `firetv-set-screensaver` | Chooses which installed screensaver is active, by itself. |
| `firetv-timeouts` | Review, edit, and/or reset any of the TV timeouts, all in one guided flow. Choose "Skip" to leave them alone. |
| `firetv-timeout-sleep` | Changes the sleep (deep-sleep/standby) timeout by itself. |
| `firetv-timeout-screensaver` | Changes the screensaver timeout by itself. |
| `firetv-timeouts-reset` | Resets one, several (`--only=`), or all (`--all`) timeouts back to their first-observed baseline. |
| `firetv-timeouts-possible` | Reports which timeouts this specific TV actually supports right now. |
| `firetv-timeouts-current` | Reports the current value and captured baseline for every known timeout. |
| `uninstall` | Unlinks the commands and resets `.env`, then offers to delete the repo. Does not change the TV. |
| `delete`, `remove` | Permanently deletes this repo from your machine, after typing `confirm`. Does not touch the TV. |

Every command explains what it is about to do and exactly which setting it
changes before asking you to confirm. Nothing runs until you say yes.

Every command accepts `--help` to list its options. At any prompt, press Esc
(or Ctrl-C) to cancel and quit; Esc is ignored while an action is already
running, so it can never interrupt a change halfway. Commands that fail or
refuse to act exit with a non-zero status, so they are safe to use in scripts.

## How it works

`enable-alexa-fix` and `disable-alexa-fix` change exactly one Android setting
on the TV:

```
adb shell settings put secure str.auto_wake_up_enabled 1   # fix on
adb shell settings put secure str.auto_wake_up_enabled 0   # fix off (factory)
```

The screensaver commands change which app the system treats as the active
screensaver:

```
adb shell settings put secure screensaver_components <package>/<service>
```

Screensavers you choose to install are cloned from a fork under this GitHub
account into a local `screensavers/` folder (not committed to git), and the
matching APK from that fork's latest GitHub release is installed on the TV.

The timeout commands change two more Android settings directly:

```
adb shell settings put secure sleep_timeout <ms>       # deep-sleep/standby timeout
adb shell settings put system screen_off_timeout <ms>   # screensaver timeout
```

The first time a timeout is read, its current value is saved to `.env` as
its baseline, since stock values can vary by TV. `firetv-timeouts-reset`
restores that captured value, not a hardcoded default.

## Uninstalling

```bash
uninstall
```

This does everything in two steps. First it connects to the TV and offers to
put it back how it was: revert the Alexa fix, reset the active screensaver to
the Amazon default, remove the screensavers this tool installed, and reset any
timeouts you changed to their first-observed values. Everything is checked by
default and you can uncheck anything you want to keep. If the TV cannot be
reached, or you cancel that step, it asks before going on, because the next
step deletes the saved IP and the recorded timeout baselines.

Second, it removes the commands from your PATH and resets `.env` to its
template. It then offers to delete the repo itself (`delete` / `remove` does
only that last part).

To revert only the TV and keep everything installed, run:

```bash
amazon-fire-tv-fixes-uninstall
```

## Testing

```bash
npm test
```

## Credits

The ad-free screensavers this tool installs are forks of the following
projects. All credit for the original work belongs to their authors:

- [Aerial Views](https://github.com/theothernt/AerialViews) by theothernt
- [androsaver](https://github.com/Whichcraft/androsaver) by Whichcraft
- [Snoozy](https://github.com/avadhesh18/Snoozy) by avadhesh18

## License

This package is open-sourced software licensed under the [MIT license](LICENSE).
