#!/usr/bin/env python3
"""Synthesizes the reel's sound effects (no samples, no licences) and mixes them into one track.

Reads assets/sfx/cues.json ({"total": s, "events": [[t, kind, gain], ...]}, written by src/build.mjs) and
writes assets/sfx/mix.wav. Everything is deterministic (fixed noise seed).
Run via scripts: src/sfx.sh
"""
import json
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "assets" / "sfx"
SR = 44100
RNG = np.random.default_rng(7)


def t_(d):
    return np.arange(int(d * SR)) / SR


def env(n, a=0.004, k=18.0):
    t = np.arange(n) / SR
    e = np.exp(-k * t)
    att = max(1, int(a * SR))
    e[:att] *= np.linspace(0, 1, att)
    return e


def sweep(f0, f1, d, wave="sine"):
    t = t_(d)
    f = f0 * (f1 / f0) ** (t / d)
    ph = 2 * np.pi * np.cumsum(f) / SR
    if wave == "square":
        return np.sign(np.sin(ph)) * 0.6
    if wave == "tri":
        return 2 / np.pi * np.arcsin(np.sin(ph))
    return np.sin(ph)


def band(x, lo, hi):
    return sosfilt(butter(2, [lo, hi], btype="band", fs=SR, output="sos"), x)


def low(x, hi):
    return sosfilt(butter(2, hi, btype="low", fs=SR, output="sos"), x)


def note(f, d=0.5, k=7.0):
    t = t_(d)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)
    return x * env(len(t), 0.003, k)


def pop():  # sticker / card pop
    x = sweep(820, 360, 0.09) * env(int(0.09 * SR), 0.002, 30)
    return x + 0.25 * band(RNG.standard_normal(len(x)), 2000, 6000) * env(len(x), 0.001, 90)


def tick():  # tetris step / move
    x = low(sweep(1250, 1150, 0.035, "square"), 4000) * env(int(0.035 * SR), 0.001, 90)
    return x


def rot():  # piece rotation
    a, b = tick(), low(sweep(1650, 1600, 0.03, "square"), 4000) * env(int(0.03 * SR), 0.001, 100)
    return np.concatenate([a, np.zeros(int(0.025 * SR)), b])


def thud():  # piece locks into place
    n = int(0.16 * SR)
    x = sweep(170, 70, 0.16) * env(n, 0.002, 22)
    return x + 0.5 * low(RNG.standard_normal(n), 900) * env(n, 0.001, 45)


def clear():  # line clear: bright arpeggio + shimmer
    out = np.zeros(int(0.7 * SR))
    for i, f in enumerate([1046.5, 1318.5, 1568.0, 2093.0]):
        s = int(i * 0.055 * SR)
        x = note(f, 0.45, 9) * 0.8
        out[s:s + len(x)] += x[: len(out) - s]
    sh = band(RNG.standard_normal(len(out)), 5000, 11000) * env(len(out), 0.02, 6) * 0.25
    return out + sh


def sparkle():
    out = np.zeros(int(0.6 * SR))
    for i, f in enumerate([2637, 3136, 3951, 3520, 4186]):
        s = int(i * 0.07 * SR)
        x = np.sin(2 * np.pi * f * t_(0.25)) * env(int(0.25 * SR), 0.002, 16)
        out[s:s + len(x)] += x[: len(out) - s] * 0.6
    return out


def whoosh(d=0.5, f0=500, f1=3500):  # transitions: low band crossfades into a high band and back
    n = int(d * SR)
    noise = RNG.standard_normal(n)
    lo_b, hi_b = band(noise, f0 * 0.6, f0 * 2.2), band(noise, f1 * 0.5, min(15000, f1 * 1.8))
    p = np.sin(np.pi * np.linspace(0, 1, n))
    bell = p ** 1.6
    return (lo_b * (1 - p) + hi_b * p) * bell


def swish():
    return whoosh(0.38, 900, 2600) * 0.7


def boing():  # brain wakes up
    t = t_(0.3)
    f = 280 + 420 * (t / 0.3) + 30 * np.sin(2 * np.pi * 18 * t)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.003, 9)


def womp():  # memory fades
    return sweep(420, 110, 0.45, "tri") * env(int(0.45 * SR), 0.005, 5)


