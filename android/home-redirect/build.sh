#!/usr/bin/env bash
# Builds and signs the Home Redirect APK without Gradle, using only the JDK
# and the Android SDK build tools. Output: build/firetv-home-redirect.apk
#
# The signing key lives outside the repo. Every release must be signed with
# the same key or the TV will refuse the update, so keep both files backed up:
#   ~/.android/firetv-home-redirect.jks
#   ~/.android/firetv-home-redirect.pass
set -euo pipefail

VERSION_CODE=2
VERSION_NAME=1.1.0
MIN_SDK=22
TARGET_SDK=30

HERE="$(cd "$(dirname "$0")" && pwd)"
SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
BUILD_TOOLS="$(ls -d "$SDK"/build-tools/* | sort -V | tail -1)"
ANDROID_JAR="$(ls -d "$SDK"/platforms/android-* | sort -V | tail -1)/android.jar"
KEYSTORE="$HOME/.android/firetv-home-redirect.jks"
KEYPASS="$HOME/.android/firetv-home-redirect.pass"
OUT="$HERE/build"

if [[ ! -f "$KEYSTORE" ]]; then
  mkdir -p "$(dirname "$KEYSTORE")"
  (umask 077 && openssl rand -hex 24 > "$KEYPASS")
  keytool -genkeypair -keystore "$KEYSTORE" -storepass:file "$KEYPASS" -alias home-redirect \
    -keyalg RSA -keysize 2048 -validity 10950 -dname "CN=Jeremy Kenedy"
  chmod 600 "$KEYSTORE"
  echo "Created a new signing key at $KEYSTORE. Back it up."
fi

rm -rf "$OUT"
mkdir -p "$OUT/classes" "$OUT/dex" "$OUT/gen"

"$BUILD_TOOLS/aapt2" compile --dir "$HERE/res" -o "$OUT/res.zip"
"$BUILD_TOOLS/aapt2" link -o "$OUT/unsigned.apk" -I "$ANDROID_JAR" \
  --manifest "$HERE/AndroidManifest.xml" \
  --min-sdk-version "$MIN_SDK" --target-sdk-version "$TARGET_SDK" \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  --java "$OUT/gen" \
  "$OUT/res.zip"

find "$HERE/src" "$OUT/gen" -name '*.java' > "$OUT/sources.txt"
javac -nowarn -Xlint:-options -source 8 -target 8 -bootclasspath "$ANDROID_JAR" -d "$OUT/classes" @"$OUT/sources.txt"
find "$OUT/classes" -name '*.class' > "$OUT/classes.txt"
"$BUILD_TOOLS/d8" --release --lib "$ANDROID_JAR" --min-api "$MIN_SDK" --output "$OUT/dex" @"$OUT/classes.txt"

(cd "$OUT/dex" && zip -q -j "$OUT/unsigned.apk" classes.dex)
"$BUILD_TOOLS/zipalign" -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
"$BUILD_TOOLS/apksigner" sign --ks "$KEYSTORE" --ks-pass "file:$KEYPASS" --ks-key-alias home-redirect \
  --out "$OUT/firetv-home-redirect.apk" "$OUT/aligned.apk"
"$BUILD_TOOLS/apksigner" verify "$OUT/firetv-home-redirect.apk"

echo "Built $OUT/firetv-home-redirect.apk"
shasum -a 256 "$OUT/firetv-home-redirect.apk"
