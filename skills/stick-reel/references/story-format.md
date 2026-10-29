# story.json — the format

The whole reel is this one JSON file. Valid names for poses, props, sets, etc. are in `catalog.md`.
Full working example: `examples/starter.json` in the skill folder.

## Coordinates (memorise these)
- Canvas 1080 × 1920. x grows right, y grows DOWN.
- **Ground line y = 1250.** Characters and ground props stand on it automatically: leave `y` out.
- A size-1 person is 520 px tall: feet at 1250, head top ≈ 730. `size: 0.7` = a kid.
- **Key content safe box: x 60-940, y 320-1300.** Instagram covers y < 260, y > 1500 and the right edge
  x > 950 between y 1000-1700. Captions sit automatically at y 1320-1480.
- Characters: x 150-900. One character: x 540. Two talking: x 330 and 750, facing each other. Three: 220 / 540 / 860.
- Titles: y 380-520. Stickers, counters, floating props: y 430-700 (above heads). Labels next to things: anywhere in the box.
- The camera starts at x 540, y 960, zoom 1 (shows exactly the canvas). Zoom 1.2-1.4 = closer.

## Top level
(The `//` comments in these examples are explanations only. JSON cannot contain comments: never write them in story.json.)
```json
{
  "title": "The raise trap",          // shown nowhere, used for the page title
  "theme": "paper",                   // paper | chalk | night | sky | blueprint | sunset   (per-scene override allowed)
  "accent": "red",                    // highlight colour: captions' current word, *starred* title words, stickers
  "font": "Kalam",                    // Kalam (hand-lettered, default) or Fredoka (rounded)
  "voice": "chandrika",               // folder in assets/vo/ that src/voice.sh fills
  "captions": true,
  "captionReplace": { "fifty thousand": "₹50,000" },   // show spoken words differently in captions
  "pronounce": { "THC": "T.H.C." },   // TTS-only respellings (captions keep the script spelling)
  "music": 0.18,                      // soft music-box bed at this gain (0.12-0.25), or omit for none
  "sfx": true,                        // automatic SFX on pops, transitions, jumps, falls (default true)
  "bar": false,                       // retention bar racing to 99% (optional)
  "fps": 30,                          // 30 default; 60 for extra-smooth motion (renders 2x slower)
  "cast": {
    "kai": { "hair": "tuft", "color": "blue", "acc": ["tie"] },
    "mia": { "hair": "bob", "color": "red", "size": 1 }
  },
  "scenes": [ ... ]
}
```
Cast fields: `hair` (catalog), `color` (accent of hair/hat/tie), `acc` (list), `size` (1 adult, 0.7 kid, 1.3 giant),
`ink` (body colour, default theme ink — e.g. `"red"` for a villain), `headFill`, `limbs: "bendy"` (rubber-hose arms/legs), `weight` (line thickness ×).

## Scene
```json
{
  "id": "hook",                                   // unique, short
  "say": "Kai got a raise, and somehow he is more broke than before.",
  "speaker": "kai",                               // optional: this character's mouth moves on these words
  "set": "office",                                // background (catalog: void, room, office, street, park, ...)
  "theme": "chalk",                               // optional per-scene look (e.g. a flashback)
  "transition": "whip",                           // how we LEAVE this scene into the next (see below)
  "camera": [ { "at": "money", "zoom": 1.3, "x": 600, "y": 900, "dur": 0.8 } ],
  "follow": "kai",                                // camera follows a walking character (or {"id":"kai","dx":120})
  "shake": [ { "at": "boom", "dur": 0.5, "amp": 22 } ],
  "chars": [ ... ], "props": [ ... ], "texts": [ ... ],
  "sfx": [ { "at": "door", "kind": "creak", "gain": 0.3 } ]
}
```
- `say`: a string = one voice line. A list = several lines in this scene. A line spoken by a character:
  `{"text": "...", "by": "mia"}` (her mouth moves and her hand gestures).
- A silent scene: no `say`, give `"dur": 2`.
- Optional timing: `lead` (pause before the first word, default 0.3), `tail` (after the last word, 0.55), `hold` (extra seconds).
- `decor`: extra background props, e.g. `[{"kind":"tree","x":900,"y":1250,"depth":0.6,"soft":true}]` (depth < 1 = far, slower parallax; soft = faded colour).
- `ground: false` hides the ground line (space, dreams). `groundY` moves it.

