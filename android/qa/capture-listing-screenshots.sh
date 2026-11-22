#!/usr/bin/env bash
# Capture listing-grade screenshots of the real app on a booted emulator,
# against the runner-local disposable backend (adb reverse 8765 -> 3189).
# Requires: adb in PATH, ANDROID_SERIAL set, QA APK built.
set -u
OUT=${1:-shots}
APK=${2:-android/app/build/outputs/apk/qa/app-qa.apk}
PKG=com.frpboy.threadly.qa
mkdir -p "$OUT"

ADB_BIN="$(command -v adb)"
adb() { timeout --kill-after=5s 30s "$ADB_BIN" "$@"; }

adb install -r "$APK" || exit 1

dump_ui() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  adb pull /sdcard/ui.xml /tmp/ui.xml >/dev/null 2>&1
}

shot() { adb exec-out screencap -p > "$OUT/$1.png"; echo "captured $1"; }

coords_of() {
  python3 - "$1" <<'PYEOF'
import re, sys
label = sys.argv[1]
try:
    xml = open('/tmp/ui.xml', encoding='utf-8', errors='ignore').read()
except OSError:
    sys.exit(0)
pats = [
    r'text="' + re.escape(label) + r'"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
    r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*text="' + re.escape(label) + r'"',
]
for p in pats:
    m = re.search(p, xml)
    if m:
        print((int(m.group(1)) + int(m.group(3))) // 2, (int(m.group(2)) + int(m.group(4))) // 2)
        break
PYEOF
}

tap_on_text() {
  local label="$1" coords
  dump_ui
  coords=$(coords_of "$label")
  if [ -n "$coords" ]; then
    echo "tap '$label' at $coords"
    adb shell input tap $coords
    sleep 3
    return 0
  fi
  echo "WARN: '$label' not found on screen"
  return 1
}

wait_for_text() {
  local label="$1" tries="${2:-20}"
  for i in $(seq 1 "$tries"); do
    dump_ui
    if grep -qF "$label" /tmp/ui.xml 2>/dev/null; then return 0; fi
    sleep 2
  done
  echo "WARN: timed out waiting for '$label'"
  return 1
}

# Type into the on-screen text field (first EditText) and submit via the Guess button.
enter_guess() {
  local word="$1" coords
  dump_ui
  coords=$(python3 - <<'PYEOF'
import re
import sys
try:
    xml = open('/tmp/ui.xml', encoding='utf-8', errors='ignore').read()
except OSError:
    sys.exit(0)
m = re.search(r'class="android.widget.EditText"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml)
if not m:
    m = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*class="android.widget.EditText"', xml)
if m:
    print((int(m.group(1)) + int(m.group(3))) // 2, (int(m.group(2)) + int(m.group(4))) // 2)
PYEOF
)
  if [ -z "$coords" ]; then echo "WARN: no EditText on screen"; return 1; fi
  adb shell input tap $coords
  sleep 1
  adb shell input text "$1"
  sleep 1
  adb shell input keyevent KEYCODE_BACK  # hide keyboard so the Guess button is visible
  sleep 1
  tap_on_text "Guess"
}

adb shell input keyevent KEYCODE_WAKEUP
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 12

# Onboarding (first run of a fresh install)
shot 01-onboarding-1
tap_on_text "Next" || true
shot 02-onboarding-2
tap_on_text "Next" || true
shot 03-onboarding-3
tap_on_text "Next" || true
shot 04-onboarding-4
tap_on_text "Start" || tap_on_text "Skip" || true

# Open store-native mode self-enrolls silently; wait for the game screen.
wait_for_text "Player ID:" 40 || true
sleep 2
shot 05-game-first-clue

# Two wrong guesses: clues accumulate and the guesses list shows real state.
enter_guess "anchor"
sleep 4
shot 06-game-one-wrong
enter_guess "lantern"
sleep 4
shot 07-game-two-wrong

# Scroll evidence: the column is scrollable; a swipe must reveal the
# feedback line that sits below the fold at scroll position 0.
adb shell input swipe 540 1500 540 700
sleep 2
shot 07b-scrolled-feedback
adb shell input swipe 540 700 540 1500
sleep 2

# Correct answer: solved state with points and streak.
enter_guess "compass"
sleep 5
shot 08-solved

# Scroll evidence: solved screen scrolled down must fully reveal the
# stats section whose heading peeks at the fold in 08.
adb shell input swipe 540 1500 540 600
sleep 2
shot 08b-scrolled-stats
adb shell input swipe 540 600 540 1500
sleep 2

# Deletion dialog (trust surface, matches the published privacy policy), then Cancel.
tap_on_text "Delete my data" || true
sleep 1
shot 09-delete-dialog
tap_on_text "Cancel" || true

ls -la "$OUT"
