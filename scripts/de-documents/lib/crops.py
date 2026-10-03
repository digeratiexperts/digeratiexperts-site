"""Cut readability crops from qa-readability renders around real text, found
with pdftotext -bbox. Usage: crops.py <render-dir> <out-dir>"""
import os
import re
import subprocess
import sys

from PIL import Image

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
PUB = "client/public/assets/resources"
# (label, pdf, page, anchor word, points above anchor, height in points)
TARGETS = [
    ("scope-table", f"{PUB}/datasheets/proactive-office-ecosystem-datasheet.pdf", 1, "CAPABILITY", 30, 210),
    ("links", f"{PUB}/datasheets/proactive-office-ecosystem-datasheet.pdf", 2, "digeratiexperts.com/book", 70, 120),
    ("checklist-writing", f"{PUB}/checklists/backup-bcdr-checklist.pdf", 2, "C01", 20, 200),
    ("findings-table", f"{PUB}/reports/cyber-risk-assessment-sample.pdf", 2, "AREA", 10, 230),
]


def anchor(pdf, page, word):
    xml = subprocess.run(["pdftotext", "-bbox", "-f", str(page), "-l", str(page), pdf, "-"], capture_output=True, text=True).stdout
    for m in re.finditer(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>', xml):
        if m.group(5) == word:
            return float(m.group(2))
    raise SystemExit(f"anchor {word} not found in {pdf} p{page}")


for label, pdf, page, word, above, height in TARGETS:
    y = anchor(pdf, page, word)
    stem = os.path.basename(pdf)[:-4]
    for vp in (390, 768, 1440):
        for z in (1, 2):
            f = os.path.join(src, f"{stem}-p{page}-{vp}-z{z}.png")
            if not os.path.exists(f):
                continue
            im = Image.open(f)
            s = im.width / 612.0
            top, bottom = int((y - above) * s), int((y - above + height) * s)
            if z == 1:
                box = (0, top, im.width, bottom)
            else:  # 2x pinch: the viewer shows a window one viewport wide; take the left content half
                box = (int(40 * s), top, int(40 * s) + im.width // 2, bottom)
            im.crop(box).save(os.path.join(out, f"{label}-{vp}-z{z}.png"), optimize=True)
            print(label, vp, z, im.crop(box).size)
