#!/usr/bin/env bash
# stick-reel installer: puts the skill where Claude Code, Gemini CLI / Antigravity, opencode and other
# agents look for skills. Safe to re-run (it also updates).
#
#   curl -fsSL https://raw.githubusercontent.com/kushagra-18/stick-figure-skill/main/install.sh | bash
#   or, from a clone:  ./install.sh
set -euo pipefail
REPO="${STICK_REEL_REPO:-https://github.com/kushagra-18/stick-figure-skill.git}"
HOME_DIR="${STICK_REEL_HOME:-$HOME/.local/share/stick-reel}"

# 1. get the files (use this clone if we are inside one, else clone/update into ~/.local/share/stick-reel)
HERE="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
if [ -n "$HERE" ] && [ -f "$HERE/skills/stick-reel/SKILL.md" ]; then
  SRC="$HERE/skills/stick-reel"
else
  command -v git >/dev/null || { echo "git is required"; exit 1; }
  if [ -d "$HOME_DIR/.git" ]; then git -C "$HOME_DIR" pull --ff-only -q; else git clone --depth 1 -q "$REPO" "$HOME_DIR"; fi
  SRC="$HOME_DIR/skills/stick-reel"
fi

# 2. link it into every agent's skills folder (Claude is always set up; others only if that agent is installed)
link() {
  local dir="$1"; mkdir -p "$dir"
  local dest="$dir/stick-reel"
  if [ -e "$dest" ] && [ ! -L "$dest" ]; then mv "$dest" "$dest.bak.$(date +%s)"; echo "  (moved an old copy to $dest.bak.*)"; fi
  ln -sfn "$SRC" "$dest"; echo "  ✓ $dest"
}
echo "Installing stick-reel skill from $SRC"
link "$HOME/.claude/skills"
[ -d "$HOME/.gemini" ] && link "$HOME/.gemini/skills"
[ -d "$HOME/.gemini/antigravity" ] && link "$HOME/.gemini/antigravity/skills"
[ -d "$HOME/.config/opencode" ] && link "$HOME/.config/opencode/skills"
[ -d "$HOME/.codex" ] && link "$HOME/.codex/skills"
link "$HOME/.agents/skills"
chmod +x "$SRC"/engine/*.sh "$SRC"/scripts/*.sh "$SRC"/scripts/*.mjs "$SRC"/engine/build.mjs 2>/dev/null || true

# 3. check what the pipeline needs
echo "Checking requirements"
ok() { echo "  ✓ $1"; }; miss() { echo "  ✗ $1 — $2"; }
if command -v node >/dev/null && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 18 ]; then ok "node $(node -v)"; else miss "node >= 18" "https://nodejs.org"; fi
command -v ffmpeg >/dev/null && ok "ffmpeg" || miss "ffmpeg" "brew install ffmpeg / apt install ffmpeg"
PY="${STICK_PY:-python3}"
if "$PY" -c "import numpy, soundfile, scipy" 2>/dev/null; then ok "python: numpy soundfile scipy"
else miss "python packages (voice + sfx only)" "$PY -m pip install -r $SRC/requirements.txt   (or set STICK_PY to a venv python)"; fi
echo
echo "Done. Restart your agent, then ask: \"make a stick figure reel about <topic>\"."
echo "Optional voiceover: put SARVAM_API_KEY=... in ~/.config/stick-reel/.env"
