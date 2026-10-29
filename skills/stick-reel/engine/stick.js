/* stick.js — stick-figure story engine for HyperFrames reels (1080x1920).
 *
 * Every frame is a pure function of the global time t: Stick.render(t) redraws the whole reel from DATA,
 * so any seek (parallel render workers, Studio scrubbing) gives the same pixels. build.mjs compiles
 * story.json into DATA and inlines this file into index.html; one paused GSAP tween drives the clock.
 *
 * In Node, require('./stick.js') returns the name lists build.mjs validates story.json against.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Stick = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const VW = 1080, VH = 1920, NS = 'http://www.w3.org/2000/svg', RAD = Math.PI / 180;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const n1 = (v) => Math.round(v * 10) / 10;
  const EZ = {};
  function ease(name) {
    if (typeof name === 'function') return name;
    name = name || 'power2.inOut';
    if (!EZ[name]) EZ[name] = (root.gsap && root.gsap.parseEase(name)) || ((x) => x);
    return EZ[name];
  }
  function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function noise(x, seed) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return lerp(hash(i + seed * 101.3), hash(i + 1 + seed * 101.3), u) * 2 - 1;
  }
  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // ───────────────────────── look ─────────────────────────
  const THEMES = {
    paper: { bg: '#F7F3EA', ink: '#25221E', soft: '#CFC6B4', paper: '#FFFDF8', floor: '#EDE6D6' },
    chalk: { bg: '#24302C', ink: '#F3F0E6', soft: '#56675F', paper: '#2C3A35', floor: '#1E2925' },
    night: { bg: '#1D2137', ink: '#F1EEE4', soft: '#424A70', paper: '#262B46', floor: '#171A2C' },
    sky: { bg: '#D9EDF7', ink: '#1E2430', soft: '#A9CBDD', paper: '#F8FCFE', floor: '#BFDCC0' },
    blueprint: { bg: '#1F4E79', ink: '#EAF4FF', soft: '#4C7BA6', paper: '#245A8A', floor: '#1A4468' },
    sunset: { bg: '#FBE3C8', ink: '#2B1E1A', soft: '#E9B994', paper: '#FFF6EC', floor: '#F2CDA8' },
  };
  const COLORS = {
    red: '#E63946', blue: '#3A86FF', yellow: '#FFBE0B', green: '#2A9D8F', orange: '#FB8500', pink: '#FF70A6',
    purple: '#8338EC', gray: '#8D99AE', brown: '#9C6644', sky: '#8ECAE6', mint: '#95D5B2', gold: '#E9B949',
    black: '#25221E', white: '#FFFDF8', leaf: '#6BBF59', skin: '#F4C7A1', navy: '#1D3557',
  };
  function col(c, th) {
    if (!c) return null;
    if (c === 'ink' || c === 'soft' || c === 'bg' || c === 'paper' || c === 'floor') return th[c];
    return COLORS[c] || c;
  }

  // ───────────────────────── body ─────────────────────────
  // Lengths are fractions of the figure height (520 px at size 1). Angles in degrees:
  // s*/h* = upper arm / thigh pitch from straight DOWN (+ = forward, 90 = horizontal forward, 180 = up),
  // e* = elbow bend (+ = forearm swings forward/up), k* = knee bend (+ = shin swings back, like a real knee),
  // sp* = arm lateral spread (out to the side; only visible when facing the camera), fp* = forearm lateral
  // bend relative to the upper arm (- = back across the body), lsp = leg spread, lean = torso pitch
  // (+ = forward), head = head pitch relative to the torso (+ = down). Suffix F = near limb, B = far limb.
  const BODY = { shin: 0.23, thigh: 0.23, torso: 0.27, neck: 0.025, head: 0.1, upper: 0.155, fore: 0.15, foot: 0.05, sw: 0.027 };
  const HEIGHT = 520;
  const JOINTS = ['lean', 'head', 'sF', 'eF', 'spF', 'fpF', 'sB', 'eB', 'spB', 'fpB', 'hF', 'kF', 'hB', 'kB', 'lsp'];
  const ARMJ = { sF: 1, eF: 1, spF: 1, fpF: 1, sB: 1, eB: 1, spB: 1, fpB: 1, head: 1 };
  // follow-through: outer joints settle a beat after the torso
  const LAG = { lean: 0, head: 0.05, sF: 0.03, eF: 0.08, spF: 0.03, fpF: 0.08, sB: 0.045, eB: 0.095, spB: 0.045, fpB: 0.095, hF: 0, kF: 0.02, hB: 0, kB: 0.02, lsp: 0 };
  const STAND = { lean: 2, head: 0, sF: 6, eF: 12, spF: 12, fpF: 0, sB: -5, eB: 10, spB: 12, fpB: 0, hF: 6, kF: 4, hB: -6, kB: 3, lsp: 5 };
  const POSES = {
    stand: {},
    relaxed: { sF: 3, eF: 5, sB: -2, eB: 5, spF: 7, spB: 7, head: 4 },
    point: { sF: 88, eF: 2, spF: 6, head: -3, lean: 0 },
    pointUp: { sF: 150, eF: 0, spF: 12, head: -20, lean: -3 },
    pointDown: { sF: 42, eF: 0, head: 22, lean: 8 },
    pointSide: { sF: 10, spF: 85, eF: 0, head: -2 },
    present: { sF: 62, eF: 22, spF: 40, head: -4 },
    wave: { sF: 125, eF: 35, spF: 45, fpF: -30, head: -5 },
    cheer: { sF: 158, eF: 10, sB: 158, eB: 10, spF: 42, spB: 42, head: -15, lean: -4 },
    handsUp: { sF: 165, eF: 20, sB: 165, eB: 20, spF: 32, spB: 32, fpF: -20, fpB: -20, head: -6 },
    shrug: { sF: 22, eF: 70, sB: 22, eB: 70, spF: 35, spB: 35, fpF: 45, fpB: 45, head: 10, lean: 0 },
    think: { sF: 64, eF: 148, spF: 22, fpF: -45, sB: 25, eB: 75, spB: 15, fpB: -80, head: -12 },
    facepalm: { sF: 107, eF: 100, spF: 25, fpF: -45, head: 24, lean: 10 },
    armsCrossed: { sF: 15, eF: 75, spF: 15, fpF: -90, sB: 15, eB: 75, spB: 15, fpB: -90, head: -4, lean: -2 },
    hips: { sF: 20, eF: -10, spF: 50, fpF: -90, sB: 20, eB: -10, spB: 50, fpB: -90, lean: -2, head: -3 },
    sad: { lean: 14, head: 26, sF: 2, eF: 4, sB: 0, eB: 4, spF: 4, spB: 4 },
    shock: { lean: -10, head: -8, sF: 115, eF: 55, sB: 115, eB: 55, spF: 38, spB: 38, fpF: -30, fpB: -30 },
    scared: { lean: 18, head: 18, sF: 140, eF: 115, sB: 140, eB: 115, spF: 25, spB: 25, fpF: -40, fpB: -40, hF: 28, kF: 50, hB: 12, kB: 45 },
    sit: { lean: -3, hF: 88, kF: 88, hB: 84, kB: 86, sF: 30, eF: 50, sB: 25, eB: 50, spF: 8, spB: 8, lsp: 8 },
    sitFloor: { lean: -6, hF: 88, kF: 15, hB: 86, kB: 10, sF: -28, eF: 5, sB: -32, eB: 5, lsp: 8 },
    sitHug: { lean: 20, head: 12, hF: 50, kF: 140, hB: 46, kB: 136, sF: 62, eF: 28, sB: 58, eB: 28, fpF: -30, fpB: -30 },
    kneel: { lean: 4, hF: 85, kF: 90, hB: -5, kB: 95, sF: 10, eF: 10 },
    crouch: { lean: 32, head: -20, hF: 75, kF: 125, hB: 60, kB: 120, sF: 35, eF: 25, sB: 30, eB: 25 },
    lie: { lean: -90, head: 0, sF: 88, eF: 0, sB: 92, eB: 0, spF: 8, spB: 8, hF: 90, kF: 0, hB: 92, kB: 0, lsp: 3 },
    fallen: { lean: -86, head: 10, sF: 150, eF: 25, sB: 45, eB: 30, spF: 20, spB: 20, hF: 70, kF: 35, hB: 100, kB: 5, lsp: 10 },
    bow: { lean: 55, head: 15, sF: 5, eF: 5, sB: -5, eB: 5 },
    hold: { sF: 45, eF: 50, sB: 42, eB: 55, spF: 18, spB: 18, fpF: -25, fpB: -25 },
    holdUp: { sF: 125, eF: 25, spF: 15, head: -12 },
    phone: { sF: 25, eF: 112, spF: 8, fpF: -20, head: 22 },
    call: { sF: 128, eF: 112, spF: 30, fpF: -45, head: 4 },
    type: { lean: 8, head: 10, sF: 55, eF: 40, sB: 50, eB: 42, spF: 10, spB: 10, fpF: -15, fpB: -15 },
    talk: { sF: 38, eF: 55, spF: 25, head: -3 },
    explain: { sF: 58, eF: 38, sB: 25, eB: 60, spF: 25, spB: 15 },
    flex: { sF: 90, eF: 92, sB: 90, eB: 92, spF: 75, spB: 75, fpF: -75, fpB: -75, head: -6 },
    run: { lean: 14, sF: -40, eF: 85, sB: 50, eB: 85, hF: 40, kF: 30, hB: -35, kB: 80 },
    jump: { lean: -2, head: -10, sF: 150, eF: 15, sB: 150, eB: 15, spF: 25, spB: 25, hF: 45, kF: 80, hB: 20, kB: 85 },
    push: { lean: 32, head: -12, sF: 85, eF: 12, sB: 82, eB: 14, hF: 25, kF: 30, hB: -32, kB: 6 },
    pull: { lean: -22, head: -5, sF: 78, eF: 0, sB: 75, eB: 0, hF: 28, kF: 25, hB: -12, kB: 8 },
    lookUp: { head: -32, lean: -6 },
    lookDown: { head: 30, lean: 6 },
    victory: { sF: 165, eF: 8, spF: 20, sB: 10, eB: 90, spB: 40, fpB: -60, head: -10, lean: -3 },
    dab: { lean: 10, head: 38, sF: 120, eF: 120, spF: 5, sB: 120, eB: 0, spB: 30 },
    salute: { sF: 113, eF: 88, spF: 50, fpF: -60, head: -4 },
    pray: { sF: 40, eF: 95, sB: 40, eB: 95, spF: 20, spB: 20, fpF: -75, fpB: -75, head: 12 },
    tired: { lean: 24, head: 30, sF: 14, eF: 4, sB: 12, eB: 4, kF: 14, kB: 12 },
    angry: { lean: 8, head: 4, sF: 22, eF: 110, sB: 22, eB: 110, spF: 30, spB: 30, fpF: -40, fpB: -40 },
    sneak: { lean: 22, head: -8, sF: 55, eF: 85, sB: 40, eB: 85, hF: 30, kF: 50, hB: -10, kB: 50 },
    carry: { sF: 160, eF: 30, sB: 160, eB: 30, spF: 20, spB: 20, fpF: -30, fpB: -30, head: -4 },
  };
  function fullPose(p) {
    let o = Object.assign({}, STAND);
    if (typeof p === 'string') return Object.assign(o, POSES[p] || {});
    if (p && p.pose) Object.assign(o, POSES[p.pose] || {});
    if (p) for (const j of JOINTS) if (typeof p[j] === 'number') o[j] = p[j];
    return o;
  }

  // gestures = a temporary override pose (weighted in/out) + an oscillation, both deterministic in t
  const TAU = Math.PI * 2;
  const GESTURES = {
    wave: { pose: { sF: 125, eF: 35, spF: 45, fpF: -30 }, osc: (u) => ({ eF: 26 * Math.sin(u * TAU * 2.4), fpF: 10 * Math.sin(u * TAU * 2.4) }) },
    nod: { osc: (u) => ({ head: 8 * Math.sin(u * TAU * 2.3) }) },
    no: { yaw: (u) => 0.55 * Math.sin(u * TAU * 2.6) },
    laugh: { pose: { head: -16, lean: -6 }, expr: 'grin', osc: (u) => ({ lean: 3.5 * Math.sin(u * TAU * 6), head: 4 * Math.sin(u * TAU * 6 + 1) }) },
    tremble: { pose: { kF: 14, kB: 12 }, osc: (u) => { const o = {}; JOINTS.forEach((j, i) => (o[j] = 2.6 * noise(u * 14, i))); return o; } },
    clap: { pose: { sF: 72, eF: 30, sB: 72, eB: 30, spF: 22, spB: 22, fpF: -50, fpB: -50 }, osc: (u) => { const c = 0.5 + 0.5 * Math.sin(u * TAU * 3.2); return { fpF: 22 * c, fpB: 22 * c }; } },
    scratch: { pose: { sF: 146, eF: 70, spF: 35, fpF: -45, head: 10 }, osc: (u) => ({ eF: 9 * Math.sin(u * TAU * 5) }) },
    dance: { osc: (u) => { const s = Math.sin(u * TAU * 2); return { lean: 7 * s, sF: 100 + 55 * s, sB: 100 - 55 * s, eF: 40, eB: 40, spF: 30, spB: 30, kF: 18 + 18 * Math.abs(s), kB: 18 + 18 * Math.abs(s), head: -8 * s }; }, absolute: true },
    typing: { pose: POSES.type, osc: (u) => ({ eF: 6 * Math.sin(u * TAU * 7), eB: 6 * Math.sin(u * TAU * 7 + 2) }) },
    cry: { pose: { head: 22, lean: 10, sF: 100, eF: 105, spF: 25, fpF: -45 }, expr: 'cry', osc: (u) => ({ lean: 1.8 * Math.sin(u * TAU * 3.5) }) },
    pant: { pose: POSES.tired, osc: (u) => ({ lean: 3 * Math.sin(u * TAU * 2.2), head: 3 * Math.sin(u * TAU * 2.2) }) },
    bounce: { lift: (u) => 0.07 * Math.abs(Math.sin(u * TAU * 1.6)), osc: (u) => ({ kF: 10 * (1 - Math.abs(Math.sin(u * TAU * 1.6))), kB: 10 * (1 - Math.abs(Math.sin(u * TAU * 1.6))) }) },
    fist: { pose: { sF: 115, eF: 105, spF: 25, fpF: -30, lean: 6 }, expr: 'angry', osc: (u) => ({ sF: 8 * Math.sin(u * TAU * 7) }) },
    shiver: { pose: POSES.armsCrossed, osc: (u) => ({ lean: 1.8 * noise(u * 16, 3), head: 2 * noise(u * 16, 4), spF: 3 * noise(u * 16, 5) }) },
    talk: { osc: (u, seed) => ({ sF: 14 * noise(u * 1.3, seed), eF: 22 * noise(u * 1.7, seed + 2), spF: 10 * noise(u * 1.1, seed + 4) }) },
  };

  // gaits: cyc = body heights travelled per full stride cycle (two steps)
  const GAITS = {
    walk: { cyc: 0.82, A: 24, K: 42, arm: 22, el: 16, lean: 5, lift: 0, speed: 380, ease: 'sine.inOut' },
    run: { cyc: 1.5, A: 40, K: 100, arm: 52, el: 88, lean: 15, lift: 0.045, speed: 900, ease: 'power1.inOut' },
    sneak: { cyc: 0.62, A: 20, K: 58, arm: 12, el: 80, lean: 22, lift: 0, speed: 200, ease: 'sine.inOut', crouch: 1 },
    hop: { cyc: 0.9, hop: true, speed: 420, ease: 'none' },
    slide: { cyc: 1, none: true, speed: 500, ease: 'power2.inOut' },
  };
  function gaitPose(g, ph) {
    const s = Math.sin(ph), c = Math.cos(ph);
    if (g.hop) {
      const b = 1 - Math.abs(Math.sin(ph));
      return { lean: 4, head: -4, hF: 8, hB: 2, kF: 8 + 50 * b, kB: 8 + 52 * b, sF: 30 + 40 * (1 - b), eF: 30, sB: 25 + 40 * (1 - b), eB: 30, spF: 25, spB: 25, fpF: 0, fpB: 0, lsp: 4 };
    }
    return {
      lean: g.lean, head: -g.lean * 0.6,
      hF: g.A * s, hB: -g.A * s,
      kF: 6 + g.K * Math.pow(Math.max(0, c), 1.5), kB: 6 + g.K * Math.pow(Math.max(0, -c), 1.5),
      sF: -g.arm * s + 4, sB: g.arm * s + 4, eF: g.el + 14 * Math.max(0, -s), eB: g.el + 14 * Math.max(0, s),
      spF: 8, spB: 8, fpF: 0, fpB: 0, lsp: 2,
    };
  }

  // ───────────────────────── face ─────────────────────────
  const EXPRS = {
    neutral: { eyes: 'dot', mouth: 'flat' }, happy: { eyes: 'dot', mouth: 'smile' }, grin: { eyes: 'dot', mouth: 'grin' },
    sad: { eyes: 'dot', brow: 'sad', mouth: 'frown' }, angry: { eyes: 'dot', brow: 'angry', mouth: 'frown' },
    shock: { eyes: 'big', brow: 'up', mouth: 'o' }, worried: { eyes: 'dot', brow: 'sad', mouth: 'wavy' },
    smirk: { eyes: 'dot', brow: 'tilt', mouth: 'smirk' }, sleepy: { eyes: 'closed', mouth: 'flat' },
    love: { eyes: 'heart', mouth: 'smile' }, dead: { eyes: 'x', mouth: 'flat' }, cry: { eyes: 'closed', brow: 'sad', mouth: 'frown', tears: 1 },
    confused: { eyes: 'dot', brow: 'tilt', mouth: 'wavy' }, excited: { eyes: 'big', brow: 'up', mouth: 'grin' },
    determined: { eyes: 'dot', brow: 'angry', mouth: 'flat' }, joy: { eyes: 'happy', mouth: 'grin' },
    content: { eyes: 'happy', mouth: 'smile' }, disgust: { eyes: 'dot', brow: 'angry', mouth: 'wavy' }, bored: { eyes: 'half', mouth: 'flat' },
    blank: { eyes: 'none', mouth: 'none' },
  };
  const HAIRS = ['none', 'tuft', 'spiky', 'bob', 'long', 'bun', 'ponytail', 'cap', 'tophat', 'beanie', 'bow', 'crown', 'curly', 'mohawk'];
  const ACCESSORIES = ['tie', 'bowtie', 'glasses', 'mustache', 'beard', 'scarf', 'headphones', 'badge'];

  function hairPath(kind, r, fh) {
    const lx = Math.sqrt(Math.max(0, 1 - fh * fh)), b = -Math.sign(fh || 0.0001); // b = back side
    const top = -r;
    switch (kind) {
      case 'tuft': { const x = fh * r * 0.15; return { l: `M${n1(x - 10)},${n1(top + 4)}q-4,-26 -16,-34M${n1(x)},${n1(top + 2)}q2,-30 -2,-42M${n1(x + 10)},${n1(top + 4)}q8,-24 20,-30` }; }
      case 'spiky': { let d = `M${n1(-r * 0.85)},${n1(-r * 0.45)}`; for (let i = 0; i < 5; i++) { const a = -160 + i * 35 + 17, a2 = -160 + (i + 1) * 35; d += `L${n1(Math.cos(a * RAD) * r * 1.45 + fh * 6)},${n1(Math.sin(a * RAD) * r * 1.45)}L${n1(Math.cos(a2 * RAD) * r * 0.98)},${n1(Math.sin(a2 * RAD) * r * 0.98)}`; } return { a: d + 'Z' }; }
      case 'mohawk': { let d = `M${n1(-r * 0.25)},${n1(-r * 0.96)}`; for (let i = 0; i < 4; i++) d += `l${n1(10 + fh * 4)},-30l${n1(8 + fh * 4)},26`; return { a: d + 'Z' }; }
      case 'curly': { let d = ''; for (let i = 0; i < 7; i++) { const a = (-172 + i * 27) * RAD; d += `M${n1(Math.cos(a) * r * 1.02 + fh * 5)},${n1(Math.sin(a) * r * 1.02)}a${n1(r * 0.24)},${n1(r * 0.24)} 0 1 1 0.1,0`; } return { a: d }; }
      case 'bob': case 'long': case 'ponytail': case 'bun': {
        const sh = b * r * 0.18 * Math.abs(fh), len = kind === 'long' ? 1.25 : kind === 'bob' ? 0.55 : 0.1;
        const L = -r * 1.12 + sh, R = r * 1.12 + sh;
        const front = fh * r * 0.55;
        let d = `M${n1(L)},${n1(r * len)}C${n1(L - 6)},${n1(-r * 1.2)} ${n1(R + 6)},${n1(-r * 1.2)} ${n1(R)},${n1(r * len)}`;
        d += `L${n1(R - 18)},${n1(r * len)}C${n1(R - 18)},${n1(-r * 0.1)} ${n1(front + r * 0.5)},${n1(-r * 0.62)} ${n1(front)},${n1(-r * 0.55)}C${n1(front - r * 0.5)},${n1(-r * 0.62)} ${n1(L + 18)},${n1(-r * 0.1)} ${n1(L + 18)},${n1(r * len)}Z`;
        if (kind === 'ponytail') d += `M${n1(b * r * 0.85)},${n1(-r * 0.6)}c${n1(b * 40)},-6 ${n1(b * 62)},40 ${n1(b * 40)},${n1(r * 1.1)}c${n1(-b * 10)},-26 ${n1(-b * 18)},-50 ${n1(-b * 40)},${n1(-r * 0.75)}Z`;
        if (kind === 'bun') d += `M${n1(b * r * 0.35 * Math.abs(fh) - r * 0.3)},${n1(-r * 1.05)}a${n1(r * 0.32)},${n1(r * 0.32)} 0 1 1 ${n1(r * 0.6)},0a${n1(r * 0.32)},${n1(r * 0.32)} 0 1 1 ${n1(-r * 0.6)},0Z`;
        return { a: d };
      }
      case 'cap': {
        const dome = `M${n1(-r * 1.02)},${n1(-r * 0.3)}C${n1(-r * 1.05)},${n1(-r * 1.35)} ${n1(r * 1.05)},${n1(-r * 1.35)} ${n1(r * 1.02)},${n1(-r * 0.3)}Z`;
        const x0 = -r * 0.75 * lx + fh * r * 0.3, x1 = r * 0.75 * lx + fh * r * 1.5;
        return { a: dome + `M${n1(Math.min(x0, x1))},${n1(-r * 0.32)}L${n1(Math.max(x0, x1))},${n1(-r * 0.32)}L${n1(Math.max(x0, x1) - 8 * Math.sign(fh || 1))},${n1(-r * 0.2)}L${n1(Math.min(x0, x1))},${n1(-r * 0.22)}Z` };
      }
      case 'tophat': return { a: `M${n1(-r * 1.25)},${n1(-r * 0.62)}h${n1(r * 2.5)}v-14h${n1(-r * 2.5)}Z M${n1(-r * 0.75)},${n1(-r * 0.75)}v${n1(-r * 1.1)}h${n1(r * 1.5)}v${n1(r * 1.1)}Z` };
      case 'beanie': return { a: `M${n1(-r * 1.04)},${n1(-r * 0.25)}C${n1(-r * 1.1)},${n1(-r * 1.4)} ${n1(r * 1.1)},${n1(-r * 1.4)} ${n1(r * 1.04)},${n1(-r * 0.25)}Z M-14,${n1(-r * 1.08)}a14,14 0 1 1 28,0a14,14 0 1 1 -28,0Z` };
      case 'bow': { const x = -fh * r * 0.2 + r * 0.55, y = -r * 0.85; return { a: `M${n1(x)},${n1(y)}l-34,-20v40Z M${n1(x)},${n1(y)}l34,-20v40Z` }; }
      case 'crown': return { a: `M${n1(-r * 0.7)},${n1(-r * 0.78)}l-6,-58l36,30l${n1(r * 0.7 - 30)},-44l${n1(r * 0.7 - 30)},44l36,-30l-6,58Z` };
      default: return {};
    }
  }

  // ───────────────────────── props ─────────────────────────
  // Each prop is line art around its anchor: 'b' = bottom-centre sits on the ground/at y, 'c' = centre,
  // 'g' = the grip point a hand holds. Classes: o = outlined paper shape, l = line, f = ink fill,
  // a = accent fill (prop "color"), s = soft fill, t = text. Sizes are px at scale 1 next to a 520 px person.
  function scallop(cx, cy, rx, ry, n, bulge) {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU - Math.PI / 2; pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
    let d = `M${n1(pts[0][0])},${n1(pts[0][1])}`;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n], ch = Math.hypot(q[0] - p[0], q[1] - p[1]);
      d += `A${n1(ch * (bulge || 0.62))},${n1(ch * (bulge || 0.62))} 0 0 1 ${n1(q[0])},${n1(q[1])}`;
    }
    return d + 'Z';
  }
  function starPath(r1, r2, n, cy) {
    let d = '';
    for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * TAU - Math.PI / 2, r = i % 2 ? r2 : r1; d += (i ? 'L' : 'M') + n1(Math.cos(a) * r) + ',' + n1(Math.sin(a) * r + (cy || 0)); }
    return d + 'Z';
  }
  const T = (x, y, s, txt, cls) => `<text class="${cls || 't'}" x="${x}" y="${y}" style="font-size:${s}px">${esc(txt)}</text>`;
  const PROPS = {
    table: { a: 'b', svg: () => '<path class="o" d="M-160,-175h320v20h-320z"/><path class="l" d="M-135,-155V0M135,-155V0"/>' },
    desk: { a: 'b', svg: () => '<path class="o" d="M-170,-175h340v22h-340z"/><path class="o" d="M60,-153h95v100h-95z"/><path class="l" d="M-150,-153V0M155,-53V0M88,-105h40"/>' },
    chair: { a: 'b', svg: () => '<path class="l" d="M-62,-128h124M-52,-128V0M52,-128V0M-62,-128V-300"/>' },
    stool: { a: 'b', svg: () => '<path class="l" d="M-55,-128h110M-40,-128L-58,0M40,-128L58,0M-48,-55h96"/>' },
    sofa: { a: 'b', svg: () => '<path class="a" d="M-200,-270h400v130h-400z"/><path class="a" d="M-215,-150h430v80h-430z"/><path class="a" d="M-250,-220h50v150h-50zM200,-220h50v150h-50z"/><path class="l" d="M-200,-70v70M200,-70v70"/>', color: 'red' },
    bed: { a: 'b', svg: () => '<path class="l" d="M-260,-250V0M260,-170V0"/><path class="o" d="M-260,-110h520v40h-520z"/><rect class="o" x="-245" y="-146" width="95" height="36" rx="16"/><path class="a" d="M-135,-110h385v-30h-385z"/>', color: 'sky' },
    door: { a: 'b', svg: () => '<path class="o" d="M-100,-400h200v400h-200z"/><circle class="f" cx="68" cy="-200" r="9"/>' },
    window: { a: 'c', svg: (o) => `<path class="o" d="M-110,-110h220v220h-220z" style="fill:${o.night ? 'var(--ink)' : 'var(--paper)'}"/><path class="l" d="M0,-110V110M-110,0H110"/>` },
    frame: { a: 'c', svg: () => '<path class="o" d="M-75,-58h150v116h-150z"/><path class="l" d="M-55,35l35,-42l25,26l22,-22l23,38"/><circle class="a" cx="-30" cy="-25" r="11"/>', color: 'yellow' },
    tree: { a: 'b', svg: () => `<path class="l" d="M0,0V-240M0,-150l-42,-42M0,-185l36,-36"/><path class="a" d="${scallop(0, -330, 140, 115, 9)}"/>`, color: 'leaf' },
    pine: { a: 'b', svg: () => '<path class="l" d="M0,0V-60"/><path class="a" d="M0,-420L-90,-250h45L-120,-120h55L-150,-60h300L65,-120h55L45,-250h45Z"/>', color: 'green' },
    bush: { a: 'b', svg: () => `<path class="a" d="${scallop(0, -62, 120, 62, 9)}"/>`, color: 'leaf' },
    flower: { a: 'b', svg: () => `<path class="l" d="M0,0V-80M0,-35q-22,-10 -30,-30"/><path class="a" d="${scallop(0, -95, 26, 26, 6, 0.75)}"/><circle class="f" cx="0" cy="-95" r="8"/>`, color: 'pink' },
    cloud: { a: 'c', svg: (o) => `<path class="o" d="${scallop(0, 0, 150, 62, 10)}"/>` + (o.rain ? '<path class="l" d="M-70,80l-12,30M-10,80l-12,30M50,80l-12,30" style="stroke:var(--ac)"/>' : ''), color: 'blue' },
    sun: { a: 'c', svg: () => { let d = ''; for (let i = 0; i < 10; i++) { const a = i * 36 * RAD; d += `M${n1(Math.cos(a) * 85)},${n1(Math.sin(a) * 85)}L${n1(Math.cos(a) * 120)},${n1(Math.sin(a) * 120)}`; } return `<path class="l rays" d="${d}"/><circle class="a" r="65"/>`; }, color: 'yellow' },
    moon: { a: 'c', svg: () => '<path class="a" d="M20,-70A75,75 0 1 0 70,30A60,60 0 1 1 20,-70Z"/>', color: 'yellow' },
    star: { a: 'c', svg: () => `<path class="a" d="${starPath(60, 26, 5)}"/>`, color: 'yellow' },
    mountain: { a: 'b', svg: () => '<path class="o" d="M-300,0L-60,-380L60,-250L130,-320L320,0Z"/><path class="a" d="M-118,-288L-60,-380L4,-282L-30,-300L-60,-270L-90,-300Z"/>', color: 'white' },
    hill: { a: 'b', svg: () => '<path class="s" d="M-500,0C-300,-260 300,-260 500,0Z"/>' },
    house: { a: 'b', svg: () => '<path class="o" d="M-150,0V-210H150V0Z"/><path class="a" d="M-185,-205L0,-345L185,-205Z"/><path class="o" d="M-45,0v-120h90v120"/><path class="o" d="M70,-170h55v50h-55z"/><path class="o" d="M-125,-170h55v50h-55z"/>', color: 'red' },
    building: { a: 'b', svg: (o) => { const h = o.h || 620, w = o.w || 230; let d = ''; for (let y = -h + 50; y < -80; y += 80) for (let x = -w / 2 + 35; x < w / 2 - 40; x += 62) d += `M${x},${y}h32v42h-32z`; return `<path class="o" d="M${-w / 2},0V${-h}H${w / 2}V0Z"/><path class="a" d="${d}"/><path class="o" d="M-28,0v-70h56v70"/>`; }, color: 'sky' },
    shop: { a: 'b', svg: (o) => `<path class="o" d="M-170,0V-260H170V0Z"/><path class="a" d="M-190,-260h380l-20,60h-340z"/><path class="o" d="M-140,-170h150v110h-150z"/><path class="o" d="M45,0v-150h90v150"/>${o.text ? T(0, -300, 48, o.text) : ''}`, color: 'red' },
    car: { a: 'b', svg: () => '<path class="a" d="M-190,-40V-110Q-185,-130 -150,-132L-95,-200H70L130,-132Q185,-128 190,-100V-40Z"/><path class="o" d="M-78,-185h65v53h-80zM10,-185h55l45,53h-100z"/><g class="wheel" data-r="38" transform="translate(-110,-38)"><circle class="o" r="38"/><path class="l" d="M-20,0H20M0,-20V20"/></g><g class="wheel" data-r="38" transform="translate(115,-38)"><circle class="o" r="38"/><path class="l" d="M-20,0H20M0,-20V20"/></g>', color: 'red' },
    bike: { a: 'b', svg: () => '<g class="wheel" data-r="55" transform="translate(-95,-55)"><circle class="l" r="55"/><path class="l" d="M-30,0H30M0,-30V30"/></g><g class="wheel" data-r="55" transform="translate(95,-55)"><circle class="l" r="55"/><path class="l" d="M-30,0H30M0,-30V30"/></g><path class="l" d="M-95,-55L-25,-55L40,-150L-50,-150L-25,-55M40,-150L95,-55M40,-150l-8,-40h35M-50,-150l-10,-30h-30"/>' },
    plane: { a: 'c', svg: () => '<path class="o" d="M-170,0Q-160,-35 -100,-35H140Q180,-30 180,0Q180,25 140,25H-120Z"/><path class="a" d="M-20,-30L40,-30L-30,-110H-70ZM-20,20L40,20L-30,95H-70ZM-150,-30l-25,-60h40l35,60z"/><path class="l" d="M110,-15h40"/>', color: 'blue' },
    rocket: { a: 'c', svg: () => '<path class="o" d="M0,-150C60,-90 60,20 40,70H-40C-60,20 -60,-90 0,-150Z"/><circle class="a" cy="-40" r="22"/><path class="a" d="M-40,30L-80,90L-35,75ZM40,30L80,90L35,75Z"/><path class="a flame" d="M-28,72Q0,170 28,72Z" style="fill:#FB8500"/>', color: 'sky' },
    laptop: { a: 'b', svg: (o) => `<path class="o" d="M-78,-110h156v100h-156z" style="fill:var(--ac)"/><path class="o" d="M-100,-10h200l-12,10h-176z"/>${o.text ? T(0, -60, 28, o.text, 't tl') : ''}`, color: 'sky' },
    monitor: { a: 'b', svg: (o) => `<path class="o" d="M-120,-230h240v160h-240z" style="fill:var(--ac)"/><path class="l" d="M0,-70V-15M-50,-12h100"/>${o.text ? T(0, -150, 36, o.text, 't tl') : ''}`, color: 'sky' },
    tv: { a: 'b', svg: (o) => `<path class="o" d="M-150,-260h300v200h-300z"/><path class="o" d="M-130,-240h260v160h-260z" style="fill:var(--ac)"/><path class="l" d="M-90,-60l-25,60M90,-60l25,60M-40,-260l-40,-60M40,-260l40,-60"/>${o.text ? T(0, -160, 40, o.text, 't tl') : ''}`, color: 'sky' },
    phone: { a: 'g', svg: (o) => `<rect class="o" x="-24" y="-44" width="48" height="88" rx="9" style="stroke-width:7"/><rect class="a" x="-15" y="-32" width="30" height="58" rx="3" style="stroke-width:0"/>${o.text ? T(0, -3, 16, o.text) : ''}`, color: 'sky' },
    cup: { a: 'g', svg: (o) => '<path class="a" d="M-26,-32h52l-7,64h-38z"/><path class="l" d="M25,-18a16,16 0 0 1 0,30"/>' + (o.steam ? '<path class="l" d="M-8,-45q-8,-14 0,-28M10,-45q-8,-14 0,-28" style="stroke-width:5"/>' : ''), color: 'white' },
    book: { a: 'g', svg: () => '<path class="a" d="M-48,-34h96v68h-96z"/><path class="l" d="M-34,-34v68M-20,-12h50M-20,6h40"/>', color: 'blue' },
    briefcase: { a: 'g', svg: () => '<path class="l" d="M-20,6v-18h40v18"/><rect class="a" x="-60" y="4" width="120" height="80" rx="10"/><path class="l" d="M-60,36h120"/>', color: 'brown' },
    bag: { a: 'g', svg: () => '<path class="l" d="M-25,30q0,-45 25,-45q25,0 25,45"/><path class="a" d="M-55,25h110l12,110h-134z"/>', color: 'orange' },
    moneybag: { a: 'b', svg: () => `<path class="a" d="M-28,-118Q-80,-80 -72,-35Q-66,0 0,0Q66,0 72,-35Q80,-80 28,-118Z"/><path class="l" d="M-30,-120q30,12 60,0M-22,-122l-16,-26h76l-16,26"/>${T(0, -50, 64, '$')}`, color: 'gold' },
    coin: { a: 'c', svg: () => `<circle class="a" r="42"/><circle class="l" r="30" style="stroke-width:4"/>${T(0, 2, 44, '$')}`, color: 'gold' },
    cash: { a: 'c', svg: () => `<rect class="a" x="-80" y="-40" width="160" height="80" rx="6"/><circle class="l" r="22" style="stroke-width:5"/>${T(0, 1, 32, '$')}`, color: 'mint' },
    dollar: { a: 'c', svg: () => T(0, 0, 200, '$', 't ta'), color: 'green' },
    heart: { a: 'c', svg: () => '<path class="a" d="M0,55C-90,0 -75,-75 0,-38C75,-75 90,0 0,55Z"/>', color: 'red' },
    brokenheart: { a: 'c', svg: () => '<path class="a" d="M-6,55C-96,0 -81,-75 -6,-38L-22,-8L4,10L-14,40Z"/><path class="a" d="M10,55C96,0 81,-75 6,-38L-6,-8L20,10L2,40Z"/>', color: 'red' },
    bulb: { a: 'c', svg: (o) => '<path class="a" d="M-28,40C-30,10 -62,-5 -62,-45A62,62 0 1 1 62,-45C62,-5 30,10 28,40Z"/><path class="l" d="M-24,55h48M-18,70h36M-12,-20l12,22l12,-22"/>' + (o.rays === false ? '' : '<path class="l rays" d="M0,-140v-28M-85,-110l-20,-20M85,-110l20,-20M-110,-45h-28M110,-45h28"/>'), color: 'yellow' },
    clock: { a: 'c', svg: () => { let d = ''; for (let i = 0; i < 12; i++) { const a = i * 30 * RAD; d += `M${n1(Math.cos(a) * 70)},${n1(Math.sin(a) * 70)}L${n1(Math.cos(a) * 80)},${n1(Math.sin(a) * 80)}`; } return `<circle class="o" r="95"/><path class="l" d="${d}" style="stroke-width:5"/><path class="l hh" d="M0,0V-45"/><path class="l mh" d="M0,0V-68" style="stroke-width:6"/><circle class="f" r="7"/>`; } },
    hourglass: { a: 'c', svg: () => '<path class="o" d="M-45,-100H45C45,-40 8,-18 8,0C8,18 45,40 45,100H-45C-45,40 -8,18 -8,0C-8,-18 -45,-40 -45,-100Z"/><path class="a" d="M-36,94C-30,60 30,60 36,94Z M-30,-70H30C18,-45 -18,-45 -30,-70Z"/><path class="l" d="M-62,-100h124M-62,100h124" style="stroke-width:12"/>', color: 'gold' },
    calendar: { a: 'c', svg: (o) => `<rect class="o" x="-90" y="-85" width="180" height="170" rx="10"/><path class="a" d="M-90,-85h180v50h-180z"/><path class="l" d="M-50,-100v30M50,-100v30"/>${T(0, 25, 70, o.text || '1')}`, color: 'red' },
    sign: { a: 'b', svg: (o) => { const w = Math.max(200, (o.text || '').length * 30 + 60); return `<path class="l" d="M0,0V-200"/><rect class="o" x="${-w / 2}" y="-330" width="${w}" height="130" rx="8"/>${T(0, -265, 56, o.text || '')}`; } },
    placard: { a: 'g', svg: (o) => { const w = Math.max(180, (o.text || '').length * 28 + 50); return `<path class="l" d="M0,40V-130"/><rect class="o" x="${-w / 2}" y="-240" width="${w}" height="115" rx="8"/>${T(0, -182, 50, o.text || '')}`; } },
    board: { a: 'b', svg: (o) => `<path class="o" d="M-260,-560h520v330h-520z"/><path class="l" d="M-200,-230L-230,0M200,-230L230,0"/>${o.text ? T(0, -395, 64, o.text) : ''}` },
    chart: { a: 'b', svg: (o) => { const v = o.values || [3, 5, 8], n = v.length, w = 300 / n; let s = '<path class="l" d="M-170,-330V0H180"/>'; v.forEach((_, i) => (s += `<rect class="a bar" x="${n1(-150 + i * w + w * 0.15)}" y="0" width="${n1(w * 0.7)}" height="0"/>`)); return s; }, color: 'blue' },
    graph: { a: 'b', svg: (o) => { const v = o.values || [2, 3, 2.5, 5, 8], mx = Math.max(...v), n = v.length; const pts = v.map((y, i) => `${n1(-160 + (i / (n - 1)) * 320)},${n1(-20 - (y / mx) * 290)}`); return `<path class="l" d="M-170,-330V0H180"/><path class="l line" d="M${pts.join('L')}" style="stroke:var(--ac);stroke-width:12"/>`; }, color: 'red' },
    battery: { a: 'c', svg: () => '<rect class="o" x="-110" y="-50" width="210" height="100" rx="14"/><path class="f" d="M100,-20h18v40h-18z"/><rect class="a lvl" x="-96" y="-36" width="182" height="72" rx="6" style="stroke-width:0"/>', color: 'green' },
    meter: { a: 'c', svg: () => '<path class="o" d="M-150,0A150,150 0 0 1 150,0Z"/><path class="l" d="M-120,0A120,120 0 0 1 -60,-104" style="stroke:#2A9D8F;stroke-width:16"/><path class="l" d="M-60,-104A120,120 0 0 1 60,-104" style="stroke:#FFBE0B;stroke-width:16"/><path class="l" d="M60,-104A120,120 0 0 1 120,0" style="stroke:#E63946;stroke-width:16"/><path class="l needle" d="M0,0V-110" style="stroke-width:9"/><circle class="f" r="12"/>' },
    trophy: { a: 'b', svg: () => '<path class="a" d="M-70,-260h140c0,90 -30,130 -70,135c-40,-5 -70,-45 -70,-135Z"/><path class="l" d="M-70,-235h-40c0,50 30,65 50,65M70,-235h40c0,50 -30,65 -50,65M0,-125v70"/><path class="a" d="M-60,0v-55h120v55z"/>', color: 'gold' },
    medal: { a: 'c', svg: () => '<path class="a" d="M-40,-120L-15,-30H15L40,-120Z" style="fill:#3A86FF"/><circle class="a" cy="20" r="55"/><path class="l" d="M0,0v40" style="stroke-width:6"/>', color: 'gold' },
    flag: { a: 'b', svg: () => '<path class="l" d="M0,0V-360"/><path class="a cloth" d="M0,-355h150v95h-150z"/>', color: 'red' },
    gift: { a: 'b', svg: () => '<path class="a" d="M-90,0v-140h180v140z"/><path class="a" d="M-105,-140v-45h210v45z"/><path class="l" d="M0,0v-185M0,-185c-30,-50 -70,-30 -50,-5M0,-185c30,-50 70,-30 50,-5"/>', color: 'pink' },
    box: { a: 'b', svg: () => '<path class="a" d="M-100,0v-170h200v170z"/><path class="l" d="M-100,-130h200M-30,-170v40h60v-40"/>', color: 'brown' },
    bomb: { a: 'c', svg: () => '<circle class="f" r="70"/><path class="o" d="M30,-65l20,-25h30l-10,30z"/><path class="l" d="M75,-80q30,-40 60,-20"/><path class="a spark" d="' + starPath(26, 10, 6) + '" transform="translate(140,-105)"/>', color: 'orange' },
    fire: { a: 'b', svg: () => '<path class="a flame" d="M0,0C-90,0 -95,-70 -50,-130C-45,-90 -20,-85 -20,-110C-20,-160 10,-190 30,-230C35,-170 90,-140 85,-70C82,-25 55,0 0,0Z" style="fill:#FB8500"/><path class="a flame2" d="M0,0C-40,0 -45,-40 -20,-80C-10,-55 10,-60 12,-90C35,-60 45,-30 40,-15C35,0 15,0 0,0Z" style="fill:#FFBE0B"/>' },
    boom: { a: 'c', svg: (o) => `<path class="a" d="${starPath(150, 85, 12)}"/>${T(0, 5, 70, o.text || 'BOOM')}`, color: 'yellow' },
    key: { a: 'c', svg: () => '<circle class="a" cx="-60" r="36"/><circle class="o" cx="-60" r="12"/><path class="l" d="M-24,0H90M60,0v28M85,0v22" style="stroke-width:12"/>', color: 'gold' },
    lock: { a: 'c', svg: (o) => `<path class="l" d="M-45,-30v-40a45,45 0 0 1 90,0${o.open ? 'v-25' : 'v40'}" style="stroke-width:14"/><rect class="a" x="-70" y="-30" width="140" height="110" rx="14"/><circle class="f" cy="20" r="12"/>`, color: 'gold' },
    mail: { a: 'c', svg: () => '<rect class="o" x="-100" y="-65" width="200" height="130" rx="8"/><path class="l" d="M-100,-60L0,10L100,-60"/>' },
    bell: { a: 'c', svg: () => '<path class="a" d="M-70,40C-60,20 -55,-10 -55,-40A55,55 0 0 1 55,-40C55,-10 60,20 70,40Z"/><circle class="f" cy="55" r="14"/><path class="l" d="M0,-95v-12"/>', color: 'gold' },
    magnifier: { a: 'c', svg: () => '<circle class="o" cx="-25" cy="-25" r="65" style="fill:#E8F4FB"/><path class="l" d="M22,22L90,90" style="stroke-width:20"/>' },
    pill: { a: 'c', svg: () => '<rect class="o" x="-80" y="-34" width="160" height="68" rx="34" transform="rotate(-25)"/><path class="a" d="M0,-34h-46a34,34 0 0 0 0,68h46z" transform="rotate(-25)"/>', color: 'red' },
    globe: { a: 'c', svg: () => '<circle class="a" r="100"/><path class="l" d="M-100,0h200M0,-100c-60,60 -60,140 0,200M0,-100c60,60 60,140 0,200M-85,-50h170M-85,50h170" style="stroke-width:5"/>', color: 'sky' },
    ball: { a: 'c', svg: () => '<circle class="a" r="50"/><path class="l" d="M-50,0C-20,-20 20,20 50,0M-20,-46C0,-20 0,20 -20,46" style="stroke-width:5"/>', color: 'orange' },
    balloon: { a: 'g', svg: () => '<path class="l" d="M0,0q-14,-80 0,-160" style="stroke-width:4"/><path class="a" d="M0,-160c-60,0 -75,-75 -60,-115c15,-40 105,-40 120,0c15,40 0,115 -60,115Z"/>', color: 'red' },
    umbrella: { a: 'g', svg: () => '<path class="l" d="M0,0V-200M0,0q0,22 -22,22"/><path class="a" d="M-160,-190C-140,-300 140,-300 160,-190C120,-210 80,-210 53,-190C25,-210 -25,-210 -53,-190C-80,-210 -120,-210 -160,-190Z"/>', color: 'blue' },
    megaphone: { a: 'g', svg: () => '<path class="a" d="M-20,-30L80,-80V60L-20,10Z"/><path class="o" d="M-50,-30h30v40h-30z"/><path class="l" d="M-35,10v35"/>', color: 'red' },
    dog: { a: 'b', svg: () => '<path class="l" d="M-80,-90H60M-70,-90L-80,0M-50,-90L-40,0M40,-90L30,0M60,-90L70,0M-80,-90l-40,-35"/><circle class="o" cx="90" cy="-125" r="38"/><path class="f" d="M70,-160l-25,45l20,6z"/><circle class="f" cx="102" cy="-130" r="5"/><circle class="f" cx="127" cy="-118" r="6"/>' },
    cat: { a: 'b', svg: () => '<path class="l" d="M-70,-80H50M-60,-80L-65,0M-40,-80L-35,0M30,-80L25,0M50,-80L55,0M-70,-80q-50,-10 -40,-80"/><circle class="o" cx="75" cy="-112" r="34"/><path class="o" d="M52,-135l-6,-34l26,18zM98,-135l6,-34l-26,18z"/><circle class="f" cx="68" cy="-115" r="4"/><circle class="f" cx="90" cy="-115" r="4"/>' },
    bird: { a: 'c', svg: () => '<path class="l" d="M-60,0q30,-30 60,0q30,-30 60,0"/>' },
    grave: { a: 'b', svg: (o) => `<path class="o" d="M-90,0V-180A90,90 0 0 1 90,-180V0Z"/>${T(0, -150, 54, o.text || 'RIP')}` },
    ladder: { a: 'b', svg: () => { let d = 'M-55,0V-480M55,0V-480'; for (let y = -50; y > -480; y -= 70) d += `M-55,${y}H55`; return `<path class="l" d="${d}"/>`; } },
    stairs: { a: 'b', svg: () => '<path class="o" d="M-240,0V-60H-160V-120H-80V-180H0V-240H80V-300H160V0Z"/>' },
    plant: { a: 'b', svg: () => `<path class="a" d="M-45,0L-55,-85H55L45,0Z" style="fill:#C9734B"/><path class="l" d="M0,-85V-150M0,-110q-40,-10 -55,-55M0,-125q35,-15 50,-60"/><path class="a" d="${scallop(0, -175, 55, 42, 7)}"/>`, color: 'leaf' },
    lamp: { a: 'b', svg: () => '<path class="l" d="M0,0V-380M-50,0h100"/><path class="a" d="M-60,-370L-35,-460H35L60,-370Z"/>', color: 'yellow' },
    streetlamp: { a: 'b', svg: () => '<path class="l" d="M0,0V-560q0,-40 50,-40h40"/><path class="a" d="M70,-600h60l-10,30h-40z"/>', color: 'yellow' },
    fence: { a: 'b', svg: () => { let d = 'M-300,-80H300M-300,-140H300'; for (let x = -280; x <= 280; x += 70) d += `M${x},0V-170`; return `<path class="l" d="${d}"/>`; } },
    fridge: { a: 'b', svg: () => '<rect class="o" x="-110" y="-480" width="220" height="480" rx="14"/><path class="l" d="M-110,-320H110M75,-420v60M75,-280v80"/>' },
    counter: { a: 'b', svg: () => '<path class="o" d="M-260,-200h520v200h-520z"/><path class="o" d="M-275,-215h550v25h-550z"/><path class="l" d="M-80,-170V-20M80,-170V-20"/>' },
    trash: { a: 'b', svg: () => '<path class="o" d="M-70,-180L-58,0H58L70,-180Z"/><path class="o" d="M-85,-200h170v20h-170z"/><path class="l" d="M-25,-150V-30M25,-150V-30"/>' },
    cart: { a: 'b', svg: () => '<path class="l" d="M-160,-200h40l40,140h180l30,-110H-90"/><circle class="o" cx="-60" cy="-25" r="22"/><circle class="o" cx="90" cy="-25" r="22"/>' },
    burger: { a: 'c', svg: () => '<path class="a" d="M-80,-10C-80,-80 80,-80 80,-10Z" style="fill:#E9B949"/><path class="a" d="M-90,-8h180v22h-180z" style="fill:#6BBF59"/><path class="a" d="M-85,14h170v26h-170z" style="fill:#9C6644"/><path class="a" d="M-80,40h160c0,25 -20,30 -40,30h-80c-20,0 -40,-5 -40,-30Z" style="fill:#E9B949"/>' },
    apple: { a: 'c', svg: () => '<path class="a" d="M0,-40C-30,-65 -80,-50 -75,10C-70,60 -30,80 0,65C30,80 70,60 75,10C80,-50 30,-65 0,-40Z"/><path class="l" d="M0,-40q0,-25 15,-40"/>', color: 'red' },
    crown: { a: 'c', svg: () => '<path class="a" d="M-90,50L-100,-50L-45,0L0,-70L45,0L100,-50L90,50Z"/>', color: 'gold' },
    brain: { a: 'c', svg: () => `<path class="a" d="${scallop(0, 0, 120, 90, 11, 0.6)}"/><path class="l" d="M0,-85V85M-70,-30q30,15 60,0M10,25q35,15 70,-5M-75,40q20,-15 45,0" style="stroke-width:6"/>`, color: 'pink' },
    target: { a: 'c', svg: () => '<circle class="a" r="110" style="fill:#E63946"/><circle class="o" r="75"/><circle class="a" r="42" style="fill:#E63946"/><circle class="f" r="12"/>' },
    arrow: { a: 'c', svg: () => '<path class="a" d="M-120,-30H30V-75L120,0L30,75V30H-120Z"/>', color: 'red' },
    check: { a: 'c', svg: () => '<path class="l" d="M-70,0L-20,50L80,-60" style="stroke:var(--ac);stroke-width:30"/>', color: 'green' },
    cross: { a: 'c', svg: () => '<path class="l" d="M-60,-60L60,60M60,-60L-60,60" style="stroke:var(--ac);stroke-width:30"/>', color: 'red' },
    qmark: { a: 'c', svg: () => T(0, 0, 220, '?', 't ta'), color: 'blue' },
    exmark: { a: 'c', svg: () => T(0, 0, 220, '!', 't ta'), color: 'red' },
    drop: { a: 'c', svg: () => '<path class="a" d="M0,-70C25,-30 50,0 50,25A50,50 0 0 1 -50,25C-50,0 -25,-30 0,-70Z"/>', color: 'sky' },
    snowman: { a: 'b', svg: () => '<circle class="o" cy="-80" r="80"/><circle class="o" cy="-210" r="58"/><path class="a" d="M0,-205l50,10l-50,8z" style="fill:#FB8500"/><circle class="f" cx="-18" cy="-225" r="6"/><circle class="f" cx="18" cy="-225" r="6"/>' },
  };
  const PROP_ANCHOR_HELD = { phone: [0, 0], cup: [-6, 0], book: [0, 0], briefcase: [0, 0], bag: [0, 0], placard: [0, 30], balloon: [0, 0], umbrella: [0, 0], megaphone: [-35, 25] };

  // prop parts that react to time / value
  function propUpdate(p, t, v) {
    const k = p.kind, g = p.g;
    if (k === 'clock') {
      const hrs = typeof v === 'number' ? v : p.base.value ?? 10.17;
      p.hh = p.hh || g.querySelector('.hh'); p.mh = p.mh || g.querySelector('.mh');
      p.hh.setAttribute('transform', `rotate(${n1((hrs % 12) * 30)})`);
      p.mh.setAttribute('transform', `rotate(${n1((hrs % 1) * 360)})`);
    } else if (k === 'chart') {
      const vals = p.base.values || [3, 5, 8], mx = Math.max(...vals);
      p.bars = p.bars || [...g.querySelectorAll('.bar')];
      const prog = typeof v === 'number' ? v : 1;
      p.bars.forEach((b, i) => { const q = smooth(prog * vals.length - i * 0.6); const h = (vals[i] / mx) * 300 * q; b.setAttribute('y', n1(-h)); b.setAttribute('height', n1(h)); });
    } else if (k === 'graph') {
      p.line = p.line || g.querySelector('.line');
      if (!p.line.hasAttribute('pathLength')) { p.line.setAttribute('pathLength', '1'); p.line.style.strokeDasharray = '1 1'; }
      p.line.style.strokeDashoffset = String(1 - clamp(typeof v === 'number' ? v : 1, 0, 1));
    } else if (k === 'battery') {
      p.lvl = p.lvl || g.querySelector('.lvl');
      const lv = clamp(typeof v === 'number' ? v : 1, 0, 1);
      p.lvl.setAttribute('width', n1(182 * lv));
      p.lvl.style.fill = lv < 0.25 ? '#E63946' : lv < 0.55 ? '#FFBE0B' : 'var(--ac)';
    } else if (k === 'meter') {
      p.nd = p.nd || g.querySelector('.needle');
      p.nd.setAttribute('transform', `rotate(${n1(-90 + 180 * clamp(typeof v === 'number' ? v : 0.5, 0, 1))})`);
    } else if (k === 'sun' || k === 'bulb') {
      p.rays = p.rays || g.querySelector('.rays');
      if (p.rays) p.rays.setAttribute('transform', `rotate(${n1(t * 12)}) scale(${n1(1 + 0.05 * Math.sin(t * 5))})`);
    } else if (k === 'fire' || k === 'rocket') {
      p.fl = p.fl || [...g.querySelectorAll('.flame,.flame2')];
      p.fl.forEach((f, i) => f.setAttribute('transform', `scale(${n1(1 + 0.08 * noise(t * 9, i))},${n1(1 + 0.12 * noise(t * 8, i + 3))})`));
    } else if (k === 'flag') {
      p.cl = p.cl || g.querySelector('.cloth');
      const w = 10 * Math.sin(t * 6);
      p.cl.setAttribute('d', `M0,-355q75,${n1(w)} 150,0v95q-75,${n1(w)} -150,0z`);
    } else if (k === 'bomb') {
      p.sp = p.sp || g.querySelector('.spark');
      p.sp.setAttribute('transform', `translate(140,-105) rotate(${n1(t * 400)}) scale(${n1(0.8 + 0.3 * Math.abs(Math.sin(t * 15)))})`);
    }
  }

  // ───────────────────────── emotes ─────────────────────────
  const EMOTES = {
    '!': (ac) => `<text class="t ta" style="font-size:110px;fill:${ac || '#E63946'}">!</text>`,
    '?': (ac) => `<text class="t ta" style="font-size:110px;fill:${ac || '#3A86FF'}">?</text>`,
    heart: () => '<path class="a" d="M0,30C-50,0 -42,-42 0,-21C42,-42 50,0 0,30Z" style="--ac:#E63946"/>',
    idea: () => '<path class="a" d="M-16,24C-17,6 -36,-3 -36,-26A36,36 0 1 1 36,-26C36,-3 17,6 16,24Z" style="--ac:#FFBE0B"/><path class="l" d="M-14,34h28M0,-80v-16M-52,-62l-12,-12M52,-62l12,-12"/>',
    sweat: () => '<path class="a" d="M0,-30C14,-10 26,4 26,16A26,26 0 0 1 -26,16C-26,4 -14,-10 0,-30Z" style="--ac:#8ECAE6"/>',
    anger: () => '<path class="l" d="M-30,-10q20,0 20,-20M30,-10q-20,0 -20,-20M-30,10q20,0 20,20M30,10q-20,0 -20,20" style="stroke:#E63946;stroke-width:8"/>',
    zzz: () => '<text class="t" x="0" y="0" style="font-size:54px">z</text><text class="t" x="34" y="-40" style="font-size:44px">z</text><text class="t" x="60" y="-74" style="font-size:34px">z</text>',
    music: () => '<path class="l" d="M-20,20V-40L30,-52V8"/><circle class="f" cx="-30" cy="22" r="13"/><circle class="f" cx="20" cy="10" r="13"/>',
    sparkle: () => `<path class="a" d="${starPath(40, 12, 4)}" style="--ac:#FFBE0B"/><path class="a" d="${starPath(20, 6, 4, 0)}" transform="translate(48,-40)" style="--ac:#FFBE0B"/>`,
    dots: () => '<circle class="f" cx="-30" r="9"/><circle class="f" r="9"/><circle class="f" cx="30" r="9"/>',
    check: () => '<path class="l" d="M-30,0L-8,22L34,-26" style="stroke:#2A9D8F;stroke-width:16"/>',
    cross: () => '<path class="l" d="M-26,-26L26,26M26,-26L-26,26" style="stroke:#E63946;stroke-width:16"/>',
    dollar: () => '<text class="t ta" style="font-size:96px;fill:#2A9D8F">$</text>',
    skull: () => '<path class="o" d="M-34,10C-50,-40 -30,-60 0,-60C30,-60 50,-40 34,10V30H-34Z"/><circle class="f" cx="-14" cy="-14" r="10"/><circle class="f" cx="14" cy="-14" r="10"/>',
  };

  // ───────────────────────── sets (backgrounds) ─────────────────────────
  // depth: 0.5 far (moves half as fast as the camera), 1 mid, 1.35 near; soft = drawn in the soft colour
  const SETS = {
    none: () => [], void: () => [],
    room: (g) => [
      { kind: 'window', x: 330, y: g - 560, depth: 0.85, soft: 1 }, { kind: 'frame', x: 760, y: g - 600, depth: 0.85, soft: 1 },
      { kind: 'lamp', x: 950, y: g, depth: 0.9, soft: 1 }, { kind: 'plant', x: 90, y: g, depth: 1.35 },
    ],
    bedroom: (g) => [
      { kind: 'window', x: 760, y: g - 600, depth: 0.85, soft: 1, night: 1 }, { kind: 'moon', x: 760, y: g - 610, depth: 0.6, scale: 0.4 },
      { kind: 'bed', x: 380, y: g, depth: 1 }, { kind: 'lamp', x: 960, y: g, depth: 0.9, soft: 1 },
    ],
    office: (g) => [
      { kind: 'window', x: 200, y: g - 600, depth: 0.85, soft: 1 }, { kind: 'frame', x: 880, y: g - 640, depth: 0.85, soft: 1 },
      { kind: 'desk', x: 700, y: g, depth: 1 }, { kind: 'monitor', x: 650, y: g - 175, depth: 1 }, { kind: 'plant', x: 800, y: g - 175, depth: 1, scale: 0.6 },
      { kind: 'chair', x: 520, y: g, depth: 1 },
    ],
    street: (g) => [
      { kind: 'building', x: -200, y: g - 40, depth: 0.5, soft: 1, h: 900 }, { kind: 'building', x: 150, y: g - 40, depth: 0.5, soft: 1, h: 700 },
      { kind: 'building', x: 520, y: g - 40, depth: 0.5, soft: 1, h: 1000, w: 260 }, { kind: 'building', x: 900, y: g - 40, depth: 0.5, soft: 1, h: 760 },
      { kind: 'building', x: 1260, y: g - 40, depth: 0.5, soft: 1, h: 880 }, { kind: 'streetlamp', x: 80, y: g, depth: 1 }, { kind: 'streetlamp', x: 1180, y: g, depth: 1 },
    ],
    city: (g) => {
      const out = [];
      for (let i = 0; i < 9; i++) out.push({ kind: 'building', x: -480 + i * 260, y: g - 30, depth: 0.45, soft: 1, h: 600 + 380 * hash(i + 3), w: 200 + 60 * hash(i + 9) });
      return out;
    },
    park: (g) => [
      { kind: 'hill', x: 200, y: g, depth: 0.4, scale: 1.4 }, { kind: 'hill', x: 1000, y: g, depth: 0.4, scale: 1.1 },
      { kind: 'sun', x: 860, y: 520, depth: 0.25, scale: 0.9 }, { kind: 'cloud', x: 250, y: 470, depth: 0.3, scale: 0.8, soft: 1 },
      { kind: 'tree', x: 120, y: g, depth: 0.9 }, { kind: 'bush', x: 980, y: g, depth: 1.1 }, { kind: 'flower', x: 870, y: g, depth: 1.35 },
    ],
    classroom: (g) => [
      { kind: 'board', x: 540, y: g - 120, depth: 0.85, soft: 1 }, { kind: 'clock', x: 920, y: g - 760, depth: 0.85, scale: 0.6, soft: 1 },
      { kind: 'desk', x: 900, y: g, depth: 1.2, scale: 0.8 },
    ],
    kitchen: (g) => [
      { kind: 'fridge', x: 120, y: g, depth: 0.9, soft: 1 }, { kind: 'counter', x: 700, y: g, depth: 0.9, soft: 1 },
      { kind: 'window', x: 700, y: g - 560, depth: 0.85, soft: 1 }, { kind: 'cup', x: 600, y: g - 248, depth: 0.9, scale: 1, soft: 1 },
    ],
    space: () => {
      const out = [];
      for (let i = 0; i < 22; i++) out.push({ kind: 'star', x: -400 + 1900 * hash(i * 3.1), y: 200 + 1200 * hash(i * 7.7), depth: 0.3, scale: 0.12 + 0.18 * hash(i * 1.3), soft: 1 });
      return out;
    },
    stage: (g) => [{ kind: 'stairs', x: -150, y: g, depth: 1.2, scale: 0.6, soft: 1 }],
  };

  // ───────────────────────── compile helpers ─────────────────────────
  function sortT(a) { return a.slice().sort((x, y) => x.t - y.t); }
  // generic scalar channel: keys [{t,dur,ease,v}], value continues from wherever the previous key had got to
  function sch(keys, base, t, k, ez) {
    if (k === undefined) k = keys.length - 1;
    while (k >= 0 && keys[k].t > t) k--;
    if (k < 0) return base;
    const key = keys[k], from = sch(keys, base, key.t, k - 1, ez);
    const p = key.dur > 0 ? clamp((t - key.t) / key.dur, 0, 1) : 1;
    return from + (key.v - from) * ease(key.ease || ez)(p);
  }
  function chan(keys, base, j, t, k) {
    if (k === undefined) k = keys.length - 1;
    while (k >= 0 && keys[k].t > t) k--;
    if (k < 0) return base[j];
    const key = keys[k], from = chan(keys, base, j, key.t, k - 1);
    const p = key.dur > 0 ? clamp((t - key.t) / key.dur, 0, 1) : 1;
    const e = key.ease ? ease(key.ease) : ARMJ[j] ? ease('back.inOut(1.15)') : ease('power2.inOut');
    return from + (key.pose[j] - from) * e(p);
  }
  // envelope for a [t0, t0+dur] window with soft in/out ramps
  function env(t, t0, dur, rin, rout) {
    if (t < t0 || t > t0 + dur) return 0;
    return Math.min(smooth((t - t0) / (rin || 0.25)), smooth((t0 + dur - t) / (rout || 0.25)));
  }

  // ───────────────────────── runtime ─────────────────────────
  let D = null, ROOT = null, SC = [], CAP = null, BAR = null, LAST_CHUNK = -2;

  function init(data, rootEl) {
    D = data; ROOT = rootEl; SC = [];
    D.scenes.forEach((s, i) => SC.push(buildScene(s, i)));
    if (D.captions && D.captions.chunks.length) CAP = buildCaptions();
    if (D.bar) BAR = buildBar();
    SC.forEach(prepScene);
    render(0);
  }

  function themeOf(s) { return Object.assign({}, THEMES[s.theme || D.theme] || THEMES.paper, D.themeOverride || {}, s.colors || {}); }

  function buildScene(s, idx) {
    const th = themeOf(s);
    const div = document.createElement('div');
    div.className = 'sk-scene';
    div.style.cssText = `--ink:${th.ink};--soft:${th.soft};--paper:${th.paper};--bg:${th.bg};--ac:${col(D.accent, th)};background:${th.bg};`;
    ROOT.appendChild(div);
    const svg = el('svg', { viewBox: `0 0 ${VW} ${VH}`, width: VW, height: VH, class: 'sk-svg' }, div);
    const S = { s, idx, th, div, svg, chars: [], props: [], texts: [], gy: s.groundY || D.groundY || 1250 };
    if (s.grid || (s.theme || D.theme) === 'blueprint') {
      const defs = el('defs', null, svg), pat = el('pattern', { id: `grid${idx}`, width: 60, height: 60, patternUnits: 'userSpaceOnUse' }, defs);
      el('path', { d: 'M60,0H0V60', fill: 'none', stroke: th.soft, 'stroke-width': 2 }, pat);
      el('rect', { x: -2000, y: -2000, width: 6000, height: 6000, fill: `url(#grid${idx})` }, svg);
    }
    S.L = { far: el('g', null, svg), mid: el('g', null, svg), near: el('g', null, svg), fx: el('g', null, svg) };
    S.screen = el('g', null, svg);
    // ground
    if (s.ground !== false) {
      el('rect', { x: -3000, y: S.gy, width: 8000, height: 3000, fill: th.floor }, S.L.mid);
      el('path', { d: `M-3000,${S.gy}H5000`, class: 'l', style: 'stroke-width:7' }, S.L.mid);
    }
    // set decor
    const setName = s.set || 'void';
    const decor = (SETS[setName] || SETS.void)(S.gy).concat(s.decor || []);
    // far/near decor each get their own parallax wrapper; depth ~1 lives in the camera-moved mid layer
    S.decor = decor.map((d) => {
      const depth = d.depth || 1, mid = Math.abs(depth - 1) <= 0.05;
      const wrap = mid ? S.L.mid : el('g', null, depth < 1 ? S.L.far : S.L.near);
      const g = makePropEl(d, th, wrap);
      if (d.soft) g.classList.add('soft');
      g.setAttribute('transform', propXf(d.x, d.y, d.rot || 0, d.scale || 1, d.flip));
      return { d, g, wrap: mid ? null : wrap, depth };
    });
    S.backProps = el('g', null, S.L.mid);
    S.charG = el('g', null, S.L.mid);
    S.frontProps = el('g', null, S.L.mid);
    (s.chars || []).forEach((c) => S.chars.push(buildChar(S, c)));
    (s.props || []).forEach((p) => S.props.push(buildProp(S, p)));
    (s.texts || []).forEach((x) => S.texts.push(buildText(S, x)));
    return S;
  }

  function propXf(x, y, rot, sc, flip) { return `translate(${n1(x)},${n1(y)}) rotate(${n1(rot)}) scale(${n1((flip ? -1 : 1) * sc * 1000) / 1000},${n1(sc * 1000) / 1000})`; }
  function makePropEl(o, th, parent) {
    const def = PROPS[o.kind];
    const g = el('g', null, parent);
    const ac = col(o.color || (def && def.color) || D.accent, th);
    g.style.setProperty('--ac', ac);
    const inner = el('g', null, g);
    inner.innerHTML = def ? def.svg(o) : o.svg || '';
    return g;
  }

  // ── characters
  function buildChar(S, c) {
    const cast = Object.assign({ size: 1, hair: 'none', acc: [] }, (D.cast || {})[c.id] || {}, c.look || {});
    const th = S.th;
    const ink = col(cast.ink, th) || th.ink, ac = col(cast.color, th) || col(D.accent, th);
    const g = el('g', { class: 'sk-char' }, S.charG);
    g.style.setProperty('--ac', ac);
    const H = HEIGHT * cast.size, sw = Math.max(6, BODY.sw * H * (cast.weight || 1));
    const st = `stroke:${ink};stroke-width:${n1(sw)};fill:none;stroke-linecap:round;stroke-linejoin:round`;
    const shadow = el('ellipse', { rx: n1(H * 0.13), ry: n1(H * 0.018), fill: th.soft, opacity: 0.55 }, S.charG);
    S.charG.insertBefore(shadow, g);
    const C = {
      c, cast, g, H, sw, ink, ac, shadow, S,
      legB: el('path', { style: st }, g), armB: el('path', { style: st }, g), torso: el('path', { style: st }, g), acc: el('g', null, g),
      head: el('g', null, g), legF: el('path', { style: st }, g), armF: el('path', { style: st }, g), emo: el('g', { class: 'sk-emote' }, g),
    };
    C.headC = el('circle', { r: n1(BODY.head * H), style: `stroke:${ink};stroke-width:${n1(sw)};fill:${col(cast.headFill, th) || th.paper}` }, C.head);
    C.hairBack = el('path', { class: 'a', style: `stroke:${ink};stroke-width:${n1(sw * 0.5)}` }, C.head);
    C.head.insertBefore(C.hairBack, C.headC);
    C.face = el('g', null, C.head);
    C.eyes = el('g', null, C.face); C.brows = el('path', { style: `stroke:${ink};stroke-width:${n1(sw * 0.45)};fill:none;stroke-linecap:round` }, C.face);
    C.mouth = el('path', { style: `stroke:${ink};stroke-width:${n1(sw * 0.45)};fill:none;stroke-linecap:round;stroke-linejoin:round` }, C.face);
    C.extra = el('g', null, C.face);
    C.hairA = el('path', { class: 'a', style: `stroke:${ink};stroke-width:${n1(sw * 0.5)}` }, C.head);
    C.hairL = el('path', { style: `stroke:${ink};stroke-width:${n1(sw * 0.6)};fill:none;stroke-linecap:round` }, C.head);
    return C;
  }

  function prepScene(S) {
    const s = S.s;
    S.cam = sortT(s.camera || []).map((k) => ({ t: k.t, dur: k.dur ?? 1, ease: k.ease || 'power2.inOut', x: k.x, y: k.y, zoom: k.zoom }));
    S.camBase = { x: (s.cam0 && s.cam0.x) ?? 540, y: (s.cam0 && s.cam0.y) ?? 960, zoom: (s.cam0 && s.cam0.zoom) ?? 1 };
    S.chars.forEach((C) => prepChar(S, C));
    S.props.forEach((P) => prepProp(S, P));
  }

  function findChar(S, id) { return S.chars.find((C) => C.c.id === id); }
  function findProp(S, id) {
    const P = S.props.find((P) => P.o.id === id);
    if (P) return P;
    // set furniture / decor can be targeted by its id or its kind ("bed", "desk", "chair")
    const dc = S.decor && S.decor.find((dc) => (dc.d.id || dc.d.kind) === id);
    if (!dc) return undefined;
    if (!dc.P) dc.P = { o: Object.assign({ y: S.gy }, dc.d), base: dc.d, keys: [], attach: [], S, kind: dc.d.kind, decor: true };
    return dc.P;
  }

  function prepChar(S, C) {
    const c = C.c;
    C.x0 = c.x ?? 540; C.y0 = c.y ?? S.gy;
    C.f0 = facingVal(c.facing ?? 'right');
    C.base = fullPose(c.pose || 'stand');
    C.poseKeys = []; C.faceKeys = []; C.moves = []; C.exprs = [{ t: -1e9, v: c.expr || 'neutral' }]; C.gest = []; C.reach = []; C.emotes = [];
    C.sizeKeys = []; C.yawKeys = []; C.talks = (c.talks || []).slice(); C.holds = [];
    C.enter = c.enter || null; C.exit = c.exit || null;
    C.seed = hash(c.id.length * 13.7 + S.idx * 3.3) * 50;
    for (const a of c.do || []) {
      const t = a.t;
      switch (a.act) {
        case 'pose': C.poseKeys.push({ t, dur: a.dur ?? 0.45, ease: a.ease, pose: fullPose(a.pose ? Object.assign({ pose: a.pose }, a) : a) }); break;
        case 'walk': case 'run': case 'sneak': case 'hop': case 'slide': case 'jump':
          C.moves.push({ t, style: a.act, a }); break;
        case 'face': C.faceKeys.push({ t, dur: a.dur ?? 0.3, target: a.to }); break;
        case 'expr': C.exprs.push({ t, v: a.expr }); break;
        case 'gesture': C.gest.push({ t, dur: a.dur ?? 1.2, kind: a.kind }); break;
        case 'reach': C.reach.push({ t, dur: a.dur ?? 1, target: a.to, hand: a.hand || 'F' }); break;
        case 'emote': C.emotes.push({ t, dur: a.dur ?? 1.2, icon: a.icon }); break;
        case 'grow': C.sizeKeys.push({ t, dur: a.dur ?? 0.6, v: a.to ?? 1, ease: a.ease || 'back.out(1.6)' }); break;
        case 'lookCamera': C.yawKeys.push({ t, dur: a.dur ?? 1.5 }); break;
        case 'talk': C.talks.push([t, t + (a.dur ?? 1.5)]); break;
        case 'fall':
          C.poseKeys.push({ t, dur: a.dur ?? 0.5, ease: 'power2.in', pose: fullPose(a.pose || 'fallen') });
          if (typeof a.y === 'number' || typeof a.x === 'number') C.moves.push({ t, style: 'slide', a: { to: [a.x, a.y], dur: a.dur ?? 0.5, face: 'keep', ease: 'power2.in' } });
          break;
        case 'hold': C.holds.push({ t, prop: a.prop, hand: a.hand || 'F' }); break;
        case 'drop': C.holds.push({ t, prop: a.prop, release: true, into: a.into }); break;
        case 'give': C.holds.push({ t, prop: a.prop, giveTo: a.to, dur: a.dur ?? 0.8 }); break;
      }
    }
    C.poseKeys = sortT(C.poseKeys); C.moves = sortT(C.moves); C.exprs = sortT(C.exprs); C.faceKeys = sortT(C.faceKeys);
    C.sizeKeys = sortT(C.sizeKeys);
  }

  function facingVal(v) { return v === 'left' ? -1 : v === 'front' ? 0 : v === 'right' ? 1 : typeof v === 'number' ? clamp(v, -1, 1) : 1; }

  // resolve moves lazily (targets can be other characters, whose positions are evaluated at the move start)
  function resolveMoves(C, depth) {
    if (C.movesResolved) return;
    if (depth > 4) return;
    C.movesResolved = true;
    let x = C.x0, y = C.y0;
    for (const m of C.moves) {
      const a = m.a, S = C.S;
      let tx = x, ty = y;
      if (typeof a.to === 'number') tx = a.to;
      else if (Array.isArray(a.to)) { tx = a.to[0] ?? x; ty = a.to[1] ?? y; }
      else if (typeof a.to === 'string') {
        const O = findChar(S, a.to), P = findProp(S, a.to);
        if (O) { resolveMoves(O, (depth || 0) + 1); const ox = posAt(O, m.t).x; const side = ox >= x ? -1 : 1; tx = ox + side * (a.gap ?? 150); }
        else if (P) { tx = P.base.x + (x <= P.base.x ? -1 : 1) * (a.gap ?? 90); }
      } else if (typeof a.by === 'number') tx = x + a.by;
      if (typeof a.y === 'number') ty = a.y;
      const g = GAITS[m.style] || GAITS.walk;
      const d = Math.hypot(tx - x, ty - y);
      m.fx = x; m.fy = y; m.tx = tx; m.ty = ty;
      if (m.style === 'jump') { m.dur = a.dur ?? 0.9; m.h = (a.height ?? 0.35) * C.H; }
      else m.dur = a.dur ?? Math.max(0.45, d / ((a.speed ?? g.speed) * C.cast.size));
      m.ease = ease(a.ease || (m.style === 'jump' ? 'none' : g.ease));
      // auto-face the way we travel (a.face: 'keep' to moonwalk, or an explicit side)
      if (a.face !== 'keep' && Math.abs(tx - x) > 4) C.faceKeys.push({ t: m.t, dur: 0.25, v: a.face ? facingVal(a.face) : Math.sign(tx - x) });
      x = tx; y = ty;
    }
    C.faceKeys = sortT(C.faceKeys);
  }

  function posAt(C, t) {
    resolveMoves(C, 0);
    let x = C.x0, y = C.y0, dist = 0, gait = null, w = 0, jump = null;
    const ms = C.moves;
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i];
      if (m.t > t) break;
      const te = Math.min(t, i + 1 < ms.length ? ms[i + 1].t : Infinity);
      const fx = x, fy = y;
      if (m.style === 'jump') {
        const u = (te - m.t) / m.dur, s = clamp((u - 0.22) / 0.56, 0, 1);
        x = lerp(fx, m.tx, ease('sine.inOut')(s)); y = lerp(fy, m.ty, s);
        if (te === t && u < 1) jump = { u, s, h: m.h };
      } else {
        const p = clamp((te - m.t) / m.dur, 0, 1), e = m.ease(p);
        x = lerp(fx, m.tx, e); y = lerp(fy, m.ty, e);
        const g = GAITS[m.style];
        if (!g.none) dist += Math.hypot(x - fx, y - fy) / g.cyc;
        if (te === t && p < 1 && !g.none) { gait = g; w = Math.min(smooth((t - m.t) / 0.22), smooth((m.t + m.dur - t) / 0.22)); }
        if (te === t && p < 1 && g.none) { gait = g; w = 0; }
      }
    }
    return { x, y, ph: (dist / C.H) * TAU, gait, w, jump };
  }

  function facingAt(C, t) {
    resolveMoves(C, 0);
    let f = C.f0;
    for (let i = 0; i < C.faceKeys.length; i++) {
      const k = C.faceKeys[i];
      if (k.t > t) break;
      let v = k.v;
      if (v === undefined) {
        if (typeof k.target === 'string' && !['left', 'right', 'front'].includes(k.target)) {
          const O = findChar(C.S, k.target) || null, P = findProp(C.S, k.target);
          const me = posAt(C, k.t).x, ox = O ? posAt(O, k.t).x : P ? P.base.x : me + 1;
          v = Math.sign(ox - me) || 1;
        } else v = facingVal(k.target);
        k.v = v;
      }
      const p = clamp((t - k.t) / k.dur, 0, 1);
      // turning passes through the front view, which is what makes a turn read as a turn
      f = lerp(f, v, ease('power2.inOut')(p));
    }
    return f;
  }

  function exprAt(C, t) { let v = C.exprs[0].v; for (const e of C.exprs) if (e.t <= t) v = e.v; return v; }

  // full character state at t (memoised per frame)
  function charState(C, t) {
    if (C._t === t) return C._s;
    if (C._busyT === t && C._pre) return C._pre;
    const pos = posAt(C, t), f = facingAt(C, t);
    const size = sch(C.sizeKeys, 1, t, undefined, 'back.out(1.6)');
    const H = C.H * size;
    const P = {};
    for (const j of JOINTS) P[j] = chan(C.poseKeys, C.base, j, t - LAG[j]);
    // holding something keeps that arm out of the walk swing
    const holding = { F: false, B: false };
    for (const h of C.holds) if (h.t <= t) { if (h.release || h.giveTo) holding[h.hand || 'F'] = false; else holding[h.hand] = true; }
    const keepArms = (C.c.arms === 'keep');
    if (pos.gait && pos.w > 0) {
      const G = gaitPose(pos.gait, pos.ph);
      for (const j of JOINTS) {
        const arm = ARMJ[j] && j !== 'head';
        if (arm && (keepArms || holding[j.slice(-1)])) continue;
        P[j] = lerp(P[j], G[j], pos.w);
      }
    }
    let lift = 0;
    if (pos.gait && pos.gait.lift) lift += pos.gait.lift * H * Math.pow(Math.abs(Math.sin(pos.ph)), 2) * pos.w;
    if (pos.gait && pos.gait.hop) lift += 0.11 * H * Math.abs(Math.sin(pos.ph)) * pos.w;
    if (pos.jump) {
      const { u, s, h } = pos.jump;
      const crouch = u < 0.22 ? smooth(u / 0.18) : u > 0.78 ? smooth((1 - u) / 0.2) : 0;
      const air = u >= 0.22 && u <= 0.78 ? Math.sin(Math.PI * s) : 0;
      const CP = fullPose('crouch'), JP = fullPose('jump');
      for (const j of JOINTS) { P[j] = lerp(P[j], CP[j], crouch * 0.8); P[j] = lerp(P[j], JP[j], smooth(air * 1.6)); }
      lift += h * 4 * s * (1 - s);
    }
    // gestures
    let yaw = 0, ex = null;
    for (const gs of C.gest) {
      const w = env(t, gs.t, gs.dur, 0.25, 0.3);
      if (w <= 0) continue;
      const G = GESTURES[gs.kind]; if (!G) continue;
      const u = t - gs.t;
      if (G.pose) for (const j in G.pose) P[j] = lerp(P[j], G.pose[j], w);
      if (G.osc) { const o = G.osc(u, C.seed); for (const j in o) P[j] = G.absolute ? lerp(P[j], o[j], w) : P[j] + o[j] * w; }
      if (G.yaw) yaw += G.yaw(u) * w;
      if (G.lift) lift += G.lift(u) * H * w;
      if (G.expr && w > 0.5) ex = G.expr;
    }
    // talking hand
    let talkOpen = 0;
    for (const [a, b] of C.talks) {
      if (t >= a && t <= b) {
        const syl = clamp((b - a) / Math.max(1, Math.round((b - a) / 0.16)), 0.09, 0.2);
        talkOpen = Math.abs(Math.sin((Math.PI * (t - a)) / syl)) * 0.85 + 0.15;
        break;
      }
    }
    if (C.c.gesticulate) { const w = talkWindow(C, t); if (w > 0) { const o = GESTURES.talk.osc(t, C.seed); for (const j in o) P[j] += o[j] * w; } }
    // idle breathing (fades out while walking)
    const idle = 1 - (pos.gait ? pos.w : 0);
    P.lean += 1.1 * Math.sin(t * 1.9 + C.seed) * idle; P.head += 1.4 * Math.sin(t * 1.9 + C.seed + 0.6) * idle;
    P.sF += 1.5 * Math.sin(t * 1.9 + C.seed + 1) * idle; P.sB += 1.5 * Math.sin(t * 1.9 + C.seed + 1.3) * idle;
    // look at the camera
    let fh = f + yaw;
    for (const k of C.yawKeys) { const w = env(t, k.t, k.dur, 0.25, 0.3); if (w > 0) fh = lerp(fh, 0, w); }
    fh = clamp(fh, -1, 1);
    // auto-ground: the lowest point of the body (never the hands) rests on y
    const groundOf = (k) => {
      if (C.c.float) return 0;
      let low = 0;
      for (const p of [k.footF, k.footB, k.toeF, k.toeB, k.kneeF, k.kneeB, [0, 0], k.neck]) low = Math.max(low, p[1]);
      return Math.max(low, k.head[1] + BODY.head * H) + C.sw * 0.5;
    };
    let sk = skeleton(P, f, H), groundOff = groundOf(sk), py = pos.y - groundOff - lift;
    const s = { pos, f, fh, P, sk, H, size, py, px: pos.x, lift, ex: ex || exprAt(C, t), talkOpen, groundOff };
    // reach (IK) toward a point / prop / character; while it runs, others reaching for us see the pre-IK body
    if (C.reach.length) {
      C._busyT = t; C._pre = s;
      let any = false;
      for (const r of C.reach) {
        const w = env(t, r.t, r.dur, 0.3, 0.3);
        if (w <= 0) continue;
        const tgt = targetPoint(C.S, r.target, t, C);
        if (!tgt) continue;
        ik(P, sk, r.hand, [tgt[0] - pos.x, tgt[1] - py], f, H, w);
        any = true;
      }
      C._busyT = null;
      if (any) { sk = skeleton(P, f, H); s.sk = sk; s.groundOff = groundOf(sk); s.py = pos.y - s.groundOff - lift; }
    }
    C._t = t; C._s = s;
    return s;
  }
  function talkWindow(C, t) { for (const [a, b] of C.talks) if (t >= a - 0.2 && t <= b + 0.2) return env(t, a - 0.2, b - a + 0.4, 0.2, 0.2); return 0; }

  // 3D-ish projection: limb directions live in the body's side plane plus a lateral spread, then rotate by facing
  function skeleton(P, f, H) {
    const fx = f, lx = Math.sqrt(Math.max(0, 1 - f * f));
    const dir = (a, spr, side) => {
      const lat = side * Math.sin(spr * RAD), fw = Math.sin(a * RAD) * Math.cos(spr * RAD), dn = Math.cos(a * RAD) * Math.cos(spr * RAD);
      return [fw * fx + lat * lx, dn];
    };
    const add = (p, d, L) => [p[0] + d[0] * L, p[1] + d[1] * L];
    const T = BODY.torso * H;
    const neck = [Math.sin(P.lean * RAD) * fx * T, -Math.cos(P.lean * RAD) * T];
    const sh = [neck[0] * 0.85, neck[1] * 0.85]; // arms hang from just below the neck
    const ha = P.lean + P.head, hr = (BODY.neck + BODY.head) * H;
    const head = [neck[0] + Math.sin(ha * RAD) * fx * hr, neck[1] - Math.cos(ha * RAD) * hr];
    const arm = (s, e, sp, fp, side) => { const el = add(sh, dir(s, sp, side), BODY.upper * H); return [el, add(el, dir(s + e, sp + fp, side), BODY.fore * H)]; };
    const [elF, handF] = arm(P.sF, P.eF, P.spF, P.fpF, 1), [elB, handB] = arm(P.sB, P.eB, P.spB, P.fpB, -1);
    const leg = (h, k, side) => { const kn = add([0, 0], dir(h, P.lsp, side), BODY.thigh * H); const ft = add(kn, dir(h - k, P.lsp, side), BODY.shin * H); const toe = add(ft, dir(h - k + 90, P.lsp * 2, side), BODY.foot * H); return [kn, ft, toe]; };
    const [kneeF, footF, toeF] = leg(P.hF, P.kF, 1), [kneeB, footB, toeB] = leg(P.hB, P.kB, -1);
    return { neck, sh, head, headRot: Math.atan2(Math.sin(ha * RAD) * fx, Math.cos(ha * RAD)) / RAD, elF, handF, elB, handB, kneeF, footF, toeF, kneeB, footB, toeB };
  }

  // two-bone IK in the side plane, blended into the pose by w
  function ik(P, sk, hand, target, f, H, w) {
    const fx = Math.abs(f) < 0.35 ? (f < 0 ? -0.35 : 0.35) : f;
    const dx = (target[0] - sk.sh[0]) / fx, dy = target[1] - sk.sh[1];
    const a = BODY.upper * H, b = BODY.fore * H;
    const d = clamp(Math.hypot(dx, dy), Math.abs(a - b) + 1, a + b - 0.5);
    const base = Math.atan2(dx, dy) / RAD;
    const al = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)) / RAD;
    const be = Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1)) / RAD;
    const S = hand === 'B' ? 'B' : 'F';
    P['s' + S] = lerp(P['s' + S], base - al, w); P['e' + S] = lerp(P['e' + S], 180 - be, w);
    P['sp' + S] = lerp(P['sp' + S], 6, w); P['fp' + S] = lerp(P['fp' + S], 0, w);
  }

  function handWorld(C, t, hand) {
    const s = charState(C, t), sk = s.sk, h = hand === 'B' ? sk.handB : sk.handF;
    const k = visScale(C, t);
    return [s.px + h[0] * k, s.py + s.groundOff + (h[1] - s.groundOff) * k];
  }
  function targetPoint(S, tg, t, self) {
    if (Array.isArray(tg)) return tg;
    if (typeof tg !== 'string') return null;
    const [id, part] = tg.split('.');
    const O = findChar(S, id);
    if (O && O !== self) {
      const s = charState(O, t), sk = s.sk;
      const p = part === 'head' ? sk.head : part === 'hand' ? sk.handF : part === 'feet' ? sk.footF : [sk.sh[0] * 0.6, sk.sh[1] * 0.75];
      return [s.px + p[0], s.py + p[1]];
    }
    const P = findProp(S, id);
    if (P) { const st = propState(P, t); return [st.x, st.y - (PROPS[P.o.kind] && PROPS[P.o.kind].a === 'b' ? 60 : 0)]; }
    return null;
  }

  function visScale(C, t) {
    let k = 1;
    if (C.enter && C.enter.style === 'pop') k *= ease('back.out(1.8)')(clamp((t - C.enter.t) / 0.4, 0, 1));
    if (C.exit && C.exit.style === 'pop') k *= 1 - ease('back.in(1.8)')(clamp((t - C.exit.t) / 0.35, 0, 1));
    return k;
  }
  function visAlpha(C, t) {
    let a = 1;
    if (C.enter) { if (t < C.enter.t) return 0; if (C.enter.style === 'fade') a *= smooth((t - C.enter.t) / 0.4); }
    if (C.exit) { if (C.exit.style === 'fade') a *= 1 - smooth((t - C.exit.t) / 0.4); else if (C.exit.style !== 'walk' && t > C.exit.t + 0.36) a = 0; }
    return a;
  }

  function drawChar(C, t) {
    const a = visAlpha(C, t);
    C.g.style.opacity = a; C.shadow.style.opacity = a * 0.55;
    if (a <= 0) return;
    const s = charState(C, t), sk = s.sk, H = s.H, k = visScale(C, t);
    const P = (p) => `${n1(p[0])},${n1(p[1])}`;
    C.g.setAttribute('transform', `translate(${n1(s.px)},${n1(s.py + s.groundOff)}) scale(${n1(k * 1000) / 1000}) translate(0,${n1(-s.groundOff)})`);
    const rubber = C.cast.limbs === 'bendy';
    const limb = (a0, b0, c0) => rubber ? `M${P(a0)}Q${P([2 * b0[0] - (a0[0] + c0[0]) / 2, 2 * b0[1] - (a0[1] + c0[1]) / 2])} ${P(c0)}` : `M${P(a0)}L${P(b0)}L${P(c0)}`;
    C.legF.setAttribute('d', limb([0, 0], sk.kneeF, sk.footF) + `L${P(sk.toeF)}`);
    C.legB.setAttribute('d', limb([0, 0], sk.kneeB, sk.footB) + `L${P(sk.toeB)}`);
    C.armF.setAttribute('d', limb(sk.sh, sk.elF, sk.handF));
    C.armB.setAttribute('d', limb(sk.sh, sk.elB, sk.handB));
    C.torso.setAttribute('d', `M0,0L${P(sk.neck)}`);
    C.head.setAttribute('transform', `translate(${P(sk.head)}) rotate(${n1(sk.headRot)})`);
    drawFace(C, s, t);
    drawAcc(C, s);
    // ground shadow
    const gy = s.pos.y, lift = s.lift;
    C.shadow.setAttribute('cx', n1(s.px)); C.shadow.setAttribute('cy', n1(gy));
    C.shadow.setAttribute('rx', n1(H * 0.13 * k * (1 - clamp(lift / H, 0, 0.6)))); C.shadow.style.display = C.c.float || C.c.noShadow ? 'none' : '';
    // draw-on entrance
    if (C.enter && C.enter.style === 'draw') {
      const u = clamp((t - C.enter.t) / (C.enter.dur || 0.9), 0, 1);
      const parts = [C.headC, C.torso, C.legB, C.legF, C.armB, C.armF];
      parts.forEach((p, i) => {
        if (!p._pl) { p.setAttribute('pathLength', '1'); p._pl = 1; }
        const q = smooth(u * parts.length * 0.55 - i * 0.55);
        p.style.strokeDasharray = q >= 1 ? 'none' : '1 1'; p.style.strokeDashoffset = String(1 - q);
      });
      C.face.style.opacity = smooth(u * 2 - 1); C.hairA.style.opacity = C.hairL.style.opacity = C.hairBack.style.opacity = C.acc.style.opacity = smooth(u * 2 - 1);
    }
    // emotes above the head
    let emoT = null;
    for (const e of C.emotes) if (t >= e.t && t <= e.t + e.dur + 0.25) { emoT = e; }
    if (emoT) {
      if (C._emo !== emoT) { C.emo.innerHTML = (EMOTES[emoT.icon] || EMOTES['!'])(); C._emo = emoT; }
      const u = t - emoT.t, sc = ease('back.out(2.2)')(clamp(u / 0.3, 0, 1)) * (1 - smooth((u - emoT.dur) / 0.25));
      const hx = sk.head[0] + s.f * H * 0.06 + H * 0.09, hy = sk.head[1] - BODY.head * H - 70;
      C.emo.setAttribute('transform', `translate(${n1(hx)},${n1(hy + 6 * Math.sin(u * 5))}) scale(${n1(sc * 1000) / 1000})`);
      C.emo.style.display = '';
    } else { C.emo.style.display = 'none'; C._emo = null; }
  }

  function blinkAt(C, t) {
    const per = 3.1 + 1.4 * hash(C.seed);
    const k = Math.floor((t + C.seed) / per), off = 0.4 + 1.6 * hash(k + C.seed);
    const bt = k * per - C.seed + off;
    return t >= bt && t <= bt + 0.13 ? 1 - Math.abs((t - bt) / 0.065 - 1) : 0;
  }

  function drawFace(C, s, t) {
    const r = BODY.head * s.H, fh = s.fh, lxh = Math.sqrt(Math.max(0, 1 - fh * fh));
    const ex = EXPRS[s.ex] || EXPRS.neutral;
    const key = `${s.ex}|${Math.round(fh * 40)}|${Math.round(blinkAt(C, t) * 6)}|${Math.round(s.talkOpen * 8)}|${C.cast.hair}`;
    const cx = r * 0.42 * fh, sp = r * 0.3 * Math.max(lxh, 0.48), ey = -r * 0.08;
    const eF = [cx + sp, ey], eB = [cx - sp, ey];
    // hair
    if (C._hairKey !== Math.round(fh * 40)) {
      const hp = hairPath(C.cast.hair, 52, fh), hk = n1((r / 52) * 1000) / 1000;
      C.hairA.setAttribute('d', hp.a || ''); C.hairL.setAttribute('d', hp.l || '');
      C.hairA.setAttribute('transform', `scale(${hk})`); C.hairL.setAttribute('transform', `scale(${hk})`);
      C.hairA.style.strokeWidth = n1(C.sw * 0.5 / hk); C.hairL.style.strokeWidth = n1(C.sw * 0.6 / hk);
      C.hairBack.setAttribute('d', '');
      C._hairKey = Math.round(fh * 40);
    }
    if (C._faceKey === key && !ex.tears) return;
    C._faceKey = key;
    const blink = blinkAt(C, t), er = r * 0.115;
    let eyes = '';
    const eyeKind = ex.eyes;
    for (const [x, y] of [eF, eB]) {
      if (eyeKind === 'none') break;
      if (eyeKind === 'closed') eyes += `<path d="M${n1(x - er * 1.2)},${n1(y)}q${n1(er * 1.2)},${n1(er * 1.1)} ${n1(er * 2.4)},0" style="stroke:${C.ink};stroke-width:${n1(C.sw * 0.4)};fill:none;stroke-linecap:round"/>`;
      else if (eyeKind === 'happy') eyes += `<path d="M${n1(x - er * 1.2)},${n1(y + er * 0.4)}q${n1(er * 1.2)},${n1(-er * 1.6)} ${n1(er * 2.4)},0" style="stroke:${C.ink};stroke-width:${n1(C.sw * 0.4)};fill:none;stroke-linecap:round"/>`;
      else if (eyeKind === 'x') eyes += `<path d="M${n1(x - er)},${n1(y - er)}l${n1(er * 2)},${n1(er * 2)}m0,${n1(-er * 2)}l${n1(-er * 2)},${n1(er * 2)}" style="stroke:${C.ink};stroke-width:${n1(C.sw * 0.35)};stroke-linecap:round"/>`;
      else if (eyeKind === 'heart') eyes += `<path d="M${n1(x)},${n1(y + er * 1.1)}c${n1(-er * 2.2)},${n1(-er * 1.2)} ${n1(-er * 1.4)},${n1(-er * 2.8)} 0,${n1(-er * 1.6)}c${n1(er * 1.4)},${n1(-er * 1.2)} ${n1(er * 2.2)},${n1(er * 0.4)} 0,${n1(er * 1.6)}Z" style="fill:#E63946"/>`;
      else if (eyeKind === 'half') eyes += `<path d="M${n1(x - er * 1.1)},${n1(y)}h${n1(er * 2.2)}" style="stroke:${C.ink};stroke-width:${n1(C.sw * 0.4)};stroke-linecap:round"/><circle cx="${n1(x)}" cy="${n1(y + er * 0.5)}" r="${n1(er * 0.6)}" style="fill:${C.ink}"/>`;
      else {
        const big = eyeKind === 'big' ? 1.45 : 1;
        if (blink > 0.35) eyes += `<path d="M${n1(x - er * big)},${n1(y)}h${n1(er * 2 * big)}" style="stroke:${C.ink};stroke-width:${n1(C.sw * 0.35)};stroke-linecap:round"/>`;
        else eyes += `<ellipse cx="${n1(x)}" cy="${n1(y)}" rx="${n1(er * big)}" ry="${n1(er * big * 1.15)}" style="fill:${C.ink}"/>`;
      }
    }
    C.eyes.innerHTML = eyes;
    // brows
    const by = ey - r * 0.32, bw = r * 0.2;
    let bd = '';
    const b = ex.brow;
    if (b === 'up') bd = `M${n1(eF[0] - bw)},${n1(by - 6)}h${n1(bw * 2)}M${n1(eB[0] - bw)},${n1(by - 6)}h${n1(bw * 2)}`;
    else if (b === 'sad') bd = `M${n1(eF[0] - bw)},${n1(by - 6)}L${n1(eF[0] + bw)},${n1(by + 4)}M${n1(eB[0] + bw)},${n1(by - 6)}L${n1(eB[0] - bw)},${n1(by + 4)}`;
    else if (b === 'angry') bd = `M${n1(eF[0] - bw)},${n1(by + 6)}L${n1(eF[0] + bw)},${n1(by - 6)}M${n1(eB[0] + bw)},${n1(by + 6)}L${n1(eB[0] - bw)},${n1(by - 6)}`;
    else if (b === 'tilt') bd = `M${n1(eF[0] - bw)},${n1(by - 8)}h${n1(bw * 2)}M${n1(eB[0] - bw)},${n1(by + 2)}h${n1(bw * 2)}`;
    C.brows.setAttribute('d', bd);
    // mouth
    const mx = cx + r * 0.06 * fh, my = r * 0.42, mw = r * 0.5 * (0.62 + 0.38 * lxh), hw = mw / 2;
    let md = '', fill = 'none';
    const open = s.talkOpen;
    if (open > 0.2 && ex.mouth !== 'none') {
      const oh = r * 0.3 * open;
      if (ex.mouth === 'frown' || ex.mouth === 'wavy') md = `M${n1(mx - hw * 0.7)},${n1(my)}a${n1(hw * 0.7)},${n1(oh * 0.6)} 0 1 1 ${n1(hw * 1.4)},0a${n1(hw * 0.7)},${n1(oh * 0.6)} 0 1 1 ${n1(-hw * 1.4)},0Z`;
      else md = `M${n1(mx - hw)},${n1(my - 2)}Q${n1(mx)},${n1(my + oh * 1.6)} ${n1(mx + hw)},${n1(my - 2)}Z`;
      fill = C.ink;
    } else {
      switch (ex.mouth) {
        case 'flat': md = `M${n1(mx - hw * 0.7)},${n1(my)}h${n1(hw * 1.4)}`; break;
        case 'smile': md = `M${n1(mx - hw)},${n1(my - 4)}Q${n1(mx)},${n1(my + hw * 0.9)} ${n1(mx + hw)},${n1(my - 4)}`; break;
        case 'grin': md = `M${n1(mx - hw * 1.1)},${n1(my - 6)}Q${n1(mx)},${n1(my + hw * 1.5)} ${n1(mx + hw * 1.1)},${n1(my - 6)}Z`; fill = C.ink; break;
        case 'frown': md = `M${n1(mx - hw)},${n1(my + 8)}Q${n1(mx)},${n1(my - hw * 0.7)} ${n1(mx + hw)},${n1(my + 8)}`; break;
        case 'o': md = `M${n1(mx - hw * 0.45)},${n1(my + 4)}a${n1(hw * 0.45)},${n1(hw * 0.6)} 0 1 1 ${n1(hw * 0.9)},0a${n1(hw * 0.45)},${n1(hw * 0.6)} 0 1 1 ${n1(-hw * 0.9)},0Z`; fill = C.ink; break;
        case 'wavy': md = `M${n1(mx - hw)},${n1(my)}q${n1(hw / 3)},-8 ${n1(hw * 2 / 3)},0t${n1(hw * 2 / 3)},0t${n1(hw * 2 / 3)},0`; break;
        case 'smirk': md = `M${n1(mx - hw * 0.8)},${n1(my + 4)}Q${n1(mx + hw * 0.2)},${n1(my + 8)} ${n1(mx + hw)},${n1(my - 8)}`; break;
      }
    }
    C.mouth.setAttribute('d', md); C.mouth.style.fill = fill;
    // extras: tears, glasses, mustache
    let x = '';
    const acc = C.cast.acc || [];
    if (acc.includes('glasses')) x += `<circle cx="${n1(eF[0])}" cy="${n1(ey)}" r="${n1(er * 2.3)}" style="fill:none;stroke:${C.ink};stroke-width:${n1(C.sw * 0.35)}"/><circle cx="${n1(eB[0])}" cy="${n1(ey)}" r="${n1(er * 2.3)}" style="fill:none;stroke:${C.ink};stroke-width:${n1(C.sw * 0.35)}"/><path d="M${n1(Math.min(eF[0], eB[0]) + er * 2.3)},${n1(ey)}L${n1(Math.max(eF[0], eB[0]) - er * 2.3)},${n1(ey)}" style="stroke:${C.ink};stroke-width:${n1(C.sw * 0.3)}"/>`;
    if (acc.includes('mustache')) x += `<path d="M${n1(mx)},${n1(my - 12)}q${n1(-hw)},-10 ${n1(-hw * 1.2)},8q${n1(hw * 0.6)},-2 ${n1(hw * 1.2)},-8q${n1(hw * 0.6)},6 ${n1(hw * 1.2)},8q${n1(-hw * 0.2)},-18 ${n1(-hw * 1.2)},-8Z" style="fill:${C.ink}"/>`;
    if (acc.includes('beard')) x += `<path d="M${n1(-r * 0.85 + cx * 0.4)},${n1(r * 0.1)}Q${n1(cx)},${n1(r * 1.55)} ${n1(r * 0.85 + cx * 0.4)},${n1(r * 0.1)}Q${n1(cx)},${n1(r * 0.75)} ${n1(-r * 0.85 + cx * 0.4)},${n1(r * 0.1)}Z" class="a" style="stroke:${C.ink};stroke-width:${n1(C.sw * 0.4)}"/>`;
    if (acc.includes('headphones')) x += `<path d="M${n1(-r * 1.05)},${n1(0)}A${n1(r * 1.05)},${n1(r * 1.1)} 0 0 1 ${n1(r * 1.05)},0" style="fill:none;stroke:${C.ink};stroke-width:${n1(C.sw * 0.6)}"/><rect x="${n1(-cx * 0.5 - r * 0.25)}" y="${n1(-r * 0.25)}" width="${n1(r * 0.5)}" height="${n1(r * 0.6)}" rx="8" class="a" style="stroke:${C.ink};stroke-width:${n1(C.sw * 0.4)}"/>`;
    if (ex.tears) { const u = (t * 1.6) % 1; x += `<path d="M${n1(eF[0])},${n1(ey + er + u * r * 0.9)}c6,10 6,18 0,18c-6,0 -6,-8 0,-18Z" style="fill:#8ECAE6;opacity:${n1(1 - u)}"/><path d="M${n1(eB[0])},${n1(ey + er + ((u + 0.5) % 1) * r * 0.9)}c6,10 6,18 0,18c-6,0 -6,-8 0,-18Z" style="fill:#8ECAE6;opacity:${n1(1 - ((u + 0.5) % 1))}"/>`; }
    C.extra.innerHTML = x;
  }

  function drawAcc(C, s) {
    const acc = C.cast.acc || [];
    if (!acc.length) return;
    const sk = s.sk, H = s.H, n = sk.neck, len = Math.hypot(n[0], n[1]), ux = -n[0] / len, uy = -n[1] / len; // unit vector neck -> pelvis
    const px = -uy, py = ux; // perpendicular
    const at = (d, w) => [n[0] + ux * d + px * w, n[1] + uy * d + py * w];
    const P = (p) => `${n1(p[0])},${n1(p[1])}`;
    let h = '';
    const st = `stroke:${C.ink};stroke-width:${n1(C.sw * 0.4)};stroke-linejoin:round`;
    if (acc.includes('tie')) { const a = at(4, 0), b = at(24, -12), c = at(H * 0.15, 0), d = at(24, 12); h += `<path class="a" d="M${P(a)}L${P(b)}L${P(c)}L${P(d)}Z" style="${st}"/>`; }
    if (acc.includes('bowtie')) { const c = at(8, 0); h += `<path class="a" d="M${P(c)}L${P(at(-6, -26))}L${P(at(22, -26))}ZM${P(c)}L${P(at(-6, 26))}L${P(at(22, 26))}Z" style="${st}"/>`; }
    if (acc.includes('scarf')) { h += `<path class="a" d="M${P(at(-4, -22))}L${P(at(-4, 22))}L${P(at(16, 22))}L${P(at(16, -22))}Z M${P(at(10, 8 * Math.sign(s.f || 1)))}L${P(at(70, 30 * Math.sign(s.f || 1)))}L${P(at(76, 8 * Math.sign(s.f || 1)))}Z" style="${st}"/>`; }
    if (acc.includes('badge')) { const c = at(H * 0.06, 14 * Math.sign(s.f || 1)); h += `<circle class="a" cx="${n1(c[0])}" cy="${n1(c[1])}" r="${n1(H * 0.025)}" style="${st}"/>`; }
    C.acc.innerHTML = h;
  }

  // ── props
  function buildProp(S, o) {
    const def = PROPS[o.kind];
    const parent = o.z === 'back' ? S.backProps : o.z === 'near' ? S.L.near : S.frontProps;
    const g = makePropEl(o, S.th, parent);
    if (o.soft) g.classList.add('soft');
    const P = { o, g, kind: o.kind, def, base: o, S };
    if (o.in === 'draw' || o.out === 'draw') g.querySelectorAll('path,circle,rect,ellipse,polyline,line').forEach((n) => n.setAttribute('pathLength', '1'));
    P.wheels = [...g.querySelectorAll('.wheel')].map((w) => ({ w, xf: w.getAttribute('transform'), r: +w.dataset.r }));
    return P;
  }
  function prepProp(S, P) {
    const o = P.o;
    P.keys = sortT(o.anim || []).map((k) => Object.assign({ dur: 0.6 }, k));
    P.attach = [];
    S.chars.forEach((C) => C.holds.forEach((h) => {
      if (h.prop !== o.id) return;
      if (h.release) P.attach.push({ t: h.t, C: null, into: h.into });
      else if (h.giveTo) { const R = findChar(S, h.giveTo); C.reach.push({ t: h.t - 0.1, dur: h.dur + 0.3, target: h.giveTo + '.hand', hand: 'F' }); if (R) { R.reach.push({ t: h.t, dur: h.dur + 0.3, target: C.c.id + '.hand', hand: 'F' }); R.holds.push({ t: h.t + h.dur * 0.55, prop: o.id, hand: 'F' }); P.attach.push({ t: h.t + h.dur * 0.55, C: R, hand: 'F' }); } }
      else P.attach.push({ t: h.t, C, hand: h.hand });
    }));
    if (o.heldBy) { const C = findChar(S, o.heldBy); if (C) { P.attach.push({ t: -1e9, C, hand: o.hand || 'F' }); C.holds.push({ t: -1e9, prop: o.id, hand: o.hand || 'F' }); } }
    P.attach = sortT(P.attach);
  }
  function propState(P, t) {
    if (P._t === t) return P._s;
    const o = P.o;
    let x = o.x ?? 540, y = o.y ?? P.S.gy, rot = o.rot || 0, sc = o.scale || 1, op = o.opacity ?? 1, val = o.value;
    P._flip = false;
    // attached to a hand?
    let att = null;
    for (const a of P.attach) if (a.t <= t) att = a;
    if (att && att.C) {
      const h = handWorld(att.C, t, att.hand), off = PROP_ANCHOR_HELD[o.kind] || [0, 0];
      const fs = charState(att.C, t).f;
      x = h[0] + off[0] * Math.sign(fs || 1); y = h[1] + off[1]; P._flip = fs < 0;
    } else if (att && !att.C) {
      // dropped: falls to the ground from where it was let go
      const prev = P.attach.filter((a) => a.t < att.t && a.C).pop();
      if (prev) {
        const h = handWorld(prev.C, att.t, prev.hand), fall = clamp((t - att.t) / 0.45, 0, 1);
        const Q = att.into ? findProp(P.S, att.into) : null;
        if (Q) {
          // dropped INTO another prop: arc over to it, shrink and vanish inside
          const q = Q.o, tx = q.x ?? 540, ty = (q.y ?? P.S.gy) - (PROPS[q.kind] && PROPS[q.kind].a === 'b' ? 70 : 0);
          const e = ease('power2.in')(fall);
          x = lerp(h[0], tx, ease('sine.inOut')(fall)); y = lerp(h[1], ty, e) - 60 * Math.sin(Math.PI * fall); sc *= 1 - 0.7 * e; op *= 1 - smooth((t - att.t - 0.35) / 0.12);
        } else { x = h[0]; y = lerp(h[1], P.S.gy - 40, ease('bounce.out')(fall)); rot = 25 * fall; }
      }
    }
    // keyframes override
    for (const ch of ['x', 'y', 'rot', 'scale', 'opacity', 'value']) {
      const ks = P.keys.filter((k) => k[ch] !== undefined).map((k) => ({ t: k.t, dur: k.dur, ease: k.ease, v: k[ch] }));
      if (!ks.length) continue;
      const base = ch === 'x' ? x : ch === 'y' ? y : ch === 'rot' ? rot : ch === 'scale' ? sc : ch === 'opacity' ? op : (val ?? 0);
      const v = sch(ks, base, t, undefined, 'power2.inOut');
      if (ch === 'x') x = v; else if (ch === 'y') y = v; else if (ch === 'rot') rot = v; else if (ch === 'scale') sc = v; else if (ch === 'opacity') op = v; else val = v;
    }
    if (o.float) y += Math.sin(t * 2.2 + (o.x || 0) * 0.01) * (typeof o.float === 'number' ? o.float : 12);
    if (o.spin) rot += t * o.spin;
    if (o.bob) rot += Math.sin(t * 3) * o.bob;
    // entrances / exits
    let k = 1, a = 1, dy = 0, draw = 1;
    const sh = o.show ?? -1e9, inS = o.in || 'pop';
    if (t < sh) { a = 0; }
    else {
      const u = t - sh;
      if (inS === 'pop') k *= ease('back.out(1.9)')(clamp(u / 0.38, 0, 1));
      else if (inS === 'fade') a *= smooth(u / 0.4);
      else if (inS === 'drop') { dy = -420 * (1 - ease('bounce.out')(clamp(u / 0.7, 0, 1))); a *= smooth(u / 0.08); }
      else if (inS === 'grow') k *= ease('power3.out')(clamp(u / 0.6, 0, 1));
      else if (inS === 'draw') draw = ease('power1.inOut')(clamp(u / (o.inDur || 0.9), 0, 1));
      else if (inS === 'slide') { dy = 0; x += (1 - ease('power3.out')(clamp(u / 0.5, 0, 1))) * (o.from === 'left' ? -900 : 900); }
      if (val === undefined && ['chart', 'graph'].includes(o.kind)) val = clamp(u / (o.inDur || 1.1), 0, 1);
    }
    if (o.hide !== undefined && t >= o.hide) {
      const u = t - o.hide, outS = o.out || 'pop';
      if (outS === 'pop') k *= 1 - ease('back.in(1.8)')(clamp(u / 0.3, 0, 1));
      else if (outS === 'fade') a *= 1 - smooth(u / 0.35);
      else if (outS === 'fly') { dy -= 1600 * ease('power2.in')(clamp(u / 0.6, 0, 1)); }
      else a *= u < 0.3 ? 1 - u / 0.3 : 0;
    }
    const s = { x, y: y + dy, rot, sc: sc * k, op: op * a, val, draw };
    P._t = t; P._s = s;
    return s;
  }
  function drawProp(P, t) {
    const s = propState(P, t);
    P.g.style.opacity = s.op;
    if (s.op <= 0 || s.sc <= 0.001) { P.g.style.display = 'none'; return; }
    P.g.style.display = '';
    P.g.setAttribute('transform', propXf(s.x, s.y, s.rot, Math.max(0.001, s.sc), P.o.flip ? !P._flip : P._flip));
    if (P.o.in === 'draw') (P.drawEls = P.drawEls || [...P.g.querySelectorAll('[pathLength]')]).forEach((n) => { n.style.strokeDasharray = s.draw >= 1 ? 'none' : '1 1'; n.style.strokeDashoffset = String(1 - s.draw); n.style.fillOpacity = smooth(s.draw * 2 - 1); });
    if (P.wheels.length) { const dx = s.x - (P.o.x ?? 540); P.wheels.forEach((w) => w.w.setAttribute('transform', `${w.xf} rotate(${n1((dx / w.r) / RAD)})`)); }
    propUpdate(P, t, s.val);
  }

  // ── texts (all positioned in world space unless screen:true)
  function buildText(S, o) {
    const parent = o.screen ? S.screen : S.L.fx;
    const g = el('g', { class: 'sk-text' }, parent);
    const th = S.th, ac = col(o.color, th) || col(D.accent, th);
    g.style.setProperty('--ac', ac);
    const X = { o, g, S };
    const type = o.type || 'label';
    const size = o.size || { title: 104, label: 58, sticker: 64, bubble: 50, thought: 48, counter: 120, note: 44 }[type] || 58;
    const lines = o.lines || [String(o.text ?? '')];
    const mk = (cls) => {
      const tx = el('text', { class: cls, 'text-anchor': 'middle' }, g);
      tx.style.fontSize = size + 'px';
      lines.forEach((ln, i) => {
        const ts = el('tspan', { x: 0, dy: i ? size * 1.08 : 0 }, tx);
        // *word* = accent colour
        ln.split(/(\*[^*]+\*)/).forEach((part) => {
          if (!part) return;
          const sp = el('tspan', null, ts);
          if (/^\*.*\*$/.test(part)) { sp.textContent = part.slice(1, -1); sp.setAttribute('class', 'acc'); }
          else sp.textContent = part;
        });
      });
      tx.setAttribute('y', n1(-((lines.length - 1) * size * 1.08) / 2 + size * 0.35));
      return tx;
    };
    if (type === 'arrow' || type === 'circle' || type === 'underline' || type === 'strike') {
      X.path = el('path', { class: 'l', pathLength: 1, style: `stroke:${ac};stroke-width:${o.width || 11}` }, g);
      if (type === 'arrow') X.head = el('path', { class: 'l', style: `stroke:${ac};stroke-width:${o.width || 11}` }, g);
    } else if (type === 'bubble' || type === 'thought') {
      X.shape = el('path', { class: 'o', style: 'stroke-width:7' }, g);
      X.tail = el('path', { class: 'o', style: 'stroke-width:7' }, g);
      X.txt = mk('t tb');
    } else if (type === 'sticker') {
      X.card = el('rect', { class: 'a', rx: 16, style: 'stroke-width:7' }, g);
      X.shadow = el('rect', { rx: 16, style: 'fill:var(--ink);opacity:.9' }, g);
      g.insertBefore(X.shadow, X.card);
      X.txt = mk('t ts');
    } else if (type === 'counter') {
      X.txt = mk('t tt');
    } else {
      X.txt = mk(type === 'title' ? 't tt' : type === 'note' ? 't tn' : 't tl');
    }
    return X;
  }
  function layoutText(X) {
    if (X.laid) return;
    X.laid = true;
    if (!X.txt) return;
    const bb = X.txt.getBBox();
    X.bb = { x: bb.x, y: bb.y, w: bb.width, h: bb.height };
    const pad = X.o.type === 'sticker' ? 30 : 38;
    if (X.card) { for (const r of [X.card, X.shadow]) { r.setAttribute('x', n1(bb.x - pad)); r.setAttribute('y', n1(bb.y - pad * 0.6)); r.setAttribute('width', n1(bb.width + pad * 2)); r.setAttribute('height', n1(bb.height + pad * 1.2)); } X.shadow.setAttribute('transform', 'translate(9,9)'); }
    if (X.shape) {
      const w = bb.width + pad * 2, h = bb.height + pad * 1.4, x0 = bb.x - pad, y0 = bb.y - pad * 0.7;
      if (X.o.type === 'thought') X.shape.setAttribute('d', scallop(x0 + w / 2, y0 + h / 2, w / 2 + 14, h / 2 + 14, Math.max(9, Math.round(w / 55)), 0.6));
      else X.shape.setAttribute('d', `M${n1(x0 + 30)},${n1(y0)}H${n1(x0 + w - 30)}Q${n1(x0 + w)},${n1(y0)} ${n1(x0 + w)},${n1(y0 + 30)}V${n1(y0 + h - 30)}Q${n1(x0 + w)},${n1(y0 + h)} ${n1(x0 + w - 30)},${n1(y0 + h)}H${n1(x0 + 30)}Q${n1(x0)},${n1(y0 + h)} ${n1(x0)},${n1(y0 + h - 30)}V${n1(y0 + 30)}Q${n1(x0)},${n1(y0)} ${n1(x0 + 30)},${n1(y0)}Z`);
      X.box = { x0, y0, w, h };
    }
  }
  function textAnchor(X, t) {
    const o = X.o, S = X.S;
    if (o.near) {
      const C = findChar(S, o.near);
      if (C) {
        const s = charState(C, t), hd = s.sk.head;
        const side = o.side === 'left' ? -1 : o.side === 'right' ? 1 : (s.f >= 0 ? 1 : -1) * (o.type === 'bubble' || o.type === 'thought' ? 1 : 0);
        const off = o.offset || [0, 0];
        return [s.px + hd[0] + side * (X.bb ? X.bb.w / 2 + 20 : 160) * 0.55 + off[0], s.py + hd[1] - BODY.head * s.H - (X.bb ? X.bb.h / 2 : 60) - 80 + off[1], s.px + hd[0], s.py + hd[1] - BODY.head * s.H];
      }
      const P = findProp(S, o.near);
      if (P) { const st = propState(P, t), off = o.offset || [0, -200]; return [st.x + off[0], st.y + off[1]]; }
    }
    return [o.x ?? 540, o.y ?? 600];
  }
  function drawText(X, t) {
    layoutText(X);
    const o = X.o, type = o.type || 'label';
    const sh = o.show ?? -1e9;
    if (t < sh || (o.hide !== undefined && t > o.hide + 0.4)) { X.g.style.display = 'none'; return; }
    X.g.style.display = '';
    const u = t - sh, inS = o.in || (type === 'title' ? 'pop' : type === 'label' || type === 'note' ? 'write' : type === 'arrow' || type === 'circle' || type === 'underline' || type === 'strike' ? 'draw' : 'pop');
    let k = 1, a = 1, dy = 0, prog = 1;
    if (inS === 'pop') k = ease('back.out(2)')(clamp(u / 0.36, 0, 1));
    else if (inS === 'fade') a = smooth(u / 0.35);
    else if (inS === 'rise') { a = smooth(u / 0.3); dy = 40 * (1 - ease('power3.out')(clamp(u / 0.45, 0, 1))); }
    else if (inS === 'draw' || inS === 'write') prog = clamp(u / (o.inDur || (type === 'circle' ? 0.6 : inS === 'write' ? Math.min(1.1, 0.12 + 0.045 * String(o.text || '').length) : 0.55)), 0, 1);
    if (o.hide !== undefined && t >= o.hide) { const v = clamp((t - o.hide) / 0.3, 0, 1); if ((o.out || 'pop') === 'pop') k *= 1 - ease('back.in(1.8)')(v); else a *= 1 - v; }
    const pos = textAnchor(X, t);
    const rot = o.rot ?? (type === 'sticker' ? -4 : 0);
    const wob = o.wiggle ? Math.sin(u * 7) * 2 : 0;
    X.g.style.opacity = a;
    if (type === 'arrow' || type === 'circle' || type === 'underline' || type === 'strike') {
      const pe = ease('power2.inOut')(prog);
      const tgt = o.to !== undefined ? targetPoint(X.S, o.to, t) : null;
      const from = o.from && typeof o.from !== 'string' ? o.from : o.from ? targetPoint(X.S, o.from, t) : [pos[0], pos[1]];
      X.g.setAttribute('transform', '');
      if (type === 'arrow') {
        const to = tgt || o.toXY || [from[0] + 200, from[1]];
        const mx = (from[0] + to[0]) / 2, my = (from[1] + to[1]) / 2, dx = to[0] - from[0], dy2 = to[1] - from[1];
        const bend = o.bend ?? 0.25, cx = mx - dy2 * bend, cy = my + dx * bend;
        X.path.setAttribute('d', `M${n1(from[0])},${n1(from[1])}Q${n1(cx)},${n1(cy)} ${n1(to[0])},${n1(to[1])}`);
        X.path.style.strokeDasharray = '1 1'; X.path.style.strokeDashoffset = String(1 - pe);
        const ang = Math.atan2(to[1] - cy, to[0] - cx), L = 42, hv = smooth(prog * 4 - 3);
        X.head.setAttribute('d', `M${n1(to[0] - L * Math.cos(ang - 0.5))},${n1(to[1] - L * Math.sin(ang - 0.5))}L${n1(to[0])},${n1(to[1])}L${n1(to[0] - L * Math.cos(ang + 0.5))},${n1(to[1] - L * Math.sin(ang + 0.5))}`);
        X.head.style.opacity = hv;
      } else {
        const c = tgt || [pos[0], pos[1]], rx = o.rx || 150, ry = o.ry || 110;
        if (type === 'circle') X.path.setAttribute('d', `M${n1(c[0] + rx)},${n1(c[1] - 10)}C${n1(c[0] + rx)},${n1(c[1] - ry * 1.3)} ${n1(c[0] - rx * 1.3)},${n1(c[1] - ry * 1.1)} ${n1(c[0] - rx)},${n1(c[1])}C${n1(c[0] - rx)},${n1(c[1] + ry * 1.2)} ${n1(c[0] + rx * 1.2)},${n1(c[1] + ry * 1.2)} ${n1(c[0] + rx * 1.05)},${n1(c[1] - ry * 0.25)}`);
        else if (type === 'underline') X.path.setAttribute('d', `M${n1(c[0] - rx)},${n1(c[1])}q${n1(rx)},14 ${n1(rx * 2)},-4`);
        else X.path.setAttribute('d', `M${n1(c[0] - rx)},${n1(c[1] + ry * 0.6)}L${n1(c[0] + rx)},${n1(c[1] - ry * 0.6)}M${n1(c[0] - rx)},${n1(c[1] - ry * 0.6)}L${n1(c[0] + rx)},${n1(c[1] + ry * 0.6)}`);
        X.path.style.strokeDasharray = '1 1'; X.path.style.strokeDashoffset = String(1 - pe);
      }
      return;
    }
    X.g.setAttribute('transform', `translate(${n1(pos[0])},${n1(pos[1] + dy)}) rotate(${n1(rot + wob)}) scale(${n1(k * 1000) / 1000})`);
    if (type === 'counter') {
      const dur = o.dur ?? 1.2, v = lerp(o.from ?? 0, o.to ?? 100, ease('power2.out')(clamp(u / dur, 0, 1)));
      const dec = o.decimals ?? 0, num = dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US');
      const txt = (o.prefix || '') + num + (o.suffix || '');
      if (X._last !== txt) { X.txt.textContent = txt; X._last = txt; }
    }
    if (inS === 'write' && X.txt) {
      if (!X.clip) {
        const id = `wc${X.S.idx}_${X.S.texts.indexOf(X)}`;
        const cp = el('clipPath', { id }, X.g); X.clipR = el('rect', null, cp); X.txt.setAttribute('clip-path', `url(#${id})`); X.clip = 1;
      }
      const bb = X.bb;
      X.clipR.setAttribute('x', n1(bb.x - 20)); X.clipR.setAttribute('y', n1(bb.y - 30)); X.clipR.setAttribute('height', n1(bb.h + 60));
      X.clipR.setAttribute('width', n1((bb.w + 40) * prog));
    }
    if (X.tail && X.box) {
      const b = X.box, dir = (o.side === 'left' ? -1 : 1);
      if (pos.length > 2) {
        const tx = pos[2] - pos[0], ty = pos[3] - pos[1] - 30;
        if (o.type === 'thought') X.tail.setAttribute('d', `M${n1(tx * 0.45)},${n1(b.y0 + b.h + 26)}a16,16 0 1 1 0.1,0ZM${n1(tx * 0.75)},${n1(b.y0 + b.h + (ty - b.y0 - b.h) * 0.55)}a9,9 0 1 1 0.1,0Z`);
        else { const bx = clamp(tx * 0.35, b.x0 + 50, b.x0 + b.w - 50); X.tail.setAttribute('d', `M${n1(bx - 26)},${n1(b.y0 + b.h - 4)}L${n1(tx * 0.9)},${n1(ty)}L${n1(bx + 26)},${n1(b.y0 + b.h - 4)}`); }
      } else X.tail.setAttribute('d', `M${n1(-26 * dir)},${n1(b.y0 + b.h - 4)}L${n1(40 * dir)},${n1(b.y0 + b.h + 70)}L${n1(30 * dir)},${n1(b.y0 + b.h - 4)}`);
    }
  }

  // ── camera
  function camAt(S, t) {
    let x = S.camBase.x, y = S.camBase.y, z = S.camBase.zoom;
    const ks = S.cam;
    const ch = (name, base) => sch(ks.filter((k) => k[name] !== undefined).map((k) => ({ t: k.t, dur: k.dur, ease: k.ease, v: k[name] })), base, t, undefined, 'power2.inOut');
    if (ks.length) { x = ch('x', x); y = ch('y', y); z = ch('zoom', z); }
    const fo = S.s.follow;
    if (fo) {
      const C = findChar(S, fo.id || fo);
      if (C) {
        // averaged over a short window = a smooth, slightly lagging camera operator
        let sx = 0; const n = 6;
        for (let i = 0; i < n; i++) sx += charState(C, Math.max(S.s.start, t - i * 0.06)).px;
        const w = fo.from !== undefined ? smooth((t - fo.from) / 0.6) * (fo.to !== undefined ? 1 - smooth((t - fo.to) / 0.6) : 1) : 1;
        x = lerp(x, sx / n + (fo.dx || 0), w);
        charState(C, t);
      }
    }
    for (const sh of S.s.shakes || []) {
      const w = env(t, sh.t, sh.dur ?? 0.5, 0.05, 0.3);
      if (w > 0) { x += noise(t * 30, 1) * (sh.amp ?? 18) * w; y += noise(t * 30, 2) * (sh.amp ?? 18) * w; }
    }
    return { x, y, z };
  }
  function layerXf(cam, d) {
    const z = 1 + (cam.z - 1) * d, ox = (cam.x - 540) * d, oy = (cam.y - 960) * d;
    return `translate(540,960) scale(${n1(z * 1000) / 1000}) translate(${n1(-540 - ox)},${n1(-960 - oy)})`;
  }

  // ── transitions between scenes (the outgoing scene owns the kind)
  const TRANS = {
    push: (p, o, i, dir) => { o.transform = `translateX(${n1(-1080 * p * dir)}px)`; i.transform = `translateX(${n1(1080 * (1 - p) * dir)}px)`; },
    whip: (p, o, i, dir) => { const b = Math.sin(Math.PI * p) * 26; o.transform = `translateX(${n1(-1080 * p * dir)}px)`; i.transform = `translateX(${n1(1080 * (1 - p) * dir)}px)`; o.filter = i.filter = `blur(${n1(b)}px)`; },
    slideUp: (p, o, i) => { o.transform = `translateY(${n1(-1920 * p)}px)`; i.transform = `translateY(${n1(1920 * (1 - p))}px)`; },
    zoom: (p, o, i) => { o.transform = `scale(${n1((1 + 0.7 * p) * 1000) / 1000})`; o.opacity = 1 - p; o.filter = `blur(${n1(10 * p)}px)`; i.transform = `scale(${n1((0.78 + 0.22 * p) * 1000) / 1000})`; i.opacity = p; },
    dissolve: (p, o, i) => { i.opacity = p; o.filter = `blur(${n1(8 * p)}px)`; },
    dip: (p, o, i) => { o.opacity = 1 - smooth(p * 2); i.opacity = smooth(p * 2 - 1); },
    iris: (p, o, i, dir, f) => { const R = 2300 * p; i.clipPath = `circle(${n1(R)}px at ${n1(f[0])}px ${n1(f[1])}px)`; },
    wipe: (p, o, i) => { i.clipPath = `inset(0 0 0 ${n1(100 * (1 - p))}%)`; },
    cut: (p, o, i) => { i.opacity = p > 0.5 ? 1 : 0; },
  };

  // ── captions + progress bar
  function buildCaptions() {
    const d = document.createElement('div'); d.className = 'sk-cap'; ROOT.appendChild(d);
    return { d };
  }
  function drawCaptions(t) {
    const cs = D.captions.chunks;
    let idx = -1;
    for (let i = 0; i < cs.length; i++) if (t >= cs[i].t0 && t < cs[i].t1) { idx = i; break; }
    if (idx !== LAST_CHUNK) {
      CAP.d.innerHTML = idx < 0 ? '' : `<div class="sk-pill">${cs[idx].words.map((w, j) => `<span data-j="${j}">${esc(w.w)}</span>`).join(' ')}</div>`;
      CAP.spans = idx < 0 ? [] : [...CAP.d.querySelectorAll('span')];
      CAP.pill = CAP.d.firstChild; LAST_CHUNK = idx;
    }
    if (idx < 0) return;
    const ch = cs[idx], u = t - ch.t0;
    CAP.pill.style.transform = `scale(${n1(ease('back.out(2)')(clamp(u / 0.16, 0, 1)) * 0.08 * 1000 + 920) / 1000})`;
    ch.words.forEach((w, j) => { const on = t >= w.t0 - 0.03; const cur = on && (j === ch.words.length - 1 || t < ch.words[j + 1].t0 - 0.03); CAP.spans[j].className = cur ? 'on' : on ? 'said' : ''; });
  }
  function buildBar() {
    const d = document.createElement('div'); d.className = 'sk-bar';
    d.innerHTML = '<div class="sk-track"><div class="sk-fill"></div></div><div class="sk-pct">0%</div>';
    ROOT.appendChild(d);
    return { d, fill: d.querySelector('.sk-fill'), pct: d.querySelector('.sk-pct') };
  }
  function drawBar(t) {
    const done = D.barDone ?? D.total - 1;
    let v = 0.99 * ease('power2.out')(clamp(t / 1.0, 0, 1));
    if (t >= done) v = lerp(0.99, 1, ease('power2.out')(clamp((t - done) / 0.4, 0, 1)));
    BAR.fill.style.transform = `scaleX(${n1(v * 1000) / 1000})`;
    BAR.pct.textContent = Math.floor(v * 100 + 0.0001) + '%';
  }

  // ───────────────────────── frame ─────────────────────────
  function render(t) {
    const N = SC.length;
    for (let i = 0; i < N; i++) {
      const S = SC[i], s = S.s;
      const on = t >= s.start - 1e-6 && t <= s.end + 1e-6;
      const st = S.div.style;
      if (!on) { if (st.display !== 'none') st.display = 'none'; continue; }
      st.display = ''; st.transform = ''; st.opacity = 1; st.filter = ''; st.clipPath = ''; st.zIndex = String(i + 1);
      const cam = camAt(S, t);
      const camXf = layerXf(cam, 1);
      S.L.mid.setAttribute('transform', camXf);
      S.L.fx.setAttribute('transform', camXf);
      for (const dc of S.decor) if (dc.wrap) dc.wrap.setAttribute('transform', layerXf(cam, dc.depth));
      for (const C of S.chars) drawChar(C, t);
      for (const P of S.props) drawProp(P, t);
      for (const X of S.texts) drawText(X, t);
    }
    // transitions
    for (let i = 0; i + 1 < N; i++) {
      const A = SC[i], B = SC[i + 1], tr = A.s.transition || { kind: 'whip' };
      const t0 = B.s.start, dur = A.s.end - B.s.start;
      if (t < t0 || t > A.s.end || dur <= 0) continue;
      const p = ease(tr.ease || (tr.kind === 'whip' ? 'power4.inOut' : tr.kind === 'iris' ? 'power2.in' : 'power3.inOut'))(clamp((t - t0) / dur, 0, 1));
      const fn = TRANS[tr.kind] || TRANS.whip;
      const focus = tr.focus ? (typeof tr.focus === 'string' ? (() => { const tp = targetPoint(B, tr.focus, t); return tp ? [tp[0], tp[1] - 100] : [540, 860]; })() : tr.focus) : [540, 860];
      fn(p, A.div.style, B.div.style, tr.dir === 'right' ? -1 : 1, focus);
    }
    if (CAP) drawCaptions(t);
    if (BAR) drawBar(t);
  }

  // ───────────────────────── exports ─────────────────────────
  return {
    init, render, VW, VH,
    names: {
      poses: Object.keys(POSES), gestures: Object.keys(GESTURES), exprs: Object.keys(EXPRS), props: Object.keys(PROPS),
      sets: Object.keys(SETS), emotes: Object.keys(EMOTES), hairs: HAIRS, accessories: ACCESSORIES, themes: Object.keys(THEMES),
      transitions: Object.keys(TRANS), colors: Object.keys(COLORS), gaits: Object.keys(GAITS).concat(['jump']),
      textTypes: ['title', 'label', 'note', 'sticker', 'bubble', 'thought', 'counter', 'arrow', 'circle', 'underline', 'strike'],
      joints: JOINTS,
    },
    _internal: { fullPose, skeleton, POSES, PROPS, SETS },
  };
});
