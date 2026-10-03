"""Technical checks for a DE document-system PDF.
Usage: verify.py <file.pdf> [...]
Reports: pages, size, title/lang/DisplayDocTitle, tagging and structure
element counts, font embedding and type, link targets, extractable words.
Exit code 1 if a hard requirement fails (untagged, unembedded or Type 3 font,
missing title or language, no extractable text)."""
import collections
import subprocess
import sys

import pikepdf


def struct_counts(pdf):
    counts = collections.Counter()
    root = pdf.Root.get("/StructTreeRoot")
    if root is None:
        return counts
    stack = [root.get("/K")]
    while stack:
        k = stack.pop()
        if k is None:
            continue
        if isinstance(k, pikepdf.Array):
            stack.extend(list(k))
        elif isinstance(k, pikepdf.Dictionary):
            if "/S" in k:
                counts[str(k.S)[1:]] += 1
            if "/K" in k:
                stack.append(k.K)
    return counts


def fonts(path):
    out = subprocess.run(["pdffonts", path], capture_output=True, text=True).stdout.splitlines()[2:]
    rows = []
    for ln in out:
        parts = ln.split()
        # name, type..., emb, sub, uni, obj, gen
        emb, sub, uni = parts[-5], parts[-4], parts[-3]
        rows.append((parts[0], " ".join(parts[1:-6]), emb, uni))
    return rows


def main(paths):
    bad = False
    for p in paths:
        pdf = pikepdf.open(p)
        info = pdf.docinfo
        lang = str(pdf.Root.get("/Lang", ""))
        vp = pdf.Root.get("/ViewerPreferences", {})
        tagged = "/MarkInfo" in pdf.Root and bool(pdf.Root.MarkInfo.get("/Marked", False))
        sc = struct_counts(pdf)
        links = []
        for page in pdf.pages:
            for a in page.get("/Annots", []):
                if a.get("/Subtype") == "/Link" and "/A" in a and "/URI" in a.A:
                    links.append(str(a.A.URI))
        outline = len(list(pdf.open_outline().root))
        fr = fonts(p)
        words = len(subprocess.run(["pdftotext", p, "-"], capture_output=True, text=True).stdout.split())
        size = __import__("os").path.getsize(p)
        problems = []
        if not tagged or not sc:
            problems.append("untagged")
        if not str(info.get("/Title", "")):
            problems.append("no title")
        if not lang:
            problems.append("no /Lang")
        if not vp.get("/DisplayDocTitle", False):
            problems.append("DisplayDocTitle off")
        for name, typ, emb, uni in fr:
            if emb != "yes":
                problems.append(f"font not embedded: {name}")
            if "Type 3" in typ:
                problems.append(f"Type 3 font: {name}")
            if uni != "yes":
                problems.append(f"no ToUnicode: {name}")
        if words < 50:
            problems.append("little or no extractable text")
        bad |= bool(problems)
        print(f"== {p}")
        print(f"   pages {len(pdf.pages)} · {size/1024:.0f} KB · title '{info.get('/Title')}' · lang {lang} · tagged {tagged} · outline entries {outline}")
        print(f"   structure: " + ", ".join(f"{k}:{v}" for k, v in sorted(sc.items())))
        print(f"   fonts: {len(fr)} ({', '.join(sorted({t for _, t, _, _ in fr}))}) · words {words}")
        print(f"   links: {sorted(set(links))}")
        print(f"   {'FAIL: ' + '; '.join(problems) if problems else 'PASS'}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