def buzz():  # FULL! alarm
    a = low(sweep(233, 233, 0.14, "square"), 2500) * env(int(0.14 * SR), 0.002, 6)
    return np.concatenate([a, np.zeros(int(0.06 * SR)), a * 0.9])


def ding():  # 100%
    t = t_(1.2)
    x = sum(g * np.sin(2 * np.pi * f * t) for f, g in [(1318.5, 1), (2637, 0.4), (3951, 0.18), (1975.5, 0.3)])
    return x * env(len(t), 0.002, 3.5)


def click():  # lamp switch
    n = int(0.02 * SR)
    return band(RNG.standard_normal(n), 1500, 6000) * env(n, 0.0005, 160)


def zzz():  # soft snore-ish breath
    n = int(0.5 * SR)
    return low(RNG.standard_normal(n), 700) * np.sin(np.pi * np.linspace(0, 1, n)) ** 2 * 0.6


def confetti():
    out = np.zeros(int(0.9 * SR))
    for i in range(14):
        s = int((0.02 + i * 0.05 + (i % 3) * 0.013) * SR)
        x = sweep(1800 + (i % 5) * 300, 900, 0.05) * env(int(0.05 * SR), 0.001, 50)
        out[s:s + len(x)] += x[: len(out) - s] * (0.7 - i * 0.03)
    return out


def drop():  # gamepad falls away
    return sweep(900, 160, 0.5) * env(int(0.5 * SR), 0.01, 4) * 0.7


def flip():  # a card flicked over: a short papery snap
    n = int(0.09 * SR)
    return band(RNG.standard_normal(n), 1800, 7000) * env(n, 0.002, 45) + 0.4 * sweep(300, 140, 0.09) * env(n, 0.001, 50)


def shuffle():  # cards riffling past each other
    out = np.zeros(int(0.55 * SR))
    for i in range(9):
        s = int((0.02 + i * 0.052 + (i % 2) * 0.008) * SR)
        x = flip() * (0.55 + 0.45 * np.sin(np.pi * i / 8))
        out[s:s + len(x)] += x[: len(out) - s]
    return out


def stamp():  # rubber stamp: thump + slap
    n = int(0.22 * SR)
    x = sweep(130, 60, 0.22) * env(n, 0.001, 18)
    return x + 0.6 * band(RNG.standard_normal(n), 500, 4000) * env(n, 0.0005, 70)


def scribble():  # pencil line
    n = int(0.3 * SR)
    am = 0.6 + 0.4 * np.sin(2 * np.pi * 14 * np.arange(n) / SR)
    return band(RNG.standard_normal(n), 2500, 8000) * am * np.sin(np.pi * np.linspace(0, 1, n)) * 0.6


def drip():  # water drop: a quick falling plop + a tiny bubble ring
    a = sweep(1500, 420, 0.07) * env(int(0.07 * SR), 0.001, 30)
    b = sweep(900, 1300, 0.09) * env(int(0.09 * SR), 0.002, 40) * 0.35
    return np.concatenate([a, b])


def flush():  # toilet flush: a swirling low noise swell that drains away
    n = int(1.1 * SR)
    t = np.arange(n) / SR
    x = low(RNG.standard_normal(n), 1400) * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * t))
    return x * np.sin(np.pi * np.clip(t / 1.1, 0, 1)) ** 1.5


def rattle():  # a glass shaken hard: fast clinks
    out = np.zeros(int(0.8 * SR))
    for i in range(14):
        s = int((0.01 + i * 0.055) * SR)
        f = 2400 + (i % 3) * 500
        x = (np.sin(2 * np.pi * f * t_(0.05)) + 0.5 * np.sin(2 * np.pi * f * 1.5 * t_(0.05))) * env(int(0.05 * SR), 0.001, 70)
        out[s:s + len(x)] += x[: len(out) - s] * (0.6 + 0.4 * (i % 2))
    return out


def counter():  # a fast accelerating tick run (1C -> 30C)
    out = np.zeros(int(1.1 * SR))
    tt, k = 0.0, 0
    while tt < 1.0:
        s = int(tt * SR)
        x = tick()
        out[s:s + len(x)] += x[: len(out) - s] * 0.7
        tt += max(0.025, 0.11 * (1 - tt) ** 1.5); k += 1
    return out


