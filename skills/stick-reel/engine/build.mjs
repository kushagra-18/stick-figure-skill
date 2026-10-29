#!/usr/bin/env node
// build.mjs — compiles story.json into a HyperFrames index.html (stick-figure reel).
//
//   node src/build.mjs            build index.html (+ assets/sfx/cues.json), print the timing plan
//   node src/build.mjs --until 5  build only the first 5 s (hook preview render)
//   node src/build.mjs --plan     print the plan + every scene's spoken words (for writing cues), write nothing
//
// Timing comes from the voiceover (assets/vo/<voice>/lineN.words.json + .dur). Lines without a take get an
// estimated placeholder timing, so the visuals can be built before the voice exists; every cue is a word,
// so swapping the real voice in re-syncs everything on the next build.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SRC, '..');
// stick.js is a UMD-ish script: CommonJS export when loaded as CJS, globalThis.Stick when loaded as ESM
const mod = await import('./stick.js');
const Stick = globalThis.Stick || mod.default;
const N = Stick.names;
const args = process.argv.slice(2);
const UNTIL = args.includes('--until') ? parseFloat(args[args.indexOf('--until') + 1]) : null;
const PLAN_ONLY = args.includes('--plan');

const errors = [], warns = [];
const err = (m) => errors.push(m), warn = (m) => warns.push(m);
function closest(name, list) {
  const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1)); return d[a.length][b.length]; };
  return list.map((x) => [x, lev(String(name), x)]).sort((a, b) => a[1] - b[1]).slice(0, 4).map((x) => x[0]).join(', ');
}
const check = (val, list, what, where) => { if (val !== undefined && !list.includes(val)) err(`${where}: unknown ${what} "${val}". Did you mean: ${closest(val, list)}? (all: ${list.join(', ')})`); };

// ───────────── load ─────────────
const storyPath = path.join(ROOT, 'story.json');
let story;
try { story = JSON.parse(fs.readFileSync(storyPath, 'utf8')); }
catch (e) { console.error(`story.json is not valid JSON: ${e.message}`); process.exit(1); }
if (!Array.isArray(story.scenes) || !story.scenes.length) { console.error('story.json needs a non-empty "scenes" array'); process.exit(1); }

const VOICE = story.voice || 'chandrika';
const VO_DIR = path.join(ROOT, 'assets', 'vo', VOICE);
const T_DEFAULT = 0.5, LINE_GAP = 0.3;

// ───────────── lines + voice timings ─────────────
const norm = (w) => w.toLowerCase().replace(/[’‘]/g, "'").replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');
const lines = []; // {n, scene, text, by, words:[{w, raw, t0, t1}], dur, real}
story.scenes.forEach((s, si) => {
  let say = s.say ?? [];
  if (!Array.isArray(say)) say = [say];
  s._lines = [];
  for (const item of say) {
    const text = typeof item === 'string' ? item : item.text;
    const by = typeof item === 'string' ? s.speaker : item.by ?? s.speaker;
    if (!text || !text.trim()) continue;
    const L = { n: lines.length + 1, scene: si, text: text.trim(), by };
    lines.push(L); s._lines.push(L);
  }
});
function estimate(text) {
  let t = 0.02; const out = [];
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    const letters = raw.replace(/[^A-Za-z0-9]/g, '').length;
    const d = Math.min(0.85, 0.1 + 0.052 * letters);
    out.push({ raw, t0: t, t1: t + d });
    t += d + 0.04 + (/[,;:]$/.test(raw) ? 0.16 : /[.?!]$/.test(raw) ? 0.28 : 0);
  }
  return { words: out, dur: t + 0.05 };
}
// Map whisper's words onto the SCRIPT words, so captions and cues always use the script spelling.
// Whisper writes numbers as digits ("fifty thousand" -> "50,000"): a digit token absorbs the script words up
// to the next word that matches again, and its time is split across them. Dropped/extra words are tolerated.
function alignToScript(script, ws, n) {
  const out = [], eq = (a, b) => a !== undefined && b !== undefined && norm(a) === norm(b) && norm(a) !== '';
  const isNum = (w) => /\d/.test(w);
  let i = 0, j = 0, fixes = 0;
  while (i < script.length && j < ws.length) {
    const W = ws[j];
    if (eq(script[i], W.text)) { out.push({ raw: script[i], t0: W.start, t1: W.end }); i++; j++; continue; }
    if (isNum(W.text) && !isNum(script[i])) {
      let k = i + 1;
      const nextW = ws[j + 1];
      if (!nextW) k = script.length;
      else { let f = -1; for (let q = i + 1; q <= Math.min(script.length, i + 8); q++) if (eq(script[q], nextW.text)) { f = q; break; } k = f > 0 ? f : i + 1; }
      const span = (W.end - W.start) / (k - i);
      for (let q = i; q < k; q++) out.push({ raw: script[q], t0: W.start + span * (q - i), t1: W.start + span * (q - i + 1) });
      i = k; j++; continue;
    }
    if (eq(script[i + 1], W.text)) { out.push({ raw: script[i], t0: W.start, t1: W.start }); i++; fixes++; continue; } // voice dropped a word
    if (eq(script[i], ws[j + 1] && ws[j + 1].text)) { j++; fixes++; continue; } // voice added a word
    out.push({ raw: script[i], t0: W.start, t1: W.end }); i++; j++; // misheard: keep the script word
  }
  const last = out.length ? out[out.length - 1].t1 : 0;
  while (i < script.length) { out.push({ raw: script[i++], t0: last, t1: last }); fixes++; }
  if (fixes > 1) warn(`line ${n}: the take differs from the script in ${fixes} places (dropped/added words?). Listen to it; re-roll with src/voice.sh ${n}`);
  return out;
}

