"""Report every link annotation: target, the text under its rectangle, and
for internal links the destination page. Usage: links.py <file.pdf> [...]"""
import subprocess
import sys

import pikepdf

for path in sys.argv[1:]:
    pdf = pikepdf.open(path)
    pages = {p.objgen: i + 1 for i, p in enumerate(pdf.pages)}
    names = {}
    nd = pdf.Root.get("/Names", {}).get("/Dests")

    def walk(node):
        if "/Names" in node:
            arr = list(node.Names)
            for k, v in zip(arr[::2], arr[1::2]):
                d = v.D if isinstance(v, pikepdf.Dictionary) else v
                names[str(k)] = pages.get(d[0].objgen)
        for kid in node.get("/Kids", []):
            walk(kid)

    if nd is not None:
        walk(nd)
    for k, v in (pdf.Root.get("/Dests") or {}).items():
        d = v.D if isinstance(v, pikepdf.Dictionary) else v
        names[k.lstrip("/")] = pages.get(d[0].objgen)
    print(f"== {path.split('/')[-1]}")
    for i, page in enumerate(pdf.pages, 1):
        h = float(page.MediaBox[3])
        for a in page.get("/Annots", []):
            if a.get("/Subtype") != "/Link":
                continue
            x0, y0, x1, y1 = [float(v) for v in a.Rect]
            txt = subprocess.run(
                ["pdftotext", "-f", str(i), "-l", str(i), "-x", str(int(x0)), "-y", str(int(h - y1)),
                 "-W", str(int(x1 - x0) + 1), "-H", str(int(y1 - y0) + 1), path, "-"],
                capture_output=True, text=True).stdout.split()
            if "/A" in a and "/URI" in a.A:
                target = str(a.A.URI)
            elif "/Dest" in a:
                target = f"#{str(a.Dest).lstrip('/')} → p.{names.get(str(a.Dest).lstrip('/'), '?')}"
            else:
                target = "?"
            print(f"   p{i} [{' '.join(txt)[:46]:46}] {target}  ({x1 - x0:.0f}×{y1 - y0:.0f} pt)")
