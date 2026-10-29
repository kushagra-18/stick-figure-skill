#!/bin/bash
# Motion check on the rendered MP4: every frame between two times, tiled (smoothness, pops, doubled characters).
# usage: src/strip.sh renders/<slug>-final.mp4 4.6 5.4      -> qa/strip.jpg
set -euo pipefail
source "$(dirname "$0")/common.sh"
IN="$1"; A="$2"; B="$3"; mkdir -p qa
N=$(python3 -c "print(max(1,round(($B-$A)*30)))"); C=8; R=$(( (N + C - 1) / C ))
ffmpeg -v error -y -ss "$A" -i "$IN" -t "$(python3 -c "print($B-$A)")" -vf "fps=30,scale=200:-1,tile=${C}x${R}:padding=4" -frames:v 1 qa/strip.jpg
echo "look at: $P/qa/strip.jpg"