let placeholders = 0;
for (const L of lines) {
  const wj = path.join(VO_DIR, `line${L.n}.words.json`), dj = path.join(VO_DIR, `line${L.n}.dur`), wav = path.join(VO_DIR, `line${L.n}.wav`);
  if (fs.existsSync(wj) && fs.existsSync(dj) && fs.existsSync(wav)) {
    const ws = JSON.parse(fs.readFileSync(wj, 'utf8'));
    const dur = parseFloat(fs.readFileSync(dj, 'utf8').replace(/[^0-9.]/g, ''));
    L.words = alignToScript(L.text.split(/\s+/).filter(Boolean), ws, L.n);
    L.dur = dur; L.real = true; L.wav = path.relative(ROOT, wav);
  } else {
    const e = estimate(L.text); L.words = e.words; L.dur = e.dur; L.real = false; placeholders++;
  }
  L.words.forEach((w) => (w.w = norm(w.raw)));
}

// ───────────── scene timing ─────────────
let clock = 0;
const nS = story.scenes.length;
story.scenes.forEach((s, i) => {
  const tr = typeof s.transition === 'string' ? { kind: s.transition } : s.transition || { kind: i === 0 ? 'whip' : 'whip' };
  if (tr.kind) check(tr.kind, N.transitions, 'transition', `scene ${s.id || i + 1}`);
  tr.dur = tr.dur ?? (tr.kind === 'cut' ? 0.04 : tr.kind === 'iris' || tr.kind === 'dip' ? 0.7 : T_DEFAULT);
  s._tr = tr;
  const lead = s.lead ?? (i === 0 ? 0.15 : 0.3);
  const tail = s.tail ?? (i === nS - 1 ? 1.1 : 0.55);
  s._start = clock;
  let t = s._start + lead;
  s._lines.forEach((L, k) => { if (k) t += LINE_GAP; L.start = t; L.words.forEach((w) => { w.a0 = t + w.t0; w.a1 = t + w.t1; }); t += L.dur; });
  if (!s._lines.length) t = s._start + (s.dur ?? 2);
  s._voEnd = t;
  s._end = s._lines.length ? t + tail + (s.hold ?? 0) : t; // a silent scene lasts exactly its "dur"
  if (i < nS - 1) {
    const T = Math.min(tr.dur, (s._end - s._start) * 0.5);
    if (tail + (story.scenes[i + 1].lead ?? 0.3) < T + 0.15) warn(`scene ${s.id || i + 1}: tail+lead is shorter than the ${tr.kind} transition, the next line may start mid-transition`);
    clock = s._end - T;
  }
});
const TOTAL_FULL = story.scenes[nS - 1]._end;
const TOTAL = UNTIL ? Math.min(UNTIL, TOTAL_FULL) : TOTAL_FULL;

