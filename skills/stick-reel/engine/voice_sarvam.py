#!/usr/bin/env python3
"""Builds the voiceover with Sarvam AI (default: bulbul:v4-flash "chandrika_en_stories"), one sentence per request.

Lines come from story.json: every entry of every scene's "say" is one line (numbered 1..N in story order).
Each sentence is trimmed of its own silence (and the inhale the "stories" voices take) and sentences are
joined with fixed pauses. Word timings come from whisper per line (script spelling wins when the word counts
match). Writes assets/vo/<VOICE_DIR>/lineN.wav/.words.json/.dur, which src/build.mjs reads.
Override with env SARVAM_SPEAKER / SARVAM_MODEL / SARVAM_PACE / VOICE_DIR.
The key is SARVAM_API_KEY from the environment or a .env file (never printed, never copied).
Run:  src/voice.sh [line numbers...]
"""
import base64
import io
import json
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
ENVS = [ROOT / ".env", ROOT.parent / ".env", ROOT.parent.parent / ".env", ROOT.parent.parent.parent / ".env",
        Path.home() / ".config" / "stick-reel" / ".env"]
SPEAKER = os.environ.get("SARVAM_SPEAKER", "chandrika_en_stories")
MODEL = os.environ.get("SARVAM_MODEL", "bulbul:v4-flash")
OUT = ROOT / "assets" / "vo" / os.environ.get("VOICE_DIR", "chandrika")
PACE = float(os.environ.get("SARVAM_PACE", "1.4"))
LANG, TEMP, SR = "en-IN", 0.5, 44100
PAUSE = {".": 0.26, "?": 0.3, "!": 0.26}  # gap after a sentence inside one line
HF = ["npx", "-y", "hyperframes@0.8.162"]
# pronunciation fixes sent to the TTS only (captions keep the script spelling); keep one word per word
SAY = json.loads((ROOT / "story.json").read_text()).get("pronounce", {})  # TTS-only respellings, e.g. {"THC": "T.H.C."}


def key():
    if os.environ.get("SARVAM_API_KEY"):
        return os.environ["SARVAM_API_KEY"].strip()
    for env in ENVS:
        if env.exists():
            for l in env.read_text().splitlines():
                if l.startswith("SARVAM_API_KEY="):
                    return l.split("=", 1)[1].strip().strip('"')
    sys.exit("SARVAM_API_KEY not found (env var or .env)")


def lines():
    """story.json -> [[sentence, ...] per line] in line order."""
    story = json.loads((ROOT / "story.json").read_text())
    out = []
    for sc in story["scenes"]:
        say = sc.get("say") or []
        for item in (say if isinstance(say, list) else [say]):
            text = item if isinstance(item, str) else item.get("text", "")
            if text.strip():
                out.append([x for x in re.split(r"(?<=[.?!])\s+", text.strip()) if x])
    return out


