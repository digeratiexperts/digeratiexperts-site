"""Finish a Chromium PDF: mark untagged content as artifacts, and set the
metadata Chromium leaves out (author, subject, keywords, language,
DisplayDocTitle so viewers show the title, not the filename).
Usage: finalize.py <file.pdf> '<json {title, subject, keywords, lang}>'"""
import json
import subprocess
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


def _struct_elems(node, out):
    if isinstance(node, pikepdf.Array):
        for k in node:
            _struct_elems(k, out)
    elif isinstance(node, pikepdf.Dictionary) and "/S" in node:
        out.append(node)
        if "/K" in node:
            _struct_elems(node.K, out)
    return out


def wrap_list_bodies(pdf):
    """PDF/UA 7.2-20: an LI may contain only Lbl and LBody. Chromium puts list
    content straight into LI, so move it into a new LBody and repoint the
    ParentTree entries and child /P links at the LBody."""
    root = pdf.Root.StructTreeRoot
    moved = {}
    for li in _struct_elems(root.K, []):
        if li.S != "/LI" or "/K" not in li:
            continue
        kids = list(li.K) if isinstance(li.K, pikepdf.Array) else [li.K]
        if all(isinstance(k, pikepdf.Dictionary) and k.get("/S") in ("/Lbl", "/LBody") for k in kids):
            continue
        body = pdf.make_indirect(pikepdf.Dictionary(Type=pikepdf.Name.StructElem, S=pikepdf.Name.LBody, P=li, K=pikepdf.Array(kids)))
        if "/Pg" in li:
            body.Pg = li.Pg
        for k in kids:
            if isinstance(k, pikepdf.Dictionary) and "/S" in k:
                k.P = body
        li.K = pikepdf.Array([body])
        moved[li.objgen] = body
    nums = root.ParentTree.get("/Nums", pikepdf.Array())
    for i in range(1, len(nums), 2):
        v = nums[i]
        if isinstance(v, pikepdf.Array):
            for j, el in enumerate(v):
                if isinstance(el, pikepdf.Dictionary) and el.objgen in moved:
                    v[j] = moved[el.objgen]
        elif isinstance(v, pikepdf.Dictionary) and v.objgen in moved:
            nums[i] = moved[v.objgen]
    return len(moved)


# PDF 2.0 structure types and their nearest PDF 1.7 standard type (ISO 32000-2, 14.8.4).
PDF2_ROLES = {"Strong": "Span", "Em": "Span", "Sub": "Span", "Title": "P", "FENote": "Note", "Aside": "Div", "DocumentFragment": "Div"}


def map_pdf2_roles(pdf):
    """PDF/UA 7.1-5: Chromium 151 tags <b>/<strong> as /Strong (and <em> as
    /Em), types PDF 1.7 does not define. Role-map the ones in use to their
    PDF 1.7 equivalent; keep existing entries, never remap standard types.
    Same mapping as server/pdf/finalizePdf.ts. Returns the types added."""
    root = pdf.Root.get("/StructTreeRoot")
    if root is None:
        return []
    used = {str(e.S)[1:] for e in _struct_elems(root.get("/K"), [])} & PDF2_ROLES.keys()
    role_map = root.get("/RoleMap")
    if role_map is None:
        role_map = root.RoleMap = pikepdf.Dictionary()
    added = sorted(t for t in used if "/" + t not in role_map)
    for t in added:
        role_map["/" + t] = pikepdf.Name("/" + PDF2_ROLES[t])
    return added


def describe_links(pdf, src):
    """PDF/UA 7.18.1 / 7.18.5: every link annotation needs a text alternative.
    Use the visible text under the link, plus where it goes."""
    n = 0
    for i, page in enumerate(pdf.pages, 1):
        h = float(page.MediaBox[3])
        for a in page.get("/Annots", []):
            if a.get("/Subtype") != "/Link" or "/Contents" in a:
                continue
            x0, y0, x1, y1 = [float(v) for v in a.Rect]
            text = " ".join(subprocess.run(
                ["pdftotext", "-f", str(i), "-l", str(i), "-x", str(int(x0)), "-y", str(int(h - y1)),
                 "-W", str(int(x1 - x0) + 1), "-H", str(int(y1 - y0) + 1), src, "-"],
                capture_output=True, text=True).stdout.split())
            uri = str(a.A.URI) if "/A" in a and "/URI" in a.A else ""
            if uri.startswith("mailto:"):
                desc = f"Email Digerati Experts at {uri[7:]}"
            elif uri.startswith("tel:"):
                desc = f"Call Digerati Experts at {text or uri[4:]}"
            elif uri:
                desc = f"{text or uri} (opens {uri})"
            else:
                desc = f"Go to section: {text}" if text else "Go to section"
            a.Contents = pikepdf.String(desc)
            n += 1
    return n


path, meta = sys.argv[1], json.loads(sys.argv[2])
with pikepdf.open(path, allow_overwriting_input=True) as pdf:
    describe_links(pdf, path)  # reads text from the file as Chromium wrote it
    wrap_list_bodies(pdf)
    map_pdf2_roles(pdf)
    mark_artifacts(pdf)
    with pdf.open_metadata(set_pikepdf_as_editor=False) as xmp:
        xmp["dc:title"] = meta["title"]
        xmp["dc:creator"] = ["Digerati Experts"]
        xmp["dc:description"] = meta["subject"]
        xmp["pdf:Keywords"] = meta["keywords"]
        xmp["dc:language"] = [meta["lang"]]
        # PDF/UA identification (ISO 14289-1 §5). Valid only because verify.py
        # runs veraPDF's PDF/UA-1 profile and fails the build when it does not pass.
        xmp.register_xml_namespace("http://www.aiim.org/pdfua/ns/id/", "pdfuaid")
        xmp["pdfuaid:part"] = "1"
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
