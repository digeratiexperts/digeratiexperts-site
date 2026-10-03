"""Set PDF document metadata Chromium leaves out: author, subject, keywords,
language, and DisplayDocTitle so viewers show the title, not the filename.
Usage: finalize.py <file.pdf> '<json {title, subject, keywords, lang}>'"""
import json
import sys

import pikepdf

path, meta = sys.argv[1], json.loads(sys.argv[2])
with pikepdf.open(path, allow_overwriting_input=True) as pdf:
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
