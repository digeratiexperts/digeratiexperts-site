"""Render each PDF's pages side by side into one PNG contact sheet.
Usage: sheets.py <out_dir> <dpi> [--gray] <file.pdf> [...]
Writes <out_dir>/<stem>.png (overwrites). Used for visual QA evidence."""
import os
import subprocess
import sys
import tempfile

from PIL import Image

out_dir, dpi, *rest = sys.argv[1:]
gray = "--gray" in rest
pdfs = [p for p in rest if p != "--gray"]
os.makedirs(out_dir, exist_ok=True)
for pdf in pdfs:
    stem = os.path.splitext(os.path.basename(pdf))[0]
    with tempfile.TemporaryDirectory() as tmp:
        args = ["pdftoppm", "-r", dpi, "-png"] + (["-gray"] if gray else []) + [pdf, os.path.join(tmp, "p")]
        subprocess.run(args, check=True)
        files = sorted(os.listdir(tmp))
        ims = [Image.open(os.path.join(tmp, f)).convert("RGB") for f in files]
        w, h = ims[0].size
        sheet = Image.new("RGB", (len(ims) * w + (len(ims) - 1) * 8, h), "#777777")
        for i, im in enumerate(ims):
            sheet.paste(im, (i * (w + 8), 0))
        target = os.path.join(out_dir, f"{stem}{'-gray' if gray else ''}.png")
        sheet.save(target, optimize=True)
        print(target, len(ims), "pages")
