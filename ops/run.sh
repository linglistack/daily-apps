#!/bin/bash
# Proves an app builds and runs, and makes its icon and screenshots. Needs a Mac with Xcode.
#   ops/run.sh <app folder> <where to put icon.png and screenshots/>
# It builds the app, starts it once as a new user and once for each screenshot (`-shot 1`, …),
# checks it is still running each time, and saves a picture of every screen. Lines beginning
# "error:" are what the gate quotes back to the job that wrote the app.
set -uo pipefail

app=${1%/}
out=${2:-out}
root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
mkdir -p "$out/screenshots"

read -r target bundle shots < <(node "$root/ops/project.mjs" "$app") || { echo "error: app.json could not be read"; exit 1; }

icon="$app/Assets.xcassets/AppIcon.appiconset/icon.png"
swift "$root/ops/icon.swift" "$app/icon.json" "$icon" || { echo "error: the icon could not be drawn from icon.json"; exit 1; }
cp "$icon" "$out/icon.png"

(cd "$app" && xcodegen generate > /dev/null) || { echo "error: xcodegen could not make the project"; exit 1; }

# The largest iPhone the installed Xcode has: its screenshots are the size the App Store asks for.
device=$(xcrun simctl list devices available | grep -E 'iPhone [0-9]+ Pro Max' | sort -V | tail -1 | grep -oE '[0-9A-F]{8}-[0-9A-F-]{27}')
[ -n "$device" ] || { echo "error: no iPhone Pro Max simulator is installed"; exit 1; }

if ! xcodebuild -project "$app/$target.xcodeproj" -scheme "$target" -configuration Debug \
    -destination "id=$device" -derivedDataPath "$work/dd" CODE_SIGNING_ALLOWED=NO build > "$work/build.log" 2>&1; then
  grep -E 'error:' "$work/build.log" | sed -E "s#^.*/$app/##" | sort -u | head -40
  echo "error: the app does not build"
  exit 1
fi
built="$work/dd/Build/Products/Debug-iphonesimulator/$target.app"

# What a picture shows: "black=<share> colours=<count>" (ops/looks.swift).
swiftc -O "$root/ops/looks.swift" -o "$work/looks" 2> /dev/null || { echo "error: ops/looks.swift does not compile"; exit 1; }
looks() { "$work/looks" "$@" 2>/dev/null; }
field() { sed -E "s/.*$1=([0-9.]+).*/\1/"; }

xcrun simctl boot "$device" > /dev/null 2>&1
xcrun simctl bootstatus "$device" -b > /dev/null 2>&1
xcrun simctl ui "$device" appearance light > /dev/null 2>&1
# A simulator says it has started before its screen has: wait until the screen is no longer black.
ready=no
for try in $(seq 1 60); do
  xcrun simctl io "$device" screenshot "$work/ready.png" > /dev/null 2>&1
  black=$(looks one "$work/ready.png" | field black)
  if [ -n "$black" ] && awk "BEGIN { exit !($black < 0.90) }"; then ready=yes; break; fi
  sleep 5
done
[ "$ready" = yes ] || { echo "error: the simulator's screen stayed black for five minutes"; exit 1; }
xcrun simctl status_bar "$device" override --time "9:41" --batteryState discharging --batteryLevel 100 --cellularBars 4 > /dev/null 2>&1
xcrun simctl install "$device" "$built" || { echo "error: the app could not be installed in the simulator"; exit 1; }

# Whether a picture shows a screen with nothing drawn on it: one colour from the status bar down.
blank() { local flat; flat=$(looks one "$1" | field flat); [ -z "$flat" ] || awk "BEGIN { exit !($flat > 0.9995) }"; }

# Starts the app with the arguments given, waits until it has drawn its screen, and says whether it
# is still running. A busy Mac shows the app's empty launch screen for many seconds first, and a
# picture taken then is a white screen: that happened on 12 October 2026, five seconds after launch.
alive() {
  local pid try
  pid=$(xcrun simctl launch --terminate-running-process "$device" "$bundle" "$@" 2>/dev/null | awk '{print $NF}')
  sleep 2
  for try in $(seq 1 45); do
    xcrun simctl io "$device" screenshot "$work/drawn.png" > /dev/null 2>&1
    blank "$work/drawn.png" || break
    sleep 1
  done
  # What a screen opens by itself (a sheet, a detail) slides in after the first screen is drawn.
  sleep "${WAIT:-3}"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

# As a new user would open it: no sample data, nothing saved yet.
alive || { echo "error: the app stops when it is first opened, with nothing saved"; exit 1; }
xcrun simctl io "$device" screenshot "$work/first.png" > /dev/null 2>&1
if blank "$work/first.png"; then echo "error: the app shows an empty screen when it is first opened, with nothing saved: nothing is drawn on it"; exit 1; fi

for n in $(seq 1 "$shots"); do
  alive -shot "$n" || { echo "error: the app stops when started with -shot $n"; exit 1; }
  xcrun simctl io "$device" screenshot "$work/$n.png" > /dev/null 2>&1 || { echo "error: no picture could be taken of screen $n"; exit 1; }
  seen=$(looks one "$work/$n.png")
  black=$(echo "$seen" | field black); colours=$(echo "$seen" | field colours)
  [ -n "$black" ] || { echo "error: the picture of screen $n could not be read"; exit 1; }
  if awk "BEGIN { exit !($black > 0.97) }"; then echo "error: the screen shown for -shot $n is black"; exit 1; fi
  if blank "$work/$n.png"; then echo "error: the screen shown for -shot $n is blank: nothing is drawn on it"; exit 1; fi
  if [ "$colours" -lt 14 ]; then echo "error: the screen shown for -shot $n is empty (only $colours colours on it)"; exit 1; fi
  # Each screenshot has to show a different screen from every one before it.
  for ((m = 1; m < n; m++)); do
    differs=$(looks same "$work/$m.png" "$work/$n.png" | field differs)
    if awk "BEGIN { exit !(${differs:-0} < 0.02) }"; then echo "error: -shot $m and -shot $n show the same screen: each number has to open a different one"; exit 1; fi
  done
  sips -s format jpeg -s formatOptions 88 "$work/$n.png" --out "$out/screenshots/$n.jpg" > /dev/null 2>&1
done

xcrun simctl terminate "$device" "$bundle" > /dev/null 2>&1
xcrun simctl uninstall "$device" "$bundle" > /dev/null 2>&1
echo "ok: $target builds, opens and shows $shots different screens"