def riser():  # gauge shooting up
    return sweep(220, 1400, 0.55, "tri") * np.linspace(0.2, 1, int(0.55 * SR)) * env(int(0.55 * SR), 0.01, 1.5)


def siren():  # two-tone alarm
    seg = lambda f: low(sweep(f, f, 0.16, "square"), 3000) * env(int(0.16 * SR), 0.004, 2)
    return np.concatenate([seg(960), seg(770), seg(960), seg(770)])


def rimshot():  # ba-dum-tss
    out = np.zeros(int(1.2 * SR))
    tom = lambda f0, f1: sweep(f0, f1, 0.2) * env(int(0.2 * SR), 0.001, 14)
    for s, x in [(0.0, tom(240, 150)), (0.17, tom(170, 100))]:
        i = int(s * SR); out[i:i + len(x)] += x
    i = int(0.36 * SR)
    sn = band(RNG.standard_normal(int(0.18 * SR)), 1500, 5000) * env(int(0.18 * SR), 0.001, 25)
    cy = band(RNG.standard_normal(int(0.8 * SR)), 5000, 14000) * env(int(0.8 * SR), 0.001, 4) * 0.8
    out[i:i + len(sn)] += sn; out[i:i + len(cy)] += cy
    return out


def fall():  # a comment shrinking away
    return sweep(1200, 200, 1.0, "tri") * env(int(1.0 * SR), 0.01, 2.2) * 0.6


# ---------- spooky kit (dream reel) ----------
def heartbeat():  # lub-dub
    def thump(f, d, g):
        t = t_(d)
        return g * np.sin(2 * np.pi * f * t * (1 - 0.3 * t / d)) * env(len(t), 0.004, 14)
    a = thump(58, 0.28, 1.0)
    b = thump(52, 0.32, 0.75)
    x = np.zeros(int(0.75 * SR)); x[: len(a)] += a; s = int(0.24 * SR); x[s:s + len(b)] += b
    return low(x, 180)


def step():  # a heavy, slow footstep in a hallway
    t = t_(0.35)
    x = np.sin(2 * np.pi * 70 * t) * env(len(t), 0.003, 16) + 0.4 * low(RNG.standard_normal(len(t)), 600) * env(len(t), 0.001, 40)
    return x


def creak():  # old door hinge: a jittery, filtered saw that wobbles in pitch
    d = 1.1; t = t_(d)
    f = 170 + 60 * np.sin(2 * np.pi * 2.3 * t) + 35 * np.sin(2 * np.pi * 7.1 * t) + 80 * t
    ph = 2 * np.pi * np.cumsum(f) / SR
    saw = 2 * (ph / (2 * np.pi) % 1) - 1
    gate = 0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 31 * t))
    x = band(saw * gate, 300, 2600) * np.minimum(1, t / 0.08) * np.exp(-1.2 * t)
    return x


def sting():  # horror hit: sub boom + a dissonant high cluster + a noise slash
    d = 2.2; t = t_(d)
    boom = np.sin(2 * np.pi * 45 * t * (1 - 0.25 * t / d)) * env(len(t), 0.002, 2.6)
    cl = sum(np.sin(2 * np.pi * f * t) for f in (880.0, 932.3, 1244.5, 1318.5)) / 4 * env(len(t), 0.01, 1.6)
    sl = band(RNG.standard_normal(len(t)), 1500, 7000) * env(len(t), 0.001, 9)
    return boom + 0.5 * cl + 0.35 * sl


def flicker():  # a failing bulb: mains buzz chopped by clicks
    d = 0.45; t = t_(d)
    buzz = np.sign(np.sin(2 * np.pi * 100 * t)) * 0.4 + np.sin(2 * np.pi * 200 * t) * 0.3
    gate = (np.sin(2 * np.pi * 23 * t) > 0.2).astype(float)
    return band(buzz * gate, 150, 3000) * env(len(t), 0.002, 4)


def lock():  # padlock snapping shut: two metal clicks
    x = np.zeros(int(0.3 * SR))
    for k, (f, g) in enumerate(((3200, 1.0), (2400, 0.8))):
        t = t_(0.06)
        c = (np.sin(2 * np.pi * f * t) + 0.6 * np.sin(2 * np.pi * f * 1.51 * t)) * env(len(t), 0.0005, 80) * g
        s = int(k * 0.08 * SR); x[s:s + len(c)] += c
    return x


