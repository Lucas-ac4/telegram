"""Genera la narración de un Short con ElevenLabs y los tiempos de cada palabra.

Uso: python3 narrar.py <index.html del Short> <salida.mp3> <salida_tiempos.json>
Lee BLOCKS del index.html, pasa los números a palabras para la voz,
llama a text-to-speech/with-timestamps y guarda el audio y el tiempo de inicio
de cada palabra de los subtítulos (en segundos desde el inicio del audio).
La API key la agrega el proxy del entorno (no va en el código).
"""
import json, re, sys, base64, urllib.request

VOICE = "vfEvl4KwAqUqLImfFD8p"  # Siglos en Palitos - Narrador
NUM = {"168": "ciento sesenta y ocho", "1532": "mil quinientos treinta y dos",
       "1438": "mil cuatrocientos treinta y ocho", "40": "cuarenta", "1325": "mil trescientos veinticinco",
       "1428": "mil cuatrocientos veintiocho", "1519": "mil quinientos diecinueve", "1521": "mil quinientos veintiuno",
       "1978": "mil novecientos setenta y ocho", "500": "quinientos",
       "2012": "dos mil doce", "900": "novecientos", "99.999": "noventa y nueve mil novecientos noventa y nueve",
       "100.000": "cien mil", "175": "ciento setenta y cinco", "1697": "mil seiscientos noventa y siete",
       "1562": "mil quinientos sesenta y dos", "30": "treinta"}
# emotion tags for eleven_v3, inserted before a block that starts with these words (not shown in captions)
TAGS = {"Eso sí, eran unos genios": "[excited] "}

def spoken(word):
    m = re.match(r"^([¿¡(]*)(\d[\d.]*\d|\d)([^\d]*)$", word)
    return m.group(1) + NUM[m.group(2)] + m.group(3) if m and m.group(2) in NUM else word

def main(html, out_mp3, out_json, model="eleven_v3", speed=1.0):
    src = open(html, encoding="utf-8").read()
    blocks = re.findall(r'\[\s*[\d.]+,\s*[\d.]+,\s*"((?:[^"\\]|\\.)*)"\]', src.split("const BLOCKS = [")[1].split("];")[0])
    def build(with_tags):
        text, offsets = "", []  # offsets[i] = char index where caption word i starts in the spoken text
        for b in blocks:
            tag = next((v for k, v in TAGS.items() if b.startswith(k)), "") if with_tags else ""
            if tag: text += (" " if text else "") + tag.strip()
            for w in b.split():
                if text: text += " "
                offsets.append(len(text))
                text += spoken(w)
        return text, offsets
    text, offsets = build(True)
    body = {"text": text, "model_id": model, "voice_settings": {"stability": 0.5, "similarity_boost": 0.8, "speed": speed}}
    req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}/with-timestamps?output_format=mp3_44100_128",
                                 data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "xi-api-key": "proxy-injected"})
    d = json.load(urllib.request.urlopen(req, timeout=300))
    open(out_mp3, "wb").write(base64.b64decode(d["audio_base64"]))
    al = d["alignment"]
    starts = al["character_start_times_seconds"]
    if "".join(al["characters"]) != text:
        # some models drop the emotion tags from the alignment: map against the untagged text
        text, offsets = build(False)
        assert "".join(al["characters"]) == text, "alignment text mismatch"
    words = [round(starts[o], 3) for o in offsets]
    json.dump({"words": words, "end": round(al["character_end_times_seconds"][-1], 3), "blocks": [len(b.split()) for b in blocks], "model": model},
              open(out_json, "w"), indent=1)
    print("palabras", len(words), "duración", round(al["character_end_times_seconds"][-1], 2), "s")

if __name__ == "__main__":
    main(*sys.argv[1:4], **({"model": sys.argv[4]} if len(sys.argv) > 4 else {}))
