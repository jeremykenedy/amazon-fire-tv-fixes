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
    <a href="https://sonarcloud.io/summary/new_code?id=jeremykenedy_amazon-fire-tv-fixes"><img src="https://sonarcloud.io/api/project_badges/measure?project=jeremykenedy_amazon-fire-tv-fixes&metric=alert_status" alt="Quality Gate Status"></a>
    <a href="https://scrutinizer-ci.com/g/jeremykenedy/amazon-fire-tv-fixes/build-status/main"><img src="https://scrutinizer-ci.com/g/jeremykenedy/amazon-fire-tv-fixes/badges/build.png?b=main" alt="Scrutinizer Build Status"></a>
    <a href="https://scrutinizer-ci.com/g/jeremykenedy/amazon-fire-tv-fixes/?branch=main"><img src="https://scrutinizer-ci.com/g/jeremykenedy/amazon-fire-tv-fixes/badges/quality-score.png?b=main" alt="Scrutinizer Code Quality"></a>
    <a href="https://scrutinizer-ci.com/code-intelligence"><img src="https://scrutinizer-ci.com/g/jeremykenedy/amazon-fire-tv-fixes/badges/code-intelligence.svg?b=main" alt="Code Intelligence Status"></a>
    <a href="https://app.codacy.com/gh/jeremykenedy/amazon-fire-tv-fixes/dashboard"><img src="https://app.codacy.com/project/badge/Grade/f18b3347eae54aeea4251575b7b2de1f" alt="Codacy Badge"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
</p>

<p align="center">
    <a href="https://app.aikido.dev/repositories/3225041"><img src="https://app.aikido.dev/assets/badges/full-light-theme.svg" alt="Secured by Aikido" height="32"></a>
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
npm install
npm link
amazon-fire-tv-fixes
```

The first run walks you through everything: installing adb if you do not
already have it, confirming developer mode, and entering your TV's IP
address. Nothing is installed or changed on your TV until you confirm each
step. Your TV's IP address is saved to a local `.env` file (copied from
`.env.example`) so you are not asked again.

## Commands

Every step in the guided installer is also its own standalone command, so you
can run just the part you need without going through the full menu.

| Command | What it does |
|---------|--------------|
| `amazon-fire-tv-fixes` | Runs the full guided installer with all four steps below. |
| `amazon-fire-tv-fixes-uninstall` | Reverses everything this tool has applied, in the same guided fashion. |
| `firetv-install-adb` | Installs adb (Android SDK Platform Tools) if it is not already on your machine. |
| `enable-alexa-fix` | Turns on the Alexa deep-sleep fix by itself. |
| `disable-alexa-fix` | Reverts the Alexa deep-sleep fix back to the factory default. |
| `firetv-screensavers` | Installs or removes the ad-free screensavers, by itself. |
| `firetv-set-screensaver` | Chooses which installed screensaver is active, by itself. |

Every command explains what it is about to do and exactly which setting it
changes before asking you to confirm. Nothing runs until you say yes.

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

## Uninstalling

```bash
amazon-fire-tv-fixes-uninstall
```

This checks what is actually applied right now (the Alexa fix, the active
screensaver, and any installed screensaver packages) and lets you pick which
of it to revert, with the same explain-then-confirm pattern as installation.

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