def fizz():  # a nerve signal shorting out
    d = 0.5; t = t_(d)
    x = band(RNG.standard_normal(len(t)), 2500, 9000) * (np.sin(2 * np.pi * 37 * t) > 0) * env(len(t), 0.002, 6)
    return x + 0.4 * sweep(1600, 200, d, "square") * env(len(t), 0.002, 7)


def zap():  # signal travelling down the nerve
    return sweep(300, 1400, 0.4, "tri") * env(int(0.4 * SR), 0.01, 3) * 0.8


def tickc():  # clock tick
    t = t_(0.04)
    return (np.sin(2 * np.pi * 2600 * t) + band(RNG.standard_normal(len(t)), 3000, 8000)) * env(len(t), 0.0005, 120)


def clap():  # clapperboard snap
    t = t_(0.12)
    return band(RNG.standard_normal(len(t)), 800, 6000) * env(len(t), 0.0005, 60) + 0.5 * np.sin(2 * np.pi * 180 * t) * env(len(t), 0.001, 40)


def alarm():  # low red-alert pulse
    d = 0.6; t = t_(d)
    return np.sign(np.sin(2 * np.pi * 330 * t)) * 0.5 * np.minimum(1, t / 0.02) * np.exp(-3 * t) + np.sin(2 * np.pi * 220 * t) * env(len(t), 0.01, 4)


def dark_whoosh():
    return low(whoosh(0.6, 200, 1400), 2200)


def glitch():  # a face swapping in the mirror: chopped noise + a stepping square warble
    d = 0.34; t = t_(d); n = len(t)
    gate = (np.floor(t * 40) % 2 == 0) * 1.0
    f = 160 + 140 * (np.floor(t * 26) % 5)
    tone = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR))
    return band(RNG.standard_normal(n), 900, 6000) * gate * env(n, 0.002, 6) + 0.35 * low(tone, 2500) * env(n, 0.002, 8)


def ghost():  # glassy, slightly detuned high tones swelling in (the gone parent)
    d = 2.2; t = t_(d)
    x = sum(np.sin(2 * np.pi * f * t + 0.4 * np.sin(2 * np.pi * 4.7 * t)) for f in (987.8, 1041.0, 1318.5)) + 0.5 * np.sin(2 * np.pi * 493.9 * t)
    a = np.minimum(1, t / 0.7) * np.exp(-np.maximum(0, t - 0.7) * 1.8)
    return x * a


def beep():  # bedside monitor
    t = t_(0.11)
    x = np.sin(2 * np.pi * 988 * t) + 0.2 * np.sin(2 * np.pi * 1976 * t)
    return x * np.minimum(1, np.minimum(t / 0.004, (0.11 - t) / 0.02))


def chime():  # a prayer heart arrives: soft rising bells
    out = np.zeros(int(1.4 * SR))
    for i, f in enumerate([1046.5, 1318.5, 1568.0]):
        x = note(f, 1.0, 4.5); s = int(i * 0.09 * SR)
        out[s:s + len(x)] += x[: len(out) - s] * 0.5
    return out


def choir():  # soft "aah" chord (C major), slow swell
    d = 2.4; t = t_(d); x = np.zeros(len(t))
    for f in [261.6, 329.6, 392.0, 523.3]:
        for det in (-0.004, 0.0, 0.004):
            ph = 2 * np.pi * f * (1 + det) * t + 0.3 * np.sin(2 * np.pi * 5.2 * t)
            x += sum(np.sin(k * ph) / k ** 1.6 for k in range(1, 7))
    x = band(x, 300, 2600)
    return x * np.minimum(1, t / 0.7) * np.minimum(1, (d - t) / 1.0)


def cash():  # ka-ching
    out = np.zeros(int(1.1 * SR))
    c = band(RNG.standard_normal(int(0.05 * SR)), 1500, 6000) * env(int(0.05 * SR), 0.001, 60)
    out[: len(c)] += c * 0.8
    for i, f in enumerate([2093.0, 2637.0]):
        x = sum(g * np.sin(2 * np.pi * f * k * t_(0.9)) for k, g in [(1, 1), (2.7, 0.3)]) * env(int(0.9 * SR), 0.002, 5)
        s = int((0.06 + i * 0.08) * SR); out[s:s + len(x)] += x[: len(out) - s] * 0.6
    return out