// ───────────── cues ─────────────
// number = seconds after the scene starts; "word", "word#2", "word.end", "word+0.3", "word#2.end-0.1",
// "start", "end" (end of the scene's last word), "line2" (start of the scene's 2nd line), "scene-end"
function cue(v, s, where) {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'number') return s._start + v;
  const m = String(v).trim().toLowerCase().match(/^([a-z0-9'\-]+?)(?:#(\d+))?(\.end)?\s*([+-]\s*\d*\.?\d+)?$/);
  if (!m) { err(`${where}: cue "${v}" is not a number or a word cue like "money", "money#2", "money.end+0.2"`); return s._start; }
  const off = m[4] ? parseFloat(m[4].replace(/\s/g, '')) : 0;
  const words = s._lines.flatMap((L) => L.words);
  if (m[1] === 'start') return s._start + off;
  if (m[1] === 'end') return (words.length ? words[words.length - 1].a1 : s._voEnd) + off;
  if (m[1] === 'scene-end') return s._end + off;
  const lm = m[1].match(/^line(\d+)$/);
  if (lm) { const L = s._lines[+lm[1] - 1]; if (!L) { err(`${where}: "${v}" — this scene has ${s._lines.length} line(s)`); return s._start; } return L.start + off; }
  const occ = m[2] ? +m[2] : 1;
  const hits = words.filter((w) => w.w === m[1]);
  if (hits.length < occ) {
    err(`${where}: cue word "${m[1]}"${occ > 1 ? ` (occurrence ${occ})` : ''} is not spoken in scene "${s.id}". Its words: ${[...new Set(words.map((w) => w.w))].join(' ')}`);
    return s._start;
  }
  const w = hits[occ - 1];
  return (m[3] ? w.a1 : w.a0) + off;
}

// ───────────── compile scenes ─────────────
const KNOWN_ACTS = ['pose', 'walk', 'run', 'sneak', 'hop', 'slide', 'jump', 'face', 'expr', 'gesture', 'reach', 'emote', 'grow', 'lookCamera', 'talk', 'fall', 'hold', 'drop', 'give'];
const sfxKinds = (() => { try { const src = fs.readFileSync(path.join(SRC, 'sfx.py'), 'utf8'); const m = src.match(/KINDS = dict\(([\s\S]*?)\)\n/); return m ? [...m[1].matchAll(/(\w+)=/g)].map((x) => x[1]) : []; } catch { return []; } })();
const SFX = [];
const AUTO = story.sfx !== false;
const addSfx = (t, kind, gain) => { if (t !== undefined && t < TOTAL + 0.5) SFX.push([+t.toFixed(3), kind, gain]); };
const cast = story.cast || {};
for (const [id, c] of Object.entries(cast)) {
  check(c.hair, N.hairs, 'hair', `cast ${id}`);
  for (const a of c.acc || []) check(a, N.accessories, 'accessory', `cast ${id}`);
}
check(story.theme, N.themes, 'theme', 'story');

const wrap = (text, max) => {
  const out = [];
  for (const para of String(text).split('\n')) {
    let cur = '';
    for (const w of para.split(/\s+/).filter(Boolean)) {
      if ((cur + ' ' + w).trim().replace(/\*/g, '').length > max && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
    }
    if (cur) out.push(cur);
  }
  return out.length ? out : [''];
};

const scenes = story.scenes.map((s, si) => {
  const W = `scene "${s.id || si + 1}"`;
  if (!s.id) s.id = `s${si + 1}`;
  check(s.set, N.sets, 'set', W);
  check(s.theme, N.themes, 'theme', W);
  const out = {
    id: s.id, start: +s._start.toFixed(3), end: +s._end.toFixed(3), theme: s.theme, set: s.set || 'void', ground: s.ground,
    groundY: s.groundY ?? story.groundY, colors: s.colors, grid: s.grid, decor: s.decor,
    transition: { kind: s._tr.kind || 'whip', dur: s._tr.dur, ease: s._tr.ease, dir: s._tr.dir, focus: s._tr.focus },
    cam0: s.cam0, follow: s.follow ? (typeof s.follow === 'string' ? { id: s.follow } : { ...s.follow, from: cue(s.follow.at, s, W), to: cue(s.follow.until, s, W) }) : undefined,
    camera: (s.camera || []).map((k) => ({ t: cue(k.at, s, `${W} camera`), dur: k.dur ?? 1, ease: k.ease, x: k.x, y: k.y, zoom: k.zoom })),
    shakes: (s.shake || []).map((k) => ({ t: cue(k.at, s, `${W} shake`), dur: k.dur ?? 0.5, amp: k.amp ?? 18 })),
    chars: [], props: [], texts: [],
  };
  out.shakes.forEach((k) => AUTO && addSfx(k.t, sfxKinds.includes('jolt') ? 'jolt' : 'thud', 0.35));
  if (s.decor) s.decor.forEach((d, k) => check(d.kind, N.props, 'decor kind', `${W} decor ${k + 1}`));
  const ids = new Set();
  // set furniture and decor are targetable by id or kind (walk to "bed", face "desk")
  const decorIds = [...((Stick._internal.SETS[s.set || 'void'] || (() => []))(s.groundY ?? story.groundY ?? 1250)), ...(s.decor || [])].map((d) => d.id || d.kind);
  const targetable = new Set(decorIds);
  // characters
  for (const c of s.chars || []) {
    const CW = `${W} char "${c.id}"`;
    if (!c.id) { err(`${W}: every char needs an "id" (a key of "cast", or any name)`); continue; }
    if (ids.has(c.id)) err(`${CW}: duplicate id in this scene`);
    ids.add(c.id);
    if (!cast[c.id] && !c.look) warn(`${CW}: not in "cast" — drawn with defaults (plain ink, no hair)`);
    check(typeof c.pose === 'string' ? c.pose : undefined, N.poses, 'pose', CW);
    check(c.expr, N.exprs, 'expr', CW);
    const cc = { id: c.id, x: c.x ?? 540, y: c.y, facing: c.facing ?? 'right', pose: c.pose, expr: c.expr, look: c.look, float: c.float, arms: c.arms, noShadow: c.noShadow, do: [], talks: [], gesticulate: c.gesticulate };
    if (c.x !== undefined && (c.x < 60 || c.x > 1020) && !(c.enter && (c.enter === 'walk' || c.enter.style === 'walk'))) warn(`${CW}: x=${c.x} starts outside the frame (60-1020)`);
    // entrance / exit
    const enter = typeof c.enter === 'string' ? { style: c.enter } : c.enter;
    if (enter) {
      const t = cue(enter.at ?? 0.1, s, `${CW} enter`);
      if (enter.style === 'walk' || enter.style === 'run') {
        const from = enter.from === 'left' || (enter.from !== 'right' && cc.x < 540) ? -180 : 1260;
        const target = cc.x; cc.x = from;
        cc.do.push({ t, act: enter.style, to: target });
      } else { cc.enter = { t, style: enter.style || 'pop', dur: enter.dur }; if (AUTO) addSfx(t, enter.style === 'draw' ? 'scribble' : 'pop', 0.16); }
    }
    const exit = typeof c.exit === 'string' ? { style: c.exit } : c.exit;
    if (exit) {
      const t = cue(exit.at ?? 'end', s, `${CW} exit`);
      if (exit.style === 'walk' || exit.style === 'run') cc.do.push({ t, act: exit.style, to: exit.to === 'left' ? -260 : exit.to === 'right' ? 1340 : (c.x ?? 540) < 540 ? -260 : 1340 });
      else { cc.exit = { t, style: exit.style || 'fade' }; }
    }
    for (const [k, a] of (c.do || []).entries()) {
      const AW = `${CW} do[${k}]`;
      if (!a.act) { err(`${AW}: missing "act" (one of ${KNOWN_ACTS.join(', ')})`); continue; }
      check(a.act, KNOWN_ACTS, 'act', AW);
      const t = cue(a.at ?? 0, s, AW);
      const b = { ...a, t };
      delete b.at;
      if (a.until !== undefined) { b.dur = Math.max(0.1, cue(a.until, s, AW) - t); delete b.until; }
      if (a.act === 'pose') { if (typeof a.pose === 'string') check(a.pose, N.poses, 'pose', AW); for (const j of Object.keys(a)) if (!['act', 'at', 'pose', 'dur', 'ease', 'until'].includes(j) && !N.joints.includes(j)) warn(`${AW}: "${j}" is not a joint (${N.joints.join(', ')})`); }
      if (a.act === 'gesture') check(a.kind, N.gestures, 'gesture', AW);
      if (a.act === 'expr') check(a.expr, N.exprs, 'expr', AW);
      if (a.act === 'emote') { check(a.icon, N.emotes, 'emote icon', AW); if (AUTO) addSfx(t, 'pop', 0.14); }
      if (a.act === 'jump' && AUTO) { addSfx(t + 0.2, 'boing', 0.18); addSfx(t + (a.dur ?? 0.9) * 0.8, 'thud', 0.14); }
      if (a.act === 'fall' && AUTO) addSfx(t + (a.dur ?? 0.5), 'thud', 0.3);
      if (['walk', 'run', 'sneak', 'hop', 'slide'].includes(a.act) && a.to === undefined && a.by === undefined) err(`${AW}: ${a.act} needs "to" (x, [x,y], or a char/prop id) or "by" (dx)`);
      cc.do.push(b);
    }
    out.chars.push(cc);
  }
  // who talks: lines spoken "by" a character move that character's mouth (and hand, by default)
  for (const L of s._lines) {
    if (!L.by) continue;
    const cc = out.chars.find((c) => c.id === L.by);
    if (!cc) { err(`${W}: line ${L.n} is spoken by "${L.by}" who is not in this scene's chars`); continue; }
    for (const w of L.words) cc.talks.push([+w.a0.toFixed(3), +w.a1.toFixed(3)]);
    if (cc.gesticulate === undefined) cc.gesticulate = true;
  }
  // props
  for (const [k, p] of (s.props || []).entries()) {
    const PW = `${W} prop "${p.id || p.kind}"`;
    check(p.kind, N.props, 'prop kind', PW);
    if (!p.id) p.id = `${p.kind}${k + 1}`;
    if (ids.has(p.id)) err(`${PW}: id "${p.id}" is already used in this scene`);
    ids.add(p.id);
    const show = p.show !== undefined ? cue(p.show, s, `${PW} show`) : undefined;
    const pp = { ...p, show, hide: p.hide !== undefined ? cue(p.hide, s, `${PW} hide`) : undefined, anim: (p.anim || []).map((a) => { const b = { ...a, t: cue(a.at, s, `${PW} anim`) }; delete b.at; return b; }) };
    if (show !== undefined && AUTO) addSfx(show + (p.in === 'drop' ? 0.33 : 0), p.in === 'drop' ? 'thud' : p.in === 'draw' ? 'scribble' : p.in === 'fade' ? null : 'pop', 0.16);
    out.props.push(pp);
  }
  // texts
  for (const [k, x] of (s.texts || []).entries()) {
    const XW = `${W} text ${k + 1}`;
    const type = x.type || 'label';
    check(type, N.textTypes, 'text type', XW);
    const max = x.maxChars ?? { title: 14, label: 20, note: 26, sticker: 16, bubble: 16, thought: 16 }[type] ?? 20;
    const xx = { ...x, type, show: x.show !== undefined ? cue(x.show, s, `${XW} show`) : undefined, hide: x.hide !== undefined ? cue(x.hide, s, `${XW} hide`) : undefined };
    if (x.by) xx.near = x.by;
    if (type !== 'counter' && x.text !== undefined) xx.lines = wrap(x.text, max);
    if (xx.near && !ids.has(xx.near)) err(`${XW}: near/by "${xx.near}" is not a char or prop id in this scene`);
    if (!x.near && !x.by && x.x !== undefined && (x.x < 120 || x.x > 960 || (x.y ?? 600) < 330 || (x.y ?? 600) > 1290)) warn(`${XW}: (${x.x}, ${x.y}) is near/outside the safe box x 60-940, y 320-1300`);
    if (xx.show !== undefined && AUTO && ['title', 'sticker', 'bubble', 'thought', 'counter'].includes(type)) addSfx(xx.show, type === 'counter' ? (sfxKinds.includes('counter') ? 'counter' : 'tick') : 'pop', 0.15);
    if (xx.show !== undefined && AUTO && ['arrow', 'circle', 'underline', 'strike'].includes(type)) addSfx(xx.show, 'scribble', 0.12);
    out.texts.push(xx);
  }
  // targets of actions must exist in this scene
  for (const cc of out.chars) for (const a of cc.do) {
    if (['hold', 'drop', 'give'].includes(a.act) && !ids.has(a.prop)) err(`${W} char "${cc.id}" ${a.act}: prop "${a.prop}" is not a prop id in this scene`);
    if (a.into !== undefined && !ids.has(a.into)) err(`${W} char "${cc.id}" drop: into "${a.into}" is not a prop id in this scene`);
    const tgt = typeof a.to === 'string' ? a.to : undefined;
    if (tgt === undefined || (a.act === 'face' && ['left', 'right', 'front'].includes(tgt))) continue;
    if (!ids.has(tgt.split('.')[0]) && !targetable.has(tgt)) err(`${W} char "${cc.id}" ${a.act}: target "${tgt}" is not a char or prop id in this scene (ids: ${[...ids, ...targetable].join(', ')})`);
  }
  for (const [k, f] of (s.sfx || []).entries()) {
    if (sfxKinds.length) check(f.kind, sfxKinds, 'sfx kind', `${W} sfx ${k + 1}`);
    addSfx(cue(f.at, s, `${W} sfx`), f.kind, f.gain ?? 0.25);
  }
  if (si < nS - 1 && AUTO) { const k = out.transition.kind; addSfx(story.scenes[si + 1]._start, ['whip', 'push', 'slideUp'].includes(k) ? 'whoosh' : k === 'iris' || k === 'wipe' ? 'swish' : 'swish', 0.22); }
  return out;
});

// ───────────── captions ─────────────
const REPL = story.captionReplace || {};
function captionChunks() {
  const ws = [];
  for (const L of lines) {
    const lw = L.words.map((w) => ({ w: w.raw.replace(/[.,;:"“”]+$/g, '').replace(/^["“”]+/, ''), t0: w.a0, t1: w.a1, k: w.w }));
    // multi-word display replacements, e.g. {"ninety-nine percent": "99%"}
    for (const [from, to] of Object.entries(REPL)) {
      const seq = from.toLowerCase().split(/\s+/).map(norm);
      for (let i = 0; i + seq.length <= lw.length; i++) {
        if (seq.every((x, j) => lw[i + j].k === x)) lw.splice(i, seq.length, { w: to, t0: lw[i].t0, t1: lw[i + seq.length - 1].t1, k: '' });
      }
    }
    lw.forEach((w, i) => (w.end = i === lw.length - 1));
    ws.push(...lw);
  }
  const chunks = [];
  let cur = [];
  const flush = () => { if (cur.length) chunks.push(cur); cur = []; };
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    cur.push(w);
    const chars = cur.map((x) => x.w).join(' ').length;
    const next = ws[i + 1];
    const punct = /[?!]$/.test(w.w) || /[,.;:]$/.test(lines.flatMap((L) => L.words).find((x) => Math.abs(x.a0 - w.t0) < 1e-6)?.raw || '');
    if (w.end || !next || cur.length >= 4 || chars >= 17 || (punct && cur.length >= 2) || next.t0 - w.t1 > 0.45) flush();
  }
  flush();
  return chunks.map((c, i) => {
    const nx = chunks[i + 1];
    const t1 = nx && nx[0].t0 - c[c.length - 1].t1 < 0.6 ? nx[0].t0 - 0.05 : c[c.length - 1].t1 + 0.35;
    return { t0: +(c[0].t0 - 0.06).toFixed(3), t1: +t1.toFixed(3), words: c.map((w) => ({ w: w.w, t0: +w.t0.toFixed(3) })) };
  });
}

// ───────────── report ─────────────
const fmt = (x) => x.toFixed(2).padStart(6);
console.log(`\n${story.title || 'stick reel'} — ${TOTAL_FULL.toFixed(1)}s${UNTIL ? ` (building first ${TOTAL.toFixed(1)}s)` : ''}, ${lines.length} lines, voice "${VOICE}"${placeholders ? `, ${placeholders} line(s) on PLACEHOLDER timing` : ''}`);
console.log('scene                start   end    dur   lines  transition-out');
story.scenes.forEach((s, i) => console.log(`${(s.id || '').padEnd(20)}${fmt(s._start)}${fmt(s._end)}${fmt(s._end - s._start)}   ${s._lines.map((L) => L.n).join(',').padEnd(6)} ${i < nS - 1 ? s._tr.kind : '-'}`));
if (PLAN_ONLY) {
  console.log('\nspoken words per scene (use them as cues):');
  story.scenes.forEach((s) => console.log(`  ${s.id}: ${s._lines.flatMap((L) => L.words.map((w) => `${w.w}@${(w.a0 - s._start).toFixed(2)}`)).join(' ')}`));
}
for (const w of warns) console.log(`  warn: ${w}`);
if (errors.length) {
  console.error(`\n${errors.length} error(s) — nothing written:`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
if (PLAN_ONLY) process.exit(0);

// ───────────── write ─────────────
const theme = story.theme || 'paper';
const DATA = {
  total: +TOTAL.toFixed(3), theme, accent: story.accent || 'red', cast, groundY: story.groundY ?? 1250, scenes,
  captions: story.captions === false ? null : { chunks: captionChunks() }, bar: !!story.bar,
  barDone: story.bar && story.bar.at !== undefined ? cue(story.bar.at, story.scenes[nS - 1], 'bar') : undefined,
  themeOverride: story.colors,
};
const sfxDir = path.join(ROOT, 'assets', 'sfx');
fs.mkdirSync(sfxDir, { recursive: true });
const music = story.music ? (typeof story.music === 'number' ? { gain: story.music } : story.music) : null;
const cues = { total: +TOTAL_FULL.toFixed(3), events: SFX.filter((e) => e[1]).sort((a, b) => a[0] - b[0]) };
if (music) {
  cues.bed = music.gain ?? 0.2;
  const sc = (id) => story.scenes.find((s) => s.id === id);
  if (music.turn) { const [sid, c] = music.turn.split(':'); if (sc(sid)) cues.bed_turn = +cue(c || 0, sc(sid), 'music.turn').toFixed(3); }
  if (music.back) { const [sid, c] = music.back.split(':'); if (sc(sid)) cues.bed_back = +cue(c || 0, sc(sid), 'music.back').toFixed(3); }
}
const cuesPath = path.join(sfxDir, 'cues.json'), cuesTxt = JSON.stringify(cues);
if (!fs.existsSync(cuesPath) || fs.readFileSync(cuesPath, 'utf8') !== cuesTxt) fs.writeFileSync(cuesPath, cuesTxt);
const mix = path.join(sfxDir, 'mix.wav');
const mixFresh = fs.existsSync(mix) && fs.statSync(mix).mtimeMs >= fs.statSync(cuesPath).mtimeMs;
if ((AUTO || SFX.length || music) && !mixFresh) console.log(`  note: SFX mix is ${fs.existsSync(mix) ? 'stale' : 'missing'} — run src/sfx.sh (it is left out of this build)`);

const TH = { paper: '#F7F3EA', chalk: '#24302C', night: '#1D2137', sky: '#D9EDF7', blueprint: '#1F4E79', sunset: '#FBE3C8' };
const COLORS = { red: '#E63946', blue: '#3A86FF', yellow: '#FFBE0B', green: '#2A9D8F', orange: '#FB8500', pink: '#FF70A6', purple: '#8338EC' };
const accentHex = COLORS[DATA.accent] || DATA.accent;
const font = story.font === 'Fredoka' ? 'Fredoka' : 'Kalam';
let audio = '';
for (const L of lines) if (L.real && L.start < TOTAL) audio += `    <audio id="vo${L.n}" src="${L.wav}" data-start="${L.start.toFixed(3)}" data-duration="${Math.min(L.dur, TOTAL - L.start).toFixed(3)}" data-track-index="20" data-volume="1"></audio>\n`;
if (mixFresh) audio += `    <audio id="sfx" src="assets/sfx/mix.wav" data-start="0" data-duration="${TOTAL.toFixed(3)}" data-track-index="21" data-volume="1"></audio>\n`;
const fps = story.fps ? ` data-fps="${story.fps}"` : '';
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1080, height=1920" />
<title>${(story.title || 'stick reel').replace(/</g, '')}</title>
<!-- GENERATED by src/build.mjs from story.json — edit story.json, not this file. -->
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
@font-face { font-family: 'Kalam'; src: url('assets/fonts/Kalam-Bold.ttf') format('truetype'); font-weight: 700; }
@font-face { font-family: 'Fredoka'; src: url('assets/fonts/Fredoka-latin-var.woff2') format('woff2'); font-weight: 300 700; }
html, body { margin: 0; background: ${TH[theme] || TH.paper}; }
#root { position: relative; width: 1080px; height: 1920px; overflow: hidden; background: ${TH[theme] || TH.paper}; --font: '${font}'; }
.sk-scene { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; overflow: hidden; transform-origin: 540px 860px; }
.sk-svg { position: absolute; left: 0; top: 0; display: block; overflow: visible; }
.sk-svg .o { fill: var(--paper); stroke: var(--ink); stroke-width: 8; stroke-linecap: round; stroke-linejoin: round; }
.sk-svg .l { fill: none; stroke: var(--ink); stroke-width: 8; stroke-linecap: round; stroke-linejoin: round; }
.sk-svg .f { fill: var(--ink); }
.sk-svg .a { fill: var(--ac); stroke: var(--ink); stroke-width: 8; stroke-linejoin: round; stroke-linecap: round; }
.sk-svg .s { fill: var(--soft); opacity: .55; }
.sk-svg .t { fill: var(--ink); font-family: var(--font); font-weight: 700; text-anchor: middle; dominant-baseline: central; }
.sk-svg .ta { fill: var(--ac); stroke: var(--ink); stroke-width: 7; paint-order: stroke; }
.sk-svg .tt { fill: var(--ink); stroke: var(--bg); stroke-width: 16; paint-order: stroke; stroke-linejoin: round; dominant-baseline: auto; }
.sk-svg .tl, .sk-svg .tn, .sk-svg .tb, .sk-svg .ts { dominant-baseline: auto; }
.sk-svg .tl { stroke: var(--bg); stroke-width: 12; paint-order: stroke; stroke-linejoin: round; }
.sk-svg .acc { fill: var(--ac); }
.sk-svg .soft { --ink: var(--soft); }
.sk-svg .soft .o, .sk-svg .soft .a { fill: var(--bg); }
.sk-cap { position: absolute; left: 60px; width: 880px; top: 1328px; height: 160px; display: flex; align-items: center; justify-content: center; z-index: 50; }
.sk-pill { background: #FFFDF8; border: 6px solid #25221E; border-radius: 30px; padding: 6px 28px 12px; font: 700 62px/1.12 var(--font); color: #25221E; text-align: center; max-width: 820px; box-shadow: 8px 8px 0 #25221E; transform-origin: 50% 50%; }
.sk-pill span.on { color: ${accentHex}; }
.sk-bar { position: absolute; left: 70px; top: 272px; width: 860px; height: 36px; z-index: 50; display: flex; align-items: center; gap: 16px; }
.sk-track { flex: 1; height: 26px; border: 5px solid #25221E; border-radius: 18px; background: #FFFDF8; overflow: hidden; }
.sk-fill { width: 100%; height: 100%; background: ${accentHex}; transform-origin: 0 50%; transform: scaleX(0); }
.sk-pct { font: 700 40px/1 var(--font); color: #25221E; background: #FFFDF8; border: 5px solid #25221E; border-radius: 14px; padding: 2px 10px 4px; }
</style>
</head>
<body>
  <div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL.toFixed(3)}" data-width="1080" data-height="1920"${fps}>
${audio}  </div>
<script>
${fs.readFileSync(path.join(SRC, 'stick.js'), 'utf8')}
</script>
<script>
window.STORY = ${JSON.stringify(DATA)};
(function () {
  var rootEl = document.getElementById('root');
  function go() {
    Stick.init(window.STORY, rootEl);
    // the whole reel is a pure function of time: one tween drives a clock whose setter redraws the frame
    var clock = { v: 0, t: function (x) { if (x === undefined) return this.v; this.v = x; Stick.render(x); } };
    var tl = gsap.timeline({ paused: true });
    tl.fromTo(clock, { t: 0 }, { t: window.STORY.total, duration: window.STORY.total, ease: 'none' }, 0);
    window.__timelines['main'] = tl;
  }
  // load the fonts first: bubbles and stickers are sized from measured text
  Promise.all(["700 60px 'Kalam'", "600 60px 'Fredoka'"].map(function (f) { return document.fonts.load(f).catch(function () {}); }))
    .then(function () { return document.fonts.ready; }).then(go);
})();
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(ROOT, 'index.html'), html);
// QA helper data: transition midpoints + scene middles + key moments for snapshots
const qa = {
  total: +TOTAL.toFixed(3),
  scenes: scenes.map((s) => ({ id: s.id, start: s.start, end: s.end })),
  transitions: story.scenes.slice(0, -1).map((s, i) => +(((story.scenes[i + 1]._start + s._end) / 2)).toFixed(2)).filter((t) => t < TOTAL),
  middles: story.scenes.map((s) => +((s._start + s._end) / 2).toFixed(2)).filter((t) => t < TOTAL),
};
fs.writeFileSync(path.join(ROOT, '.stick-qa.json'), JSON.stringify(qa, null, 1));
console.log(`\nwrote index.html (${TOTAL.toFixed(2)}s, ${audio.split('<audio').length - 1} audio clip(s))`);
