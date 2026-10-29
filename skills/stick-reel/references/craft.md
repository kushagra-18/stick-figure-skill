# Craft — story, script, staging

These rules come from real complaints on the user's earlier reels. Follow them literally.

## What the user wants
- **Smooth.** No hard cuts, no pops, no jitter. Every scene leaves through a transition; every change is a blend
  (the engine does this — your job is to time changes on words and not to cram them).
- **Clear.** One idea per scene, shown, not just said. One visual metaphor carried through the reel
  (e.g. money = a green bill that keeps coming back; stress = a red meter). Never a new metaphor each scene.
- **Not "AI slop".** Full natural sentences. No one-word sentences ("Boom."), no fragment chains ("So use it. Stuck?"),
  no hype words ("unlock", "game-changer", "mind-blowing"), no em-dash-heavy copy.
- **Decide, don't quiz.** Pick concept, cast, look and voice yourself; say the pick in one line.
- **Show the hook early**: render the first ~5 s (`src/render.sh --hook 5`) and give the path.
- **Deliver** the full absolute path of the final MP4 and the upload pack (`CAPTION.md`) every time.

## Hook (first line, ≤ 3.5 s spoken)
A relatable situation + a twist that opens a question. The FIRST FRAME already shows the situation
(no empty set, no slow intro, no title card alone). Good: "Kai got a raise, and somehow he is more broke than before."
Bad: "Today we are going to talk about money."

## Script shape (6-10 lines, ~90-150 words)
1. Hook (situation + twist)
2-3. The story: a concrete character in a concrete place doing something (who, where, what went wrong)
4. The name / the reason ("This is called ...", "Here is why: ...") + the metaphor in one sentence
5-6. What to do about it: action + WHY it works, out loud
7. Payoff: call back to the hook (same character, the problem now solved) + "Follow for more ..."

Rules:
- Spell numbers for the voice ("fifty thousand", "nineteen ninety-five", "ninety-nine percent"); show digits with
  `captionReplace`. Say "about" for rounded numbers. Facts must survive a quick check.
- Warm, casual English — a friend telling a story. Short sentences, but complete ones.
- Each line should name something visible (a person, an object, a place, a number) so the scene can show it.

## Staging (per scene)
- Know what the viewer must SEE on each key word, then cue it on that word. Aim for one visible change every
  1-2 s: an action, an expression, a prop popping in, a camera push, a sticker.
- At least 2 actions per character per scene. Expressions change on emotional words.
- Keep characters at the same size and look across scenes (cast). Max 3 characters on screen.
- Entrances: the first time a character appears, use `enter` (`pop`, `draw`, or `walk`). After that they can just be there.
- Use the set that matches the line (office for work, bedroom for sleep, street for going out, park for leisure,
  classroom for explaining, `void` for abstract ideas). Sets are faded so the characters pop.
- Camera: a slow push-in (`zoom` 1.08-1.15 over the whole line, `ease: "sine.inOut"`) keeps static scenes alive;
  a quicker push (0.6-0.9 s) to a face or prop on the key word; `follow` for walking. Never zoom past 1.5.
- Stickers and counters are the "headline" of the scene: 1 per scene, above heads (y 430-700).
- Bubbles for a character's actual words; never put the narration in a bubble.

## Transitions (choose for meaning)
| From → to | Use |
|---|---|
| a different place / time jump | `whip` |
| same place, story continues | `push` (or put both lines in ONE scene — better) |
| into an idea, a zoom into the brain/phone/graph | `zoom` |
| mood change, "later that night", sad turn | `dissolve` or `dip` |
| reveal / punchline / ending | `iris` with `focus` on the character |
If two shots would show the same character in the same place, make them one scene (a transition between them
shows the character twice).

## Motion vocabulary that reads instantly
- Happy news: `cheer` + `excited`, or `gesture: bounce`. Shock: `shock` + `shock` + `emote "!"`.
- Confusion: `shrug` + `confused` + `emote "?"`. Thinking: `think` + `emote "idea"` on the answer word.
- Sadness: `sad` pose + `sad`, or `sitHug`. Anger: `gesture: fist` or `angry`. Tired: `gesture: pant`.
- Explaining: `explain` / `present` toward the prop or the other character (`face` them first).
- Work: `sit` at the office set + `gesture: typing`. Phone addiction: `phone` pose + held `phone` prop.
- Ending: both characters `front`, `cheer` or `wave`, `lookCamera` on "follow".

## Upload pack (CAPTION.md, every reel)
```
TITLE: <hooky title, ≤ 60 chars> #shorts
CAPTION:
<2-4 short lines; end with a question that invites comments>
SOURCES: (only if the reel states facts)
- <title> — <working link>
HASHTAGS: #tag1 ... (10-12, mix broad + niche)
```