def curtain():  # hospital curtain: fabric swish + rail rings
    d = 0.7; n = int(d * SR); t = t_(d)
    x = band(RNG.standard_normal(n), 1200, 5000) * np.sin(np.pi * t / d) ** 2 * 0.6
    for i in range(7):
        s = int((0.05 + i * 0.08) * SR); m = int(0.03 * SR)
        x[s:s + m] += np.sin(2 * np.pi * (3200 + 200 * (i % 3)) * t_(0.03)) * env(m, 0.001, 120) * 0.5
    return x


def gulp():  # nervous swallow
    a = sweep(420, 160, 0.12) * env(int(0.12 * SR), 0.003, 14)
    b = sweep(180, 360, 0.1) * env(int(0.1 * SR), 0.003, 20)
    out = np.zeros(int(0.32 * SR)); out[: len(a)] += a; s = int(0.13 * SR); out[s:s + len(b)] += b * 0.7
    return low(out, 1400)


def gust():  # wind at altitude: band noise swelling and fading over ~3 s
    d = 3.2; n = int(d * SR); t = np.arange(n) / SR
    x = band(RNG.standard_normal(n), 180, 1400) * (np.sin(np.pi * t / d) ** 1.5) * (0.75 + 0.25 * np.sin(2 * np.pi * 1.7 * t))
    return x / (np.max(np.abs(x)) + 1e-9)


def rip():  # metal skin tearing: crackling noise bursts over a low boom
    d = 0.9; n = int(d * SR); t = np.arange(n) / SR
    crack = band(RNG.standard_normal(n), 900, 6000) * (RNG.random(n) > 0.55) * np.exp(-3.2 * t)
    boom = np.sin(2 * np.pi * (55 - 20 * t) * t) * np.exp(-4 * t)
    x = 0.7 * crack / (np.max(np.abs(crack)) + 1e-9) + 0.6 * boom
    return x / (np.max(np.abs(x)) + 1e-9)


def flash():  # a distant blast: a soft white-noise swell, then a deep, far rumble (never a loud bang)
    d = 3.6; n = int(d * SR); t = np.arange(n) / SR
    hiss = band(RNG.standard_normal(n), 2000, 9000) * np.exp(-6 * t)
    rum = low(RNG.standard_normal(n), 120) * np.minimum(1, t / 0.25) * np.exp(-0.9 * t)
    sub = np.sin(2 * np.pi * (42 - 8 * t) * t) * np.minimum(1, t / 0.2) * np.exp(-1.1 * t)
    x = 0.25 * hiss / (np.max(np.abs(hiss)) + 1e-9) + 0.6 * rum / (np.max(np.abs(rum)) + 1e-9) + 0.5 * sub
    return x / (np.max(np.abs(x)) + 1e-9)


def chug():  # steam train: soft chuff pulses over ~3 s
    d = 3.0; n = int(d * SR); t = np.arange(n) / SR
    puff = (0.5 + 0.5 * np.cos(2 * np.pi * 3.2 * t)) ** 6
    x = band(RNG.standard_normal(n), 300, 2400) * puff * np.minimum(1, t / 0.4) * np.minimum(1, (d - t) / 0.6)
    return x / (np.max(np.abs(x)) + 1e-9)


def drone():  # a far propeller plane: low beating hum, swells and fades
    d = 4.0; n = int(d * SR); t = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * f * t) for f in (92, 96.5, 184)) * (0.7 + 0.3 * np.sin(2 * np.pi * 11 * t)) * np.sin(np.pi * t / d) ** 2
    return low(x, 600)


def ring():  # ears ringing after the blast: a thin high tone fading out
    d = 2.2; n = int(d * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * 3800 * t) * np.minimum(1, t / 0.05) * np.exp(-1.6 * t)