### Cues: WHEN things happen (`at`, `show`, `hide`, `until`)
| Cue | Meaning |
|---|---|
| `"money"` | when the word "money" starts (first time in THIS scene) |
| `"money#2"` | its 2nd occurrence |
| `"money.end"` | when the word ends |
| `"money+0.3"` / `"money-0.2"` | offset in seconds (works with all forms: `"money#2.end+0.1"`) |
| `"start"`, `"end"` | scene start / the end of the scene's last word |
| `"line2"` | start of the scene's 2nd line |
| `1.2` (number) | seconds after the scene starts — only for the very beginning of a scene |
Words are lowercase without punctuation (`"can't"` stays). Run `node src/build.mjs --plan` to list them.

### Transitions (`transition`, into the next scene)
`whip` (fast slide + blur, default: change of place) · `push` (slide, same world continuing) · `slideUp` ·
`zoom` (into a bigger idea) · `dissolve` (mood change, "later...") · `dip` (through the background colour) ·
`iris` (cartoon circle opening on the next scene; `{"kind":"iris","focus":"kai"}` opens on a character) ·
`wipe` · `cut` (avoid). Options: `{"kind":"push","dir":"right","dur":0.6}`.

## Characters (`chars`)
```json
{ "id": "kai", "x": 300, "facing": "right", "pose": "stand", "expr": "happy",
  "enter": "pop", "exit": { "at": "end", "style": "walk" },
  "do": [
    { "at": "came", "act": "walk", "to": 700 },
    { "at": "phone", "act": "pose", "pose": "phone" },
    { "at": "car", "act": "expr", "expr": "excited" }
  ] }
```
- `facing`: `right`, `left`, `front` (to camera). Turns are animated through the front view automatically.
- `enter`: `"pop"`, `"fade"`, `"draw"` (strokes draw on), `"walk"`/`"run"` (walks in from the nearer edge to x), or
  `{"at": "word", "style": "pop"}`. Without `enter` the character is there from the start.
- `exit`: `"fade"`, `"pop"`, `"walk"`/`"run"` (walks off), `{"at": "...", "style": "...", "to": "left"}`.
- `y`: only to stand ON something (y = that surface). `float: true` = no ground (flying, space).
- `arms: "keep"`: arms keep the pose while walking (auto when holding a prop).

### Actions (`do`) — every action has `"at"` (a cue) and `"act"`
| act | fields | does |
|---|---|---|
| `pose` | `pose`, `dur` (0.45), `ease`, joint overrides | blends smoothly into a pose (with follow-through). Example override: `{"act":"pose","pose":"stand","sF":150}` raises the near arm |
| `expr` | `expr` | changes the face |
| `walk` `run` `sneak` `hop` `slide` | `to`: x, `[x,y]`, a char id (stops beside them) or prop id; or `by`: dx; optional `dur`/`speed`, `face: "keep"` (moonwalk) | moves with a real gait synced to the distance; faces the direction automatically |
| `jump` | `to` (optional x), `height` (0.35 = of body height), `dur` (0.9) | crouch, leap, land |
| `fall` | `dur`, optional `y` (land ON something: bed top = 1140), `x`, `pose` (`lie` = flat on the back) | falls (thud SFX) |
| `face` | `to`: `left`/`right`/`front`/a char or prop id | turns |
| `gesture` | `kind`, `dur` (1.2) or `until` | wave, nod, no, laugh, clap, dance, typing, cry, tremble, bounce, ... (catalog) |
| `emote` | `icon`, `dur` | pops an icon over the head: `!`, `?`, `heart`, `idea`, `sweat`, `anger`, `zzz`, ... |
| `reach` | `to`: `[x,y]`, prop id, `"mia.hand"`/`"mia.head"`, `hand` (F/B), `dur` | the arm reaches (IK) and returns |
| `hold` | `prop`, `hand` | the prop jumps to the hand and follows it |
| `drop` | `prop`, optional `into`: prop id | lets go: falls to the ground, or arcs INTO a prop (bag, bin) and vanishes |
| `give` | `prop`, `to`: char id, `dur` (0.8) | both reach, the prop changes hands |
| `talk` | `dur` or `until` | mouth moves (use `by` on lines instead when the character speaks a narration line) |
| `lookCamera` | `dur` | turns the head to the viewer for a moment |
| `grow` | `to` (scale, e.g. 1.6 or 0.5), `dur` | the character grows/shrinks (metaphors: "feel small") |

