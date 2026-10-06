"""Live check of the PDFs production serves (nightly, .github/workflows/live-pdf-check.yml).

CI checks the PDFs a commit would produce. This checks what production
actually serves, which can drift without a commit: on 2026-10-05 production's
Chromium (151) started tagging <strong> as the PDF 2.0 type /Strong, and every
order and receipt failed PDF/UA-1 until finalizePdf role-mapped it (#480).

Checks:
  - a solution packet rendered live by POST /api/public/solutions/packet-pdf
    (the one public Store PDF endpoint), through scripts/de-documents/lib/verify.py:
    tagging, fonts, metadata, and veraPDF PDF/UA-1 when VERAPDF is set;
  - every resource PDF under client/public/assets/resources, fetched from the
    live site, through the same verifier;
  - whether each live resource PDF is byte-identical to the repository copy.
    A mismatch is reported as a warning (a stale cache or an undeployed
    commit), not a failure.

Usage: python3 scripts/qa/live_pdf_check.py [out-dir]   (SITE_URL overrides the site)
Exit 1 when a PDF cannot be fetched or fails verification.
"""
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys
import urllib.request

import pikepdf

SITE = os.environ.get("SITE_URL", "https://digeratiexperts.com").rstrip("/")
REPO = pathlib.Path(__file__).resolve().parents[2]
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "live-pdfs").resolve()
UA = {"User-Agent": "DE-live-pdf-check/1 (+https://github.com/digeratiexperts/digeratiexperts-site)"}

# EXAMPLE data. Three packages, so the packet runs to two pages and the close
# travels with the last line (#488).
PACKET = {
    "reference": "SOL-LIVECHECK",
    "statusLabel": "Draft",
    "profile": "Dental practice, 3 sites",
    "relationship": "Fully managed",
    "support": "Business hours remote",
    "packages": [
        {
            "familyLabel": family,
            "offerName": offer,
            "pricingLabel": "Per user / month",
            "assessmentLabel": "Assessment included",
            "setupLabel": "Remote onboarding",
            "lineItems": [{"label": f"{offer} scope line {i + 1}", "quantity": f"{i + 2} covered users"} for i in range(n)],
        }
        for family, offer, n in [
            ("IT Operations & Support", "ProActive Office", 4),
            ("Cybersecurity", "Managed Endpoint Defense", 3),
            ("Compliance", "HIPAA Readiness", 2),
        ]
    ],
}


def fetch(url, data=None):
    headers = dict(UA)
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if data is not None else "GET")
    with urllib.request.urlopen(req, timeout=90) as r:
        body = r.read()
        if not body.startswith(b"%PDF-"):
            raise ValueError(f"not a PDF ({r.headers.get('Content-Type')}, {len(body)} bytes)")
        return body


def verify(paths):
    """Run verify.py; return {file name: (passed, problems)}."""
    out = subprocess.run(
        [sys.executable, str(REPO / "scripts/de-documents/lib/verify.py"), *map(str, paths)],
        capture_output=True, text=True,
    )
    (OUT / "verify.txt").write_text(out.stdout + out.stderr)
    res, cur = {}, None
    for line in out.stdout.splitlines():
        m = re.match(r"^== (.+)$", line)
        if m:
            cur = pathlib.Path(m.group(1)).name
            res[cur] = (False, ["no verdict"])
        elif cur and line.strip() == "PASS":
            res[cur] = (True, [])
        elif cur and line.strip().startswith("FAIL: "):
            res[cur] = (False, line.strip()[6:].split("; "))
    return res


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows, errors, warnings, files = [], [], [], []

    try:
        pdf = fetch(f"{SITE}/api/public/solutions/packet-pdf", json.dumps(PACKET).encode())
        p = OUT / "solution-packet-live.pdf"
        p.write_bytes(pdf)
        files.append(p)
        rows.append(["solution packet (rendered live)", p, ""])
    except Exception as e:  # noqa: BLE001 - report every failure kind the same way
        errors.append(f"solution packet: {e}")

    for src in sorted((REPO / "client/public/assets/resources").rglob("*.pdf")):
        rel = src.relative_to(REPO / "client/public").as_posix()
        try:
            pdf = fetch(f"{SITE}/{rel}")
        except Exception as e:  # noqa: BLE001
            errors.append(f"{rel}: {e}")
            continue
        p = OUT / src.name
        p.write_bytes(pdf)
        files.append(p)
        same = hashlib.sha256(pdf).digest() == hashlib.sha256(src.read_bytes()).digest()
        if not same:
            warnings.append(f"{rel}: live bytes differ from the repository copy (stale cache or undeployed commit)")
        rows.append([rel, p, "" if same else "differs from repo"])

    verdicts = verify(files) if files else {}
    table = []
    for name, f, note in rows:
        ok, problems = verdicts.get(f.name, (False, ["not verified"]))
        if not ok:
            errors.append(f"{name}: {'; '.join(problems)}")
        with pikepdf.open(f) as d:
            pages, producer = len(d.pages), str(d.docinfo.get("/Producer", "?"))
        table.append([name, str(pages), producer, "pass" if ok else "FAIL", note])

    lines = [
        f"### Live PDF check ({SITE}): {'FAILED' if errors else 'all passed'}",
        "",
        f"{len(files)} PDFs fetched and verified (tagging, fonts, metadata"
        f"{', veraPDF PDF/UA-1' if os.environ.get('VERAPDF') else ''}).",
        "",
        "| PDF | Pages | Producer | Result | Note |",
        "|---|---|---|---|---|",
        *("| " + " | ".join(r) + " |" for r in table),
    ]
    if errors:
        lines += ["", "**Failures**", *(f"- {e}" for e in errors)]
    if warnings:
        lines += ["", "**Warnings**", *(f"- {w}" for w in warnings)]
    summary = "\n".join(lines) + "\n"
    (OUT / "summary.md").write_text(summary)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as fh:
            fh.write(summary)
    print(summary)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