def bed(total, turn=None, back=None):
    """Warm, curious bed: soft pad + a plucked music-box tune in C major. From `turn` (the twist) to `back`
    (the payoff) it drops to a tense low pulse in A minor, then the tune returns."""
    n = int(total * SR); t = np.arange(n) / SR
    turn = turn or total + 1; back = back or total + 1
    tense = ((t >= turn) & (t < back)).astype(float)
    sm = np.convolve(tense, np.ones(int(0.4 * SR)) / int(0.4 * SR), mode="same")
    padc = sum(np.sin(2 * np.pi * f * t) for f in [130.8, 196.0, 261.6, 329.6]) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.2 * t))
    pada = sum(np.sin(2 * np.pi * f * t) for f in [110.0, 164.8, 220.0]) * (0.6 + 0.4 * np.sin(2 * np.pi * 2.0 * t) ** 2)
    pad = low(padc * (1 - sm) + pada * sm, 900)
    box = np.zeros(n)
    mel = [523.3, 659.3, 784.0, 659.3, 698.5, 880.0, 784.0, 0, 587.3, 698.5, 784.0, 698.5, 659.3, 587.3, 523.3, 0]
    k, tt = 0, 0.3
    while tt < total - 0.4:
        f = mel[k % len(mel)]
        if f and not (turn <= tt < back):
            x = note(f, 0.9, 6) * 0.8; s = int(tt * SR); e = min(n, s + len(x)); box[s:e] += x[: e - s]
        k += 1; tt += 0.38
    x = 0.5 * pad / (np.max(np.abs(pad)) + 1e-9) + 0.35 * box / (np.max(np.abs(box)) + 1e-9)
    fade = np.minimum(1, t / 1.0) * np.minimum(1, (total - t) / 1.5)
    return x * fade


def quake():  # earthquake: a deep, grinding rumble that swells, with rattling debris on top (~6 s)
    d = 6.0; n = int(d * SR); t = np.arange(n) / SR
    deep = low(RNG.standard_normal(n), 70) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.7 * t) ** 2)
    grind = band(RNG.standard_normal(n), 90, 400) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 3.1 * t)))
    rat = band(RNG.standard_normal(n), 1500, 5000) * ((RNG.random(n) > 0.997).astype(float) * 6 + 0.05)
    x = deep / (np.max(np.abs(deep)) + 1e-9) + 0.45 * grind / (np.max(np.abs(grind)) + 1e-9) + 0.12 * rat / (np.max(np.abs(rat)) + 1e-9)
    return x * np.minimum(1, t / 0.5) * np.minimum(1, (d - t) / 1.5)


def jolt():  # one violent knock: low thump + a crack + rattle
    d = 1.2; n = int(d * SR); t = np.arange(n) / SR
    th = np.sin(2 * np.pi * (70 - 30 * t) * t) * np.exp(-6 * t)
    cr = band(RNG.standard_normal(n), 800, 6000) * np.exp(-30 * t)
    rat = band(RNG.standard_normal(n), 2000, 6000) * (RNG.random(n) > 0.996) * 5 * np.exp(-3 * t)
    return th + 0.6 * cr + 0.3 * rat


def crumble():  # masonry collapsing: many falling chunks over a low roar (~2.4 s)
    d = 2.4; n = int(d * SR); t = np.arange(n) / SR
    out = low(RNG.standard_normal(n), 300) * np.exp(-1.2 * t) * 0.7
    for i in range(26):
        s = int(((i * 0.6180339) % 1.0) * (d - 0.3) * SR); m = int(0.12 * SR)
        out[s:s + m] += band(RNG.standard_normal(m), 150, 2500) * env(m, 0.001, 30) * (0.4 + 0.6 * ((i * 7) % 5) / 4)
    return out


def crackle(d=2.0, n_pops=30):  # fire crackle
    out = np.zeros(int(d * SR))
    for i in range(n_pops):
        s = int(((i * 0.6180339) % 1.0) * (d - 0.06) * SR); m = int(0.03 * SR)
        out[s:s + m] += band(RNG.standard_normal(m), 1800, 7000) * env(m, 0.0005, 160) * (0.5 + 0.5 * ((i * 7) % 5) / 4)
    t = np.arange(len(out)) / SR
    return out + 0.15 * low(RNG.standard_normal(len(out)), 500) * np.minimum(1, t / 0.3)


