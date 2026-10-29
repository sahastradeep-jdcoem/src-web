#!/usr/bin/env bash
set -e

SDK_ROOT="$HOME/Library/Android/sdk"
BUILD_TOOLS="$SDK_ROOT/build-tools/34.0.0"
PLATFORM="$SDK_ROOT/platforms/android-34"

AAPT2="$BUILD_TOOLS/aapt2"
D8="$BUILD_TOOLS/d8"
ZIPALIGN="$BUILD_TOOLS/zipalign"
APKSIGNER="$BUILD_TOOLS/apksigner"
ANDROID_JAR="$PLATFORM/android.jar"

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$PROJECT_DIR/build"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/compiled_res" "$BUILD_DIR/gen" "$BUILD_DIR/classes"

echo "=== 1. Compiling resources with AAPT2 ==="
"$AAPT2" compile --dir "$PROJECT_DIR/src/main/res" -o "$BUILD_DIR/compiled_res/resources.zip"

echo "=== 2. Linking resources and generating R.java ==="
"$AAPT2" link "$BUILD_DIR/compiled_res/resources.zip" \
  -I "$ANDROID_JAR" \
  --manifest "$PROJECT_DIR/src/main/AndroidManifest.xml" \
  --java "$BUILD_DIR/gen" \
  -o "$BUILD_DIR/app-res.apk"

echo "=== 3. Compiling Java sources ==="
javac -encoding UTF-8 \
  -source 8 -target 8 \
  -g:none \
  -cp "$ANDROID_JAR:$BUILD_DIR/gen" \
  -d "$BUILD_DIR/classes" \
  "$BUILD_DIR/gen/in/srcjdcoem/payhook/R.java" \
  "$PROJECT_DIR/src/main/java/in/srcjdcoem/payhook/HttpPostWorker.java" \
  "$PROJECT_DIR/src/main/java/in/srcjdcoem/payhook/PaymentNotificationListenerService.java" \
  "$PROJECT_DIR/src/main/java/in/srcjdcoem/payhook/MainActivity.java"

echo "=== 4. Dexing bytecode with D8 ==="
jar cf "$BUILD_DIR/classes.jar" -C "$BUILD_DIR/classes" .
"$D8" --release --min-api 21 --output "$BUILD_DIR" --lib "$ANDROID_JAR" "$BUILD_DIR/classes.jar"

echo "=== 5. Packaging APK ==="
cp "$BUILD_DIR/app-res.apk" "$BUILD_DIR/app-unaligned.apk"
cd "$BUILD_DIR"
zip -u "$BUILD_DIR/app-unaligned.apk" classes.dex
cd "$PROJECT_DIR"

echo "=== 6. Zipalign APK ==="
"$ZIPALIGN" -f 4 "$BUILD_DIR/app-unaligned.apk" "$BUILD_DIR/src-payhook-unsigned.apk"

echo "=== 7. Signing APK with release keystore ==="
KEYSTORE="$BUILD_DIR/release.keystore"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -v -keystore "$KEYSTORE" -alias srcpayhook -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass srcjdcoem2026 -keypass srcjdcoem2026 \
    -dname "CN=SRC JDCOEM, OU=SRC, O=JDCOEM, L=Nagpur, ST=Maharashtra, C=IN"
fi

"$APKSIGNER" sign --ks "$KEYSTORE" --ks-pass pass:srcjdcoem2026 --key-pass pass:srcjdcoem2026 \
  --out "$PROJECT_DIR/src-payhook-release.apk" "$BUILD_DIR/src-payhook-unsigned.apk"

"$APKSIGNER" verify "$PROJECT_DIR/src-payhook-release.apk"

echo "SUCCESS! Production APK generated at: $PROJECT_DIR/src-payhook-release.apk"
ls -lh "$PROJECT_DIR/src-payhook-release.apk"
