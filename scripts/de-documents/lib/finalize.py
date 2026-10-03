"""Finish a Chromium PDF: mark untagged content as artifacts, and set the
metadata Chromium leaves out (author, subject, keywords, language,
DisplayDocTitle so viewers show the title, not the filename).
Usage: finalize.py <file.pdf> '<json {title, subject, keywords, lang}>'"""
import json
import sys

import pikepdf

PAINT = {"Tj", "TJ", "'", '"', "f", "F", "f*", "B", "B*", "b", "b*", "S", "s", "Do", "sh", "BI"}


def mark_artifacts(pdf):
    """Wrap every painting operator that Chromium left outside marked content
    (running headers/footers, page backgrounds, decorative numerals, diagram
    internals already described by a Figure's alt text) in /Artifact BMC…EMC,
    so no content sits outside the structure tree. Returns the count wrapped."""
    n = 0
    for page in pdf.pages:
        out, depth = [], 0
        for operands, op in pikepdf.parse_content_stream(page):
            o = str(op)
            if o in ("BDC", "BMC"):
                depth += 1
            elif o == "EMC":
                depth -= 1
            if depth == 0 and o in PAINT:
                out.append(([pikepdf.Name.Artifact], pikepdf.Operator("BMC")))
                out.append((operands, op))
                out.append(([], pikepdf.Operator("EMC")))
                n += 1
            else:
                out.append((operands, op))
        page.Contents = pdf.make_stream(pikepdf.unparse_content_stream(out))
    return n


path, meta = sys.argv[1], json.loads(sys.argv[2])
with pikepdf.open(path, allow_overwriting_input=True) as pdf:
    mark_artifacts(pdf)
    with pdf.open_metadata(set_pikepdf_as_editor=False) as xmp:
        xmp["dc:title"] = meta["title"]
        xmp["dc:creator"] = ["Digerati Experts"]
        xmp["dc:description"] = meta["subject"]
        xmp["pdf:Keywords"] = meta["keywords"]
        xmp["dc:language"] = [meta["lang"]]
    pdf.docinfo["/Title"] = meta["title"]
    pdf.docinfo["/Author"] = "Digerati Experts"
    pdf.docinfo["/Subject"] = meta["subject"]
    pdf.docinfo["/Keywords"] = meta["keywords"]
    pdf.docinfo["/Creator"] = "DE document system"
    pdf.Root.Lang = pikepdf.String(meta["lang"])
    vp = pdf.Root.get("/ViewerPreferences", pikepdf.Dictionary())
    vp.DisplayDocTitle = True
    pdf.Root.ViewerPreferences = vp
    pdf.save(path, compress_streams=True, object_stream_mode=pikepdf.ObjectStreamMode.generate)
