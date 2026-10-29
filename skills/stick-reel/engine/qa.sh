#!/bin/bash
# Build, lint, snapshot and tile the frames with Instagram safe zones drawn on.
# usage: src/qa.sh                 transition midpoints + every scene's middle
#        src/qa.sh 1.2 3.4 7       exactly these times (seconds)
# Output: qa/safe.jpg (with zones: red = Instagram covers it, yellow = caption band, green = key-content box)
#         qa/sheet.jpg (clean frames). LOOK AT BOTH IMAGES before going on.
set -uo pipefail
source "$(dirname "$0")/common.sh"
node src/build.mjs || exit 1
if [ $# -gt 0 ]; then TIMES=$(IFS=,; echo "$*"); else
  TIMES=$(node -e "const q=require('./.stick-qa.json');const t=[...q.transitions,...q.middles].sort((a,b)=>a-b);console.log(t.slice(0,16).join(','))"); fi
rm -rf qa/snaps; mkdir -p qa
$HF snapshot --at "$TIMES" --no-end --output qa/snaps --describe false >/dev/null 2>qa/snapshot.log || { tail -20 qa/snapshot.log; exit 1; }
T=$(mktemp -d); i=0
for f in $(ls qa/snaps/*.png | grep -v contact | sort -V); do
  ffmpeg -v error -y -i "$f" -vf "drawbox=x=0:y=0:w=1080:h=260:color=red@0.3:t=fill,drawbox=x=0:y=1500:w=1080:h=420:color=red@0.3:t=fill,drawbox=x=950:y=1000:w=130:h=700:color=red@0.3:t=fill,drawbox=x=0:y=1320:w=1080:h=160:color=yellow@0.2:t=fill,drawbox=x=60:y=320:w=880:h=980:color=lime@0.9:t=4,scale=360:640" "$T/z$(printf %02d $i).png"
  ffmpeg -v error -y -i "$f" -vf "scale=360:640" "$T/c$(printf %02d $i).png"
  i=$((i+1)); done
C=$(( i < 6 ? i : 6 )); R=$(( (i + C - 1) / C ))
ffmpeg -v error -y -framerate 1 -i "$T/z%02d.png" -vf "tile=${C}x${R}:padding=8:color=black" -frames:v 1 qa/safe.jpg
ffmpeg -v error -y -framerate 1 -i "$T/c%02d.png" -vf "tile=${C}x${R}:padding=8:color=black" -frames:v 1 qa/sheet.jpg
rm -rf "$T"
echo "snapshots at: $TIMES"
echo "look at: $P/qa/sheet.jpg  and  $P/qa/safe.jpg"
$HF lint 2>&1 | tail -6
