# Development

## Tests

```bash
npm test            # every test
npm run coverage    # with line and branch coverage, written to lcov.info
```

The suite runs against a fake TV (`test/helpers/fake-adb.js`): a stand-in
`adb` put first on PATH that keeps the TV's settings and packages in a JSON
file. It also points adb at a server port nothing listens on, so a test can
never reach a real TV. Interactive flows are driven through piped input
(`test/helpers/drive.js`). Tests use a throwaway `.env` and screensaver folder,
set through test-only hooks, never through environment variables in the code.

Coverage is 100% of lines and branches. Keep it there: `npm run coverage` shows anything new that is not covered.

## Building Home Redirect

```bash
android/home-redirect/build.sh
```

Needs a JDK and the Android SDK build tools; no Gradle. The APK is signed with
a key kept outside the repo, and every release must use the same key or the
TV refuses the update. Bump `VERSION_CODE` and `VERSION_NAME` in `build.sh`
for each change.

## Releasing

1. Bump `version` in `package.json` (the tool installs Home Redirect from the
   release tagged with its own version).
2. Build Home Redirect and note its SHA-256.
3. Tag `v<version>`, publish the release, attach `firetv-home-redirect.apk`,
   and add `SHA-256 (firetv-home-redirect.apk): <hash>` to the notes.

## Adding a screensaver

Add an entry to `src/screensaver-registry.js` after vetting it (see
[Screensavers](SCREENSAVERS.md)). Its releases need an APK and a published
SHA-256. Everything else, the menus, flags and revert options, follows from
the registry.
