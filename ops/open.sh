#!/bin/bash
# Opens an app in Xcode, ready to archive and upload.
#   ops/open.sh <slug>
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
app="$root/apps/$1"
[ -f "$app/app.json" ] || { echo "No app called $1. The apps are: $(ls "$root/apps" | tr '\n' ' ')"; exit 1; }
read -r target bundle shots < <(node "$root/ops/project.mjs" "$app")
(cd "$app" && xcodegen generate)
open "$app/$target.xcodeproj"
echo "Opened $target ($bundle). What to paste where is in apps/$1/UPLOAD.md."
