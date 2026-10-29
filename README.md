# stick-reel

An agent skill that makes **smooth stick-figure story reels** (Instagram Reels / YouTube Shorts, 1080×1920)
with [HyperFrames](https://hyperframes.heygen.com). You ask for a reel about a topic; the agent writes a short
script and one `story.json`; a bundled engine animates it: real walk cycles, 48 poses, gestures, faces and
talking mouths, props, camera moves, scene transitions, karaoke captions, voiceover and sound effects.

It is **model-agnostic**: the model never writes animation code, only a validated JSON story, so cheap models
(Gemini Flash, Haiku, GPT mini) produce the same smooth motion as big ones.

## Install (one line)

```bash
curl -fsSL https://raw.githubusercontent.com/kushagra-18/stick-figure-skill/main/install.sh | bash
```
or clone and run `./install.sh`. It links the skill into `~/.claude/skills`, `~/.agents/skills` and, when
installed, Gemini CLI / Antigravity (`~/.gemini/...`), opencode and Codex. Re-run it to update.

Then restart your agent and ask: **"make a stick figure reel about why we procrastinate"**.

## Requirements
- Node 18+ and ffmpeg (rendering uses `npx hyperframes`, downloaded on first use)
- Optional, for voice + SFX: Python 3 with `numpy soundfile scipy` (`pip install -r skills/stick-reel/requirements.txt`)
- Optional voiceover: a [Sarvam AI](https://www.sarvam.ai) key in `~/.config/stick-reel/.env` as `SARVAM_API_KEY=...`
  (without it, reels still build and render; use any voice you like by dropping per-line WAVs in `assets/vo/`)

## What a reel project looks like
```
videos/<slug>/
  story.json          ← the only file the agent edits
  src/                ← engine + helper scripts (build, qa, voice, sfx, render)
  renders/<slug>-final.mp4
```
Commands inside a project: `node src/build.mjs --plan` · `src/qa.sh` · `src/voice.sh` · `src/sfx.sh` · `src/render.sh`.

## Layout
- `skills/stick-reel/SKILL.md` — the workflow the agent follows
- `skills/stick-reel/references/` — story format, catalog of names, craft rules
- `skills/stick-reel/engine/` — `stick.js` (animation engine), `build.mjs` (compiler + validator), helpers
- `skills/stick-reel/examples/starter.json` — a complete 30 s example reel

## License
Code: MIT. Fonts in `skills/stick-reel/assets/fonts/` (Kalam, Fredoka): SIL Open Font License 1.1.
