"""Acorta los silencios largos de la narración y ajusta la velocidad para llegar a una duración objetivo.

Uso: python3 ajustar.py <narracion.mp3> <tiempos.json> <duración_objetivo_s> [pausa_s=0.38]
Reescribe el mp3 y los tiempos (cada palabra se mueve junto con el audio).
"""
import json, re, subprocess, sys, shutil

def silences(mp3):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-i", mp3, "-af", "silencedetect=noise=-35dB:d=0.35", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
    en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
    return list(zip(st, en))

def main(mp3, tj, target, keep=0.38):
    target, keep = float(target), float(keep)
    T = json.load(open(tj))
    cuts = []  # each pause keeps `keep` seconds (a short, natural breath)
    for a, b in silences(mp3):
        if b - a > keep + 0.05 and a > 0.05:
            cuts.append((a + keep / 2, b - keep / 2))
    removed = sum(b - a for a, b in cuts)
    shifted_end = T["end"] - removed
    tempo = max(1.0, min(1.15, shifted_end / target))
    def remap(t):
        r = sum(b - a for a, b in cuts if b <= t) + sum(t - a for a, b in cuts if a < t < b)
        return round((t - r) / tempo, 3)
    expr = "+".join(f"between(t,{a:.3f},{b:.3f})" for a, b in cuts) or "0"
    tmp = mp3 + ".tmp.mp3"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp3, "-af", f"aselect='not({expr})',asetpts=N/SR/TB,atempo={tempo:.4f}",
                    "-c:a", "libmp3lame", "-b:a", "160k", tmp], check=True)
    shutil.move(tmp, mp3)
    T["words"] = [remap(t) for t in T["words"]]
    T["end"] = remap(T["end"])
    T["tempo"] = round(tempo, 4); T["pauses_cut_s"] = round(removed, 2)
    json.dump(T, open(tj, "w"), indent=1)
    print(f"silencio quitado {removed:.1f}s, velocidad x{tempo:.3f}, duración final {T['end']:.1f}s")

if __name__ == "__main__":
    main(*sys.argv[1:5])
