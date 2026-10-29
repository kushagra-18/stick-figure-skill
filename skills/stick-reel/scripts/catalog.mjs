#!/usr/bin/env node
// Regenerates references/catalog.md from engine/stick.js, so the documented names always match the engine.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const K = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mod = await import(path.join(K, 'engine', 'stick.js'));
const S = globalThis.Stick || mod.default;
const n = S.names, I = S._internal;
const PROP_NOTES = {
  chair: 'seat fits a size-1 "sit" pose; back is on the left (flip: true for the other side)', bed: 'lie on it with y = 1140',
  window: 'night: true = dark pane', cloud: 'rain: true', building: 'h, w', shop: 'text', laptop: 'text on screen', monitor: 'text', tv: 'text',
  phone: 'held: grip', cup: 'held; steam: true', book: 'held', briefcase: 'held', bag: 'held', placard: 'held; text', balloon: 'held', umbrella: 'held', megaphone: 'held',
  sign: 'text', board: 'text', calendar: 'text', grave: 'text', boom: 'text', lock: 'open: true',
  chart: 'values: [..] bars grow in on show; anim "value" 0-1', graph: 'values: [..] line draws in on show', battery: 'value 0-1 (animate it)', meter: 'value 0-1 needle', clock: 'value = hours, e.g. 10.5 (animate it to spin)',
  sun: 'rays turn', bulb: 'rays: false', fire: 'flickers', rocket: 'flame flickers', flag: 'waves', bomb: 'fuse sparks', car: 'wheels roll when it moves', bike: 'wheels roll',
};
const anchor = (k) => ({ b: 'bottom', c: 'centre', g: 'grip (hand)' }[I.PROPS[k].a]);
let md = `# Catalog (generated from engine/stick.js by scripts/catalog.mjs — do not edit by hand)\n\n`;
md += `Use ONLY these names. The build stops with "Did you mean ..." on anything else.\n\n`;
md += `## Poses (\`"pose"\` on a char, or \`{"act":"pose","pose":...}\`)\n${n.poses.map((p) => `\`${p}\``).join(' · ')}\n\n`;
md += `Joints you can override inside a pose action (degrees): ${n.joints.map((j) => `\`${j}\``).join(', ')}\n\n`;
md += `## Gestures (\`{"act":"gesture","kind":...,"dur":s}\`)\n${n.gestures.map((p) => `\`${p}\``).join(' · ')}\n\n`;
md += `## Expressions (\`"expr"\`)\n${n.exprs.map((p) => `\`${p}\``).join(' · ')}\n\n`;
md += `## Emote icons (\`{"act":"emote","icon":...}\`)\n${n.emotes.map((p) => `\`${p}\``).join(' · ')}\n\n`;
md += `## Hair / hats (cast \`"hair"\`)\n${n.hairs.map((p) => `\`${p}\``).join(' · ')}\n\n## Accessories (cast \`"acc": [...]\`)\n${n.accessories.map((p) => `\`${p}\``).join(' · ')}\n\n`;
md += `## Sets (scene \`"set"\`)\n${n.sets.map((p) => `\`${p}\``).join(' · ')}\n\n## Themes\n${n.themes.map((p) => `\`${p}\``).join(' · ')}\n\n`;
md += `## Transitions (scene \`"transition"\`, into the NEXT scene)\n${n.transitions.map((p) => `\`${p}\``).join(' · ')}\n\n`;
md += `## Colours (or any #hex)\n${n.colors.map((p) => `\`${p}\``).join(' · ')}\n\n`;
md += `## Text types\n${n.textTypes.map((p) => `\`${p}\``).join(' · ')}\n\n`;
md += `## Props (\`"kind"\`) — anchor, notes\n| kind | anchor | notes |\n|---|---|---|\n`;
for (const k of n.props) md += `| \`${k}\` | ${anchor(k)} | ${PROP_NOTES[k] || ''} |\n`;
fs.writeFileSync(path.join(K, 'references', 'catalog.md'), md);
console.log(`wrote references/catalog.md (${n.props.length} props, ${n.poses.length} poses)`);
