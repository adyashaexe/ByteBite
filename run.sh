#!/usr/bin/env bash
# ByteBite launcher (macOS / Linux). Works with any JDK 25 or newer (25 LTS, 26, ...).
# Code is always compiled with --release 25, i.e. against the stable LTS Java API.
set -e
cd "$(dirname "$0")"

# 1. Prefer JAVA_HOME, then the newest macOS JDK >= 25, then whatever javac is on PATH.
if [ -z "$JAVA_HOME" ] && [ -x /usr/libexec/java_home ]; then
  for v in 26 25; do
    if /usr/libexec/java_home -v "$v" >/dev/null 2>&1; then export JAVA_HOME="$(/usr/libexec/java_home -v "$v")"; break; fi
  done
fi
if [ -n "$JAVA_HOME" ] && [ -x "$JAVA_HOME/bin/javac" ]; then JAVAC="$JAVA_HOME/bin/javac"; else JAVAC="$(command -v javac || true)"; fi
if [ -z "$JAVAC" ]; then
  echo "❌ No JDK found. Install one:  brew install --cask temurin@25"; exit 1
fi

# 2. Always run with the java that belongs to the same JDK as javac (avoids class-version mismatches).
JAVA="$(dirname "$(readlink -f "$JAVAC" 2>/dev/null || echo "$JAVAC")")/java"
[ -x "$JAVA" ] || JAVA="$(dirname "$JAVAC")/java"

VER=$("$JAVAC" -version 2>&1 | sed -E 's/javac ([0-9]+).*/\1/')
if [ "$VER" -lt 25 ] 2>/dev/null; then
  echo "❌ Found JDK $VER, but ByteBite needs JDK 25 or newer."
  echo "   Install it:  brew install --cask temurin@25    (or: sdk install java 25-tem)"; exit 1
fi

echo "☕ Using JDK $VER ($("$JAVAC" -version 2>&1)) — compiling for Java 25 LTS …"
rm -rf out && mkdir -p out
"$JAVAC" --release 25 -d out backend/src/com/bytebite/*.java

PORT="${PORT:-8080}"
[ "$(uname)" = "Darwin" ] && (sleep 2 && open "http://localhost:$PORT") >/dev/null 2>&1 &
exec "$JAVA" -Dstdout.encoding=UTF-8 -cp out com.bytebite.Main
