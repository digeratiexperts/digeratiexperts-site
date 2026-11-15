"""Read public PDF text and link annotations; never modify the input files."""
import json
from pathlib import Path
import subprocess

import pikepdf

ROOT = Path(__file__).resolve().parents[1]


def inspect(path):
    text = subprocess.check_output(["pdftotext", str(path), "-"], text=True)
    with pikepdf.open(path) as pdf:
        uris = []
        for page in pdf.pages:
            for annotation in page.get("/Annots", []):
                action = annotation.get("/A", {})
                if "/URI" in action:
                    uris.append(str(action["/URI"]))
        return {"path": str(path.relative_to(ROOT)), "text": text, "uris": uris, "pages": len(pdf.pages)}


if __name__ == "__main__":
    roots = [ROOT / "client/public", ROOT / "public", ROOT / "document_templates"]
    print(json.dumps([inspect(p) for root in roots for p in sorted(root.rglob("*.pdf"))]))
