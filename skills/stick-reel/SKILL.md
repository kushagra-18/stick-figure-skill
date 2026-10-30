---
name: stick-reel
description: Make smooth stick-figure story reels (Instagram/YouTube Shorts, 1080x1920, 25-60s) with HyperFrames — narrated mini-stories and explainers acted out by a cast of stick figures with real walk cycles, poses, faces, talking mouths, props, camera moves, scene transitions, karaoke captions, Sarvam voiceover and synthesized SFX. The model only writes a story.json; a bundled engine turns it into frame-perfect animation, so it works with any model (Gemini Flash, Claude, GPT). Use whenever the user asks for a stick figure / stickman / stick reel / "animated story" with simple characters, a story explainer acted out by figures, or a new episode/variation of a stick reel, even if they do not say "HyperFrames".
license: MIT
---

# Stick-figure story reels

Skill folder: the folder that contains this SKILL.md (call it `$K`; usually `~/.claude/skills/stick-reel`, `~/.gemini/skills/stick-reel` or `~/.agents/skills/stick-reel`).
Reels are created in `./videos/<slug>/` under the current directory (set `STICK_VIDEOS` to change it).
Reference story: `$K/examples/starter.json`.

**How it works.** You write ONE file, `story.json`: the narration lines, the cast, and per scene what each
character does on which spoken word. `node src/build.mjs` checks it, times it against the voiceover, and writes
`index.html`. A deterministic engine (`src/stick.js`) does all the animation: the rig, walk cycles, easing,
follow-through, facing turns, IK reaches, blinking, mouths, the camera, transitions and captions.
**Never write or edit `index.html`, GSAP or CSS yourself.** If the engine cannot do something, say so; do not hand-patch the output.

| Read | When |
|---|---|
| `$K/references/story-format.md` | Every time, before writing story.json (fields, cues, coordinates, the actions) |
| `$K/references/catalog.md` | Every time: the only valid pose / prop / set / expression / gesture names |
| `$K/references/craft.md` | Every time: hook, script rules, staging and motion direction, what the user dislikes |

## Workflow (do the steps in order)

### 1. Topic
If the user has not named a topic or story, ask for it and stop. Otherwise decide everything else yourself
(story, cast, look, voice) and state your choice in one line. Ask only about things only the user can give
(paid services, their accounts, files). Check facts with a web search when the reel states facts or numbers.

### 2. Script (lines first, visuals second)
Write 6-10 lines, ~90-150 words total (30-55 s at the default voice). One scene per line in most cases; a scene
can take 2 lines when the place and the action carry on. Follow `craft.md` (hook formula, full sentences, numbers
spelled out). Show the user the lines as a short table and keep going (do not wait unless they asked to approve).

### 3. Scaffold
```bash
$K/scripts/new-reel.sh <slug>          # e.g. new-reel.sh compound-interest
cd videos/<slug>
```

### 4. Write story.json, then check it with the plan
Put the lines in `"say"`, give every scene a set, characters and at least 2 timed actions on spoken words.
```bash
node src/build.mjs --plan      # timing table + every scene's spoken words with times — use these words as cues
node src/build.mjs             # writes index.html; on errors it prints exactly what to fix ("Did you mean ...")
```
Fix every error and re-run until it prints `wrote index.html`. Read the warnings too.

### 5. Look at it (QA loop — never skip)
```bash
src/qa.sh                      # snapshots at every transition + scene middle -> qa/sheet.jpg and qa/safe.jpg
```
Open and LOOK at both images (read them as images). Check: characters on the ground and not cut off, nothing
key in the red zones of `safe.jpg` (key content stays inside the green box), text not covering faces, each scene
shows what its line says, transitions mid-way look intentional. For a precise moment: `src/qa.sh 3.2 7.85`.
Fix story.json, run `src/qa.sh` again. Repeat until a sheet looks right.

### 6. Hook preview
`src/render.sh --hook 5` and give the user the full path of `renders/<slug>-hook.mp4` (`open` it on macOS).
Continue with the rest unless the user asked to approve the hook first.

### 7. Voice, SFX, final render
```bash
src/voice.sh            # Sarvam "chandrika" (Indian-English female) for every line -> cues re-sync automatically
src/qa.sh               # timings changed: look again
src/sfx.sh              # synthesized SFX (auto: pops, whooshes, thuds) + soft music bed if story.json has "music"
src/render.sh           # -> renders/<slug>-final.mp4 at -14 LUFS, prints the full path
src/strip.sh renders/<slug>-final.mp4 <t0> <t1>   # optional: every frame of a moment, to check motion
```
`src/voice.sh 3 5` regenerates only lines 3 and 5. If whisper warns that a take differs from the script, listen,
then re-roll that line. Words the TTS says wrong go in `"pronounce"` (TTS-only respelling).

### 8. Deliver
- The full absolute path of `renders/<slug>-final.mp4` and its length.
- A short table: scene → what happens.
- The upload pack, saved to `CAPTION.md` in the project, EVERY time: title (ends with #shorts), caption (2-4
  short lines + a question to drive comments), sources with working links if the reel states facts, 10-12 hashtags.
- Anything not done or uncertain.

## Rules that keep the output good
- Every visible change happens ON a spoken word (`"at": "money"`), never at a guessed second, except small offsets
  like `"money+0.3"`. Swapping the voice then keeps everything in sync.
- One idea per scene. The visual must SHOW the line (the line says "car" → a car appears on "car").
- Keep the cast consistent: define each character once in `"cast"` (hair + colour) and reuse the id in every scene.
- Prefer side views (`facing: left/right`) for walking, sitting, lying, pushing, kneeling. Use `front` for talking to camera, shrugging, cheering.
- Do not put text over faces, and never repeat the narration as on-screen text (captions already show it).
  On-screen text = a short sticker, number, label or name (≤ 3 words is best).
- Keep scenes at 4-8 s. If a scene has nothing new for 3 s, add an action (gesture, expression, prop, camera push).
- Never cut: every scene has a transition (default `whip`).

## Troubleshooting
| Symptom | Fix |
|---|---|
| `cue word "x" is not spoken in scene` | Use a word from `--plan`'s list for THAT scene (cues are per scene) |
| Character floats / sinks | Leave `y` out (ground is automatic). Only set `y` to stand on something (a box top) |
| Character sits beside the chair | `chair` x must equal the character's x; use `facing: right` with the chair's back on the left |
| Snapshot shows a blank frame | `node src/build.mjs` failed — run it and read the error |
| `npx hyperframes` rewritten / broken by a shell hook | Run the `src/*.sh` scripts (they call the pinned CLI directly), or prefix `rtk proxy` |
| Voice: `SARVAM_API_KEY not found` | Put `SARVAM_API_KEY=...` in a `.env` in the project or a parent folder, in `~/.config/stick-reel/.env`, or export it. Never copy or print the key |
| `ModuleNotFoundError: numpy/soundfile/scipy` | `pip install -r $K/requirements.txt` (or set `STICK_PY` to a python that has them) |
| Render is slow or dies silently | Check free disk space; close other renders |
