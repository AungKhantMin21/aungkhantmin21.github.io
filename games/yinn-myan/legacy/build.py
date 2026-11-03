"""Assemble the playable single-file game.

    python3 tools/build.py

Inputs:  src/main.html (game), src/dsp.js (engine-sound synth), data/road.json (map)
Output:  index.html (everything inlined; works on GitHub Pages and as a claude.ai artifact)
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
main = (ROOT / "src/main.html").read_text(encoding="utf-8")
dsp = (ROOT / "src/dsp.js").read_text(encoding="utf-8")
road = (ROOT / "data/road.json").read_text(encoding="utf-8")
assert "</script" not in dsp and "</script" not in road

page = main.replace("/*DSP*/", dsp).replace("/*ROAD*/", road)
head, body = page.split("</style>", 1)
doc = (
    "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n"
    + head + "</style>\n</head>\n<body>" + body + "\n</body>\n</html>\n"
)
(ROOT / "index.html").write_text(doc, encoding="utf-8")
print("built index.html", len(doc) // 1024, "KB")
