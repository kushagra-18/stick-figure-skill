# stick-reel

Stick-figure story reels. Follow the skill: `skills/stick-reel/SKILL.md` (installed copies are symlinks to it).

- New reel: `skills/stick-reel/scripts/new-reel.sh <slug>` → `videos/<slug>/` (git-ignored)
- Write only `story.json`; build with `node src/build.mjs`; never edit a reel's `index.html` by hand.
- Editing the engine? After changing `engine/stick.js` names, run `node skills/stick-reel/scripts/catalog.mjs`.
