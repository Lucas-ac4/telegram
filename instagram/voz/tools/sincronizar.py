"""Sincroniza un Short con su narración: tiempos de BLOCKS, subtítulos palabra por palabra, duración y <audio>.

Uso: python3 sincronizar.py <index.html> <narracion-tiempos.json> [offset_s=2.0] [cola_s=1.0]
La narración empieza en `offset` (después de la portada).
"""
import json, re, sys

def main(html, tj, offset="2.0", tail="1.0"):
    offset, tail = float(offset), float(tail)
    T = json.load(open(tj)); W = T["words"]
    s = open(html, encoding="utf-8").read()
    head, rest = s.split("const BLOCKS = [", 1)
    body, after = rest.split("];", 1)
    rows = re.findall(r'\[\s*[\d.]+,\s*[\d.]+,\s*("(?:[^"\\]|\\.)*")\]', body)
    k, starts = 0, []
    for n in T["blocks"]:
        starts.append(round(offset + W[k] - 0.05, 2)); k += n
    end = round(offset + T["end"], 2)
    dur = round(end + tail, 2)
    new = "\n" + "".join(f"        [{starts[i]}, {starts[i + 1] if i + 1 < len(starts) else end}, {txt}],\n" for i, txt in enumerate(rows)) + "      "
    s = head + "const BLOCKS = [" + new + "];" + after
    wt = "      // start time of every caption word, from the ElevenLabs narration (seconds)\n      const WT = " + json.dumps([round(offset + t, 3) for t in W]) + ";\n"
    s = re.sub(r"      // start time of every caption word.*?\n      const WT = \[.*?\];\n", "", s, flags=re.S)
    s = s.replace("      const WORDS = [];\n", wt + "      const WORDS = [];\n", 1)
    s = s.replace("ws.forEach((w, i) => WORDS.push({ w, t: a + i * span,", "ws.forEach((w, i) => WORDS.push({ w, t: WT[WORDS.length] ?? a + i * span,")
    s = re.sub(r"const DUR = [\d.]+,", f"const DUR = {dur},", s)
    s = re.sub(r'(data-composition-id="main" data-start="0" data-duration=")[\d.]+"', rf'\g<1>{dur}"', s)
    s = re.sub(r'(<svg id="stage" class="clip" data-start="0" data-duration=")[\d.]+"', rf'\g<1>{dur}"', s)
    if 'id="narracion"' not in s:
        s = s.replace("      <svg id=\"stage\"", f'      <audio id="narracion" src="assets/narracion.mp3" data-start="{offset}" data-track-index="2" data-volume="1"></audio>\n      <svg id="stage"', 1)
    open(html, "w", encoding="utf-8").write(s)
    print("bloques", starts, "fin voz", end, "duración", dur)

if __name__ == "__main__":
    main(*sys.argv[1:])
