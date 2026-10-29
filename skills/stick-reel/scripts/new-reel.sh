#!/bin/bash
# Scaffold a new stick-figure reel project.
# usage: new-reel.sh <slug> [template]     e.g. new-reel.sh lifestyle-creep
#   template = a story.json to start from (default: the skill's examples/starter.json)
# Creates $STICK_VIDEOS/<slug>/ (default ./videos/<slug>/ under the current directory).
set -euo pipefail
SLUG="${1:?usage: new-reel.sh <slug> [template.json]}"
K="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${STICK_VIDEOS:-$PWD/videos}"
P="$BASE/$SLUG"
[ -e "$P" ] && { echo "exists: $P (pick another slug, or work in it)"; exit 1; }
mkdir -p "$P"/{src,assets/fonts,assets/vo,assets/sfx,renders,qa}
cp "$K"/engine/* "$P/src/"
chmod +x "$P"/src/*.sh "$P/src/build.mjs"
cp "$K"/assets/fonts/* "$P/assets/fonts/"
cp "${2:-$K/examples/starter.json}" "$P/story.json"
cat > "$P/package.json" <<JSON
{
  "name": "$SLUG",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node src/build.mjs",
    "qa": "src/qa.sh",
    "render": "src/render.sh",
    "dev": "npx --yes hyperframes@0.8.162 preview"
  }
}
JSON
cat > "$P/hyperframes.json" <<'JSON'
{
  "$schema": "https://hyperframes.heygen.com/schema/hyperframes.json",
  "paths": { "blocks": "compositions", "components": "compositions/components", "assets": "assets" },
  "media": { "autoProxy": true }
}
JSON
cat > "$P/AGENTS.md" <<MD
# Stick-figure reel: $SLUG

This project is generated. **Edit only \`story.json\`.** \`index.html\` is rebuilt from it by \`node src/build.mjs\`.
Full guide: \`$K/SKILL.md\`. Story format: \`$K/references/story-format.md\`.

| Step | Command (run in this folder) |
|---|---|
| Check timing and the spoken words you can use as cues | \`node src/build.mjs --plan\` |
| Build + snapshots + safe zones (then look at qa/sheet.jpg and qa/safe.jpg) | \`src/qa.sh\` |
| Render the first 5 s | \`src/render.sh --hook 5\` |
| Voiceover (Sarvam), then rebuild | \`src/voice.sh\` |
| Sound effects + music bed | \`src/sfx.sh\` |
| Final render | \`src/render.sh\` |
| Motion check of a moment in the MP4 | \`src/strip.sh renders/$SLUG-final.mp4 4.5 5.5\` |
MD
ln -s AGENTS.md "$P/CLAUDE.md"; ln -s AGENTS.md "$P/GEMINI.md"
printf 'renders/*.mp4\nqa/\n.hyperframes/\nnode_modules/\n' > "$P/.gitignore"
echo "Scaffolded $P"
echo "Next: write story.json, then: cd $P && node src/build.mjs --plan && src/qa.sh"
