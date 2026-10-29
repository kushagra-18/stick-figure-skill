#!/bin/bash
# Voiceover via Sarvam (Chandrika by default) for every line of story.json, then rebuild so cues re-sync.
# usage: src/voice.sh            all lines
#        src/voice.sh 3 5        only lines 3 and 5 (after editing their text)
set -euo pipefail
source "$(dirname "$0")/common.sh"
"$PY" src/voice_sarvam.py "$@"
node src/build.mjs