Joint names for overrides (degrees): `lean` torso (+ forward), `head` (+ down), arms `sF`/`sB` (0 = hanging,
90 = straight forward, 180 = straight up), elbows `eF`/`eB`, legs `hF`/`hB`, knees `kF`/`kB`, `spF`/`spB` arm
spread to the side (seen from the front). F = near limb, B = far limb. Usually you only need named poses.

## Props (`props`)
```json
{ "id": "bag", "kind": "moneybag", "x": 830, "show": "saved", "in": "drop", "hide": "end", "out": "pop",
  "scale": 1, "rot": 0, "flip": false, "color": "gold", "z": "front",
  "anim": [ { "at": "grows", "scale": 1.4, "dur": 0.5, "ease": "back.out(2)" } ] }
```
- `x`, `y`: ground props (anchor "bottom" in the catalog) default to the ground — leave `y` out. Centre-anchored
  props (coin, heart, bulb, cloud...) need a `y`, e.g. 520 to float above heads.
- `show` / `hide`: cues. Without `show` it is there from the start. `in`: `pop` (default), `fade`, `drop` (falls in
  with a bounce), `grow`, `draw` (line art draws on), `slide` (`from: "left"`). `out`: `pop`, `fade`, `fly` (flies up).
- `heldBy: "kai"` = in Kai's hand from the start (see also the `hold`/`drop`/`give` actions).
- `anim`: keyframes of `x`, `y`, `rot`, `scale`, `opacity`, `value` — each eases from where it was.
- `float: 12` (gentle bob, px), `spin: 90` (deg/s), `bob: 6` (wobble deg).
- `value` drives live props: `battery` 0-1, `meter` 0-1, `clock` hours (animate 9 → 17 to spin), `chart`/`graph` (grow-in progress).
- `text` on sign, placard, board, calendar, laptop, monitor, tv, shop, grave, boom. `values: [..]` on chart/graph.
- `z`: `front` (default, before characters), `back` (behind characters), `near` (foreground layer).

## Texts (`texts`)
```json
{ "type": "sticker", "text": "SAVED ₹10,000", "x": 540, "y": 640, "show": "saved", "hide": "end", "color": "yellow" }
```
| type | look | notes |
|---|---|---|
| `title` | big lettering with a halo | hook titles; `*word*` = accent colour |
| `sticker` | rotated card with hard shadow | 1-3 word punchlines, numbers; `color` = card colour |
| `label` | handwritten, writes on | name things; `size` 40-70 |
| `note` | small handwritten | side remarks |
| `bubble` | speech bubble | `"by": "mia"` places it over her head with a tail |
| `thought` | thought cloud | `"by": "kai"` |
| `counter` | big number counting up | `from`, `to`, `dur`, `prefix` ("₹", "$"), `suffix` ("%"), `decimals` |
| `arrow` | hand-drawn arrow that draws on | `from: [x,y]` or an id, `to`: id or `"mia.head"`, `bend` |
| `circle` / `underline` / `strike` | hand-drawn ring / underline / cross-out | `to`: an id, or `x`,`y`; `rx`, `ry` |
Common: `show`, `hide`, `in` (`pop`, `fade`, `rise`, `write`, `draw`), `out`, `size`, `rot`, `color`, `wiggle: true`,
`screen: true` (pinned to the screen instead of the world), `near: "id"` + `offset: [dx, dy]`, `maxChars` (line wrap).

## A complete small scene
```json
{
  "id": "office",
  "say": "Every day at five, Raj stares at his laptop, waiting for the clock.",
  "set": "office", "transition": "push",
  "camera": [ { "at": "clock", "zoom": 1.25, "x": 700, "y": 860, "dur": 0.9 } ],
  "chars": [ { "id": "raj", "x": 520, "facing": "right", "pose": "sit", "expr": "bored",
    "do": [ { "at": "stares", "act": "gesture", "kind": "typing", "until": "waiting" },
            { "at": "clock", "act": "pose", "pose": "sit", "head": -25 },
            { "at": "clock", "act": "emote", "icon": "dots", "dur": 1.5 } ] } ],
  "props": [ { "id": "clk", "kind": "clock", "x": 860, "y": 640, "scale": 0.7, "value": 16.9,
    "anim": [ { "at": "waiting", "value": 17, "dur": 0.6 } ] } ],
  "texts": [ { "type": "sticker", "text": "5:00 PM", "x": 560, "y": 430, "show": "five" } ]
}
```
(`set: "office"` already places a desk, monitor and chair at x 520-700; a character at x 520 with `pose: "sit"` sits on that chair.)
