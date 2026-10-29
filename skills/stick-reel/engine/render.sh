#!/bin/bash
# Render the reel. Final file: renders/<slug>-final.mp4 (loudness -14 LUFS when there is audio).
# usage: src/render.sh            full reel
#        src/render.sh --hook 5   only the first 5 s -> renders/<slug>-hook.mp4 (for an early look)
set -euo pipefail
source "$(dirname "$0")/common.sh"
mkdir -p renders
if [ "${1:-}" = "--hook" ]; then
  node src/build.mjs --until "${2:-5}" >/dev/null
  $HF render --quality high --output "renders/$SLUG-hook.mp4" 2>&1 | tail -3
  node src/build.mjs >/dev/null
  echo "HOOK: $P/renders/$SLUG-hook.mp4"; exit 0
fi
node src/build.mjs
$HF render --quality high --output "renders/$SLUG-raw.mp4" 2>&1 | tail -3
[ -s "renders/$SLUG-raw.mp4" ] || { echo "render failed (check disk space and the log above)"; exit 1; }
if ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "renders/$SLUG-raw.mp4" | grep -q .; then
  ffmpeg -v error -y -i "renders/$SLUG-raw.mp4" -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 192k -ar 48000 "renders/$SLUG-final.mp4"
else cp "renders/$SLUG-raw.mp4" "renders/$SLUG-final.mp4"; fi
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "renders/$SLUG-final.mp4")
echo "FINAL: $P/renders/$SLUG-final.mp4  (${D}s)"