def tts(text, k):
    body = json.dumps({"text": text, "language_code": LANG, "speaker": SPEAKER, "model": MODEL, "pace": PACE,
                       "temperature": TEMP, "speech_sample_rate": SR}).encode()
    req = urllib.request.Request("https://api.sarvam.ai/text-to-speech", data=body,
                                 headers={"api-subscription-key": k, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.loads(r.read())
    x, sr = sf.read(io.BytesIO(base64.b64decode("".join(data["audios"]))))
    return (x if x.ndim == 1 else x.mean(axis=1)), sr


def trim(x, sr, floor_db=-40.0):
    """Cut edge silence AND a lone breath at either edge (a short noisy burst set apart by silence) —
    the "stories" voices inhale before each sentence, which reads as an awkward pause once sentences are joined."""
    n = int(0.01 * sr)
    fr = len(x) // n
    rms = np.sqrt(np.mean(x[: fr * n].reshape(fr, n) ** 2, axis=1) + 1e-12)
    on = 20 * np.log10(rms / rms.max()) > floor_db
    runs, s0 = [], None
    for i, v in enumerate(on):
        if v and s0 is None:
            s0 = i
        if not v and s0 is not None:
            runs.append([s0, i]); s0 = None
    if s0 is not None:
        runs.append([s0, fr])
    runs = [r for r in runs if r[1] - r[0] >= 3]  # ignore clicks < 30 ms
    if not runs:
        return x

    def breath(r, gap):
        seg = x[r[0] * n:r[1] * n]
        sp = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) + 1e-9
        flat = np.exp(np.mean(np.log(sp))) / np.mean(sp)
        return (r[1] - r[0]) <= 30 and gap >= 10 and flat > 0.22

    while len(runs) > 1 and breath(runs[0], runs[1][0] - runs[0][1]):
        runs.pop(0)
    # a trailing run is only a breath if it is short: soft last words ("more.") look breathy too and were being cut
    while len(runs) > 1 and runs[-1][1] - runs[-1][0] <= 18 and breath(runs[-1], runs[-1][0] - runs[-2][1]):
        runs.pop()
    a, b = max(0, runs[0][0] * n - int(0.02 * sr)), min(len(x), runs[-1][1] * n + int(0.06 * sr))
    return x[a:b]


def words_for(v):
    """How many script words a number takes (hyphenated tens count as one): 50000 -> 2, 1250000 -> 6."""
    n = 0
    for scale in (10 ** 9, 10 ** 6, 1000):
        if v >= scale:
            n += words_for(v // scale) + 1
            v %= scale
    if v >= 100:
        n += 2
        v %= 100
    return n + (1 if v else 0) if n or v else 1


def spoken_len(ws):
    """Whisper writes numbers as digits ("2005,", "176") — count them as the words the script spells out
    (hyphenated tens like "seventy-six" are one token)."""
    n = 0
    for w in ws:
        raw = re.sub(r"[.,?!]", "", w["text"])
        if not raw.isdigit():
            n += 1
            continue
        v = int(raw)
        if v >= 10000 or (v >= 1000 and v % 1000 == 0):  # "fifty thousand", "two million"
            n += words_for(v)
        elif len(raw) == 4 and raw.startswith("20"):
            n += 2 + (raw[2:] != "00")
        elif len(raw) == 4:
            n += 2
        elif 100 <= v < 1000:
            n += 2 + (v % 100 != 0)
        else:
            n += 1
    return n


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    k = key()
    only = {int(a) for a in sys.argv[1:]}
    for n, sents in enumerate(lines(), 1):
        if only and n not in only:
            continue
        sw = " ".join(sents).split()
        for attempt in range(4):  # v4 voices occasionally add or drop words: re-roll until whisper agrees (±1 for "could not"/"2000")
            parts, sr = [], SR
            for i, sent in enumerate(sents):
                x, sr = tts(" ".join(SAY.get(w.strip(',.?!'), w.strip(',.?!')) + w[len(w.rstrip(',.?!')):] for w in sent.split()), k)
                parts.append(trim(x, sr))
                if i + 1 < len(sents):
                    parts.append(np.zeros(int(PAUSE.get(sent[-1], 0.26) * sr)))
            y = np.concatenate(parts)
            y = y / (np.max(np.abs(y)) + 1e-9) * 0.89
            wav = OUT / f"line{n}.wav"
            sf.write(wav, y, sr)
            for stale in (OUT / f"line{n}.raw.wav", OUT / f"line{n}.raw.words.json"):
                stale.unlink(missing_ok=True)  # tighten.py would otherwise re-read an older take
            r = subprocess.run(HF + ["transcribe", str(wav), "--engine", "whisper", "--model", "small.en", "--language", "en", "--json"],
                               check=True, capture_output=True, text=True, cwd=ROOT)
            ws = json.loads(Path(json.loads(r.stdout)["transcriptPath"]).read_text())
            if abs(spoken_len(ws) - len(sw)) <= 1:
                break
            print(f"line{n}: heard {len(ws)} words vs {len(sw)} -> retry", flush=True)
        words = [{"text": sw[i] if len(sw) == len(ws) else w["text"], "start": round(w["start"], 3), "end": round(w["end"], 3)} for i, w in enumerate(ws)]
        (OUT / f"line{n}.words.json").write_text(json.dumps(words))
        (OUT / f"line{n}.dur").write_text(f"durationSeconds {len(y) / sr:.3f}\n")
        flag = "" if len(sw) == len(ws) else f"   (!) whisper heard {len(ws)} words, script has {len(sw)}"
        print(f"line{n} {len(y) / sr:5.2f}s  " + " ".join(f"{w['text']}@{w['start']:.2f}" for w in words) + flag, flush=True)
    (ROOT / "transcript.json").unlink(missing_ok=True)


if __name__ == "__main__":
    sys.exit(main())