def whoompf():  # gas igniting: a dull airy whoosh-boom
    d = 1.4; n = int(d * SR); t = np.arange(n) / SR
    return low(RNG.standard_normal(n), 400) * np.minimum(1, t / 0.04) * np.exp(-3 * t) + 0.3 * band(RNG.standard_normal(n), 1000, 4000) * np.exp(-8 * t)


def bell():  # a huge low bell struck once: inharmonic partials, long decay
    d = 3.5; t = t_(d)
    parts = [(98, 1.0), (196, 0.6), (233, 0.4), (294, 0.3), (392, 0.2), (520, 0.12)]
    return sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * (0.9 + f / 400)) for f, a in parts) * np.minimum(1, t / 0.005)


def surge():  # a huge wave: a rising roar of water
    d = 3.5; n = int(d * SR); t = np.arange(n) / SR
    x = low(RNG.standard_normal(n), 900) + 0.4 * band(RNG.standard_normal(n), 1500, 6000)
    return x * (t / d) ** 1.5 * np.minimum(1, (d - t) / 0.3)


def phone():  # emergency alert: harsh pulsing two-tone beeps
    seg = lambda f: np.sign(np.sin(2 * np.pi * f * t_(0.22))) * 0.5 * env(int(0.22 * SR), 0.003, 1.5)
    return np.concatenate([np.concatenate([seg(853) + seg(960), np.zeros(int(0.08 * SR))]) for _ in range(5)])


def spark():  # electric wire sparking
    d = 0.6; n = int(d * SR)
    return band(RNG.standard_normal(n), 2500, 9000) * ((RNG.random(n) > 0.99).astype(float) * 4 + 0.1) * env(n, 0.001, 5)


NOTES = {f"n{i}": (lambda f: (lambda: note(f, 0.6, 6)))(f) for i, f in enumerate([523.3, 587.3, 659.3, 698.5, 784.0, 880.0, 987.8, 1046.5])}
KINDS = dict(pop=pop, tick=tick, rot=rot, thud=thud, clear=clear, sparkle=sparkle, whoosh=whoosh, swish=swish, boing=boing,
             womp=womp, buzz=buzz, ding=ding, click=click, zzz=zzz, confetti=confetti, drop=drop, flip=flip, shuffle=shuffle, stamp=stamp, scribble=scribble, drip=drip, flush=flush, rattle=rattle, counter=counter,
             riser=riser, siren=siren, rimshot=rimshot, fall=fall, heartbeat=heartbeat, step=step, creak=creak, sting=sting, flicker=flicker,
             lock=lock, fizz=fizz, zap=zap, tickc=tickc, clap=clap, alarm=alarm, dwhoosh=dark_whoosh, glitch=glitch, ghost=ghost, beep=beep, chime=chime, choir=choir, cash=cash, curtain=curtain, gulp=gulp, gust=gust, rip=rip, flash=flash, chug=chug, drone=drone, ring=ring, quake=quake, jolt=jolt, crumble=crumble, crackle=crackle, whoompf=whoompf, bell=bell, surge=surge, phone=phone, spark=spark, **NOTES)


def main():
    cues = json.loads((D / "cues.json").read_text())
    mix = np.zeros(int((cues["total"] + 1.5) * SR))
    cache = {}
    for t, kind, gain in cues["events"]:
        if kind not in cache:
            x = KINDS[kind]()
            cache[kind] = x / (np.max(np.abs(x)) + 1e-9)
        x = cache[kind] * gain
        s = int(max(0, t) * SR)
        e = min(len(mix), s + len(x))
        mix[s:e] += x[: e - s]
    mix = mix[: int(cues["total"] * SR)]
    if cues.get("bed"):
        b = bed(cues["total"], cues.get("bed_turn"), cues.get("bed_back"))
        mix[: len(b)] += cues["bed"] * b / (np.max(np.abs(b)) + 1e-9)
    peak = np.max(np.abs(mix))
    if peak > 0.9:
        mix *= 0.9 / peak
    sf.write(D / "mix.wav", mix.astype(np.float32), SR, subtype="PCM_16")
    print(f"sfx: {len(cues['events'])} events, {len(mix) / SR:.2f}s, peak {peak:.2f}")


if __name__ == "__main__":
    main()
