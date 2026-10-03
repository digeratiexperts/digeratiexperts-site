"""Print {named_destination: 1-based page} for a Chromium PDF as JSON."""
import json
import sys

import pikepdf

pdf = pikepdf.open(sys.argv[1])
pages = {p.objgen: i + 1 for i, p in enumerate(pdf.pages)}
out = {}
names = pdf.Root.get("/Names", {}).get("/Dests")
dests = pdf.Root.get("/Dests")


def walk(node):
    if "/Names" in node:
        arr = list(node.Names)
        for k, v in zip(arr[::2], arr[1::2]):
            d = v.D if isinstance(v, pikepdf.Dictionary) else v
            out[str(k)] = pages.get(d[0].objgen)
    for kid in node.get("/Kids", []):
        walk(kid)


if names is not None:
    walk(names)
if dests is not None:
    for k, v in dests.items():
        d = v.D if isinstance(v, pikepdf.Dictionary) else v
        out[k[1:]] = pages.get(d[0].objgen)
print(json.dumps(out))
