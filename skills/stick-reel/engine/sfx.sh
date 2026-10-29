#!/bin/bash
# Synthesizes the SFX (+ optional music bed) from assets/sfx/cues.json into assets/sfx/mix.wav, then rebuilds.
set -euo pipefail
source "$(dirname "$0")/common.sh"
node src/build.mjs >/dev/null
"$PY" src/sfx.py
node src/build.mjs
