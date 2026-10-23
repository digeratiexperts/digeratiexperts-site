#!/usr/bin/env python3
"""DE signcheck — Authenticode signature scanner for files shared through the DE portal.

Checks Windows executables and installers (EXE, DLL, SYS, MSI, MSP) and the
executables inside ZIP archives. It answers four questions for every file:

  1. What is this file really? (detected from its content, not its extension)
  2. Is it code-signed?
  3. Is the signature valid and chained to a root Windows trusts?
  4. Is the signer on DE's trusted-publisher list (optional)?

Usage:
  signcheck.py FILE [FILE ...] [--json] [--trusted-publishers publishers.json]
               [--name ORIGINAL_NAME]

Exit codes (worst result across all files wins):
  0   all files trusted, or not executable (nothing to sign)
  10  warning: unsigned, or signed by a publisher not on the trusted list
  20  block: invalid/tampered signature, extension mismatch, or unscannable archive
  2   usage or internal error

Verdicts (per file):
  trusted            valid signature chained to a trusted root (and on the
                     publisher list, if one was given)
  signed_unlisted    valid signature, but signer is not on the publisher list
  unsigned           executable/installer with no signature
  invalid            signature present but fails verification (tampered,
                     untrusted root, bad timestamp, ...)
  not_executable     content is not a Windows executable or installer
  unscannable        encrypted or malformed archive, or too large to inspect
  error              the scanner itself failed on this file
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import sys
import tempfile
import zipfile
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, BinaryIO

# Use the bundled oscrypto: the PyPI release cannot detect OpenSSL 3.0.10+
# (Ubuntu 22.04/24.04 ship 3.0.x), which breaks signify on import.
_VENDOR = Path(__file__).resolve().parent / "vendor"
if _VENDOR.is_dir():
    sys.path.insert(0, str(_VENDOR))

import olefile  # noqa: E402  (needed for MSI support in signify)
from asn1crypto import x509 as asn1_x509  # noqa: E402
from signify.authenticode.signed_file import AuthenticodeFile  # noqa: E402

TOOL_VERSION = "1.0.0"

# --- Limits (protect the server from zip bombs and huge uploads) -------------
MAX_FILE_BYTES = 2 * 1024**3          # 2 GiB for a single file on disk
MAX_MEMBER_BYTES = 1 * 1024**3        # 1 GiB uncompressed per archive member
MAX_ARCHIVE_TOTAL_BYTES = 4 * 1024**3  # 4 GiB uncompressed per archive
MAX_ARCHIVE_MEMBERS = 5000
MAX_COMPRESSION_RATIO = 200           # uncompressed/compressed, per member
MAX_ARCHIVE_DEPTH = 3                 # ZIP inside ZIP inside ZIP

PE_EXTENSIONS = {".exe", ".dll", ".sys", ".scr", ".ocx", ".cpl", ".efi", ".mui", ".com"}
MSI_EXTENSIONS = {".msi", ".msp", ".mst"}
ZIP_EXTENSIONS = {".zip", ".msix", ".appx", ".msixbundle", ".appxbundle", ".nupkg", ".jar", ".docx",
                  ".xlsx", ".pptx", ".odt", ".ods", ".odp", ".vsix"}
# Office Open XML and similar are ZIP containers; that is not a mismatch.

OLE_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
MSI_CLSIDS = {
    "000C1084-0000-0000-C000-000000000046": "msi",  # installer package
    "000C1086-0000-0000-C000-000000000046": "msp",  # patch
    "000C1082-0000-0000-C000-000000000046": "mst",  # transform
}

SEVERITY = {"trusted": 0, "not_executable": 0, "signed_unlisted": 10, "unsigned": 10,
            "invalid": 20, "unscannable": 20, "error": 20}


# --- Result model ---------------------------------------------------------------
@dataclass
class Signer:
    subject: str
    common_name: str | None
    organization: str | None
    issuer: str
    serial_number: str
    sha1_thumbprint: str
    sha256_fingerprint: str
    valid_from: str
    valid_to: str
    extended_key_usages: list[str]


@dataclass
class Result:
    path: str
    name: str
    size: int
    sha256: str
    detected_type: str            # pe | msi | msp | mst | zip | ole | other
    extension: str
    extension_mismatch: bool
    verdict: str
    reason: str
    signed: bool = False
    signature_valid: bool = False
    signer: Signer | None = None
    chain: list[str] = field(default_factory=list)
    digest_algorithm: str | None = None
    timestamp: str | None = None
    program_name: str | None = None
    trusted_publisher_match: str | None = None
    members: list["Result"] = field(default_factory=list)  # ZIP contents

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        return d


# --- Helpers ----------------------------------------------------------------------
def _sha256_stream(fh: BinaryIO) -> tuple[str, int]:
    fh.seek(0)
    h = hashlib.sha256()
    size = 0
    for chunk in iter(lambda: fh.read(1024 * 1024), b""):
        h.update(chunk)
        size += len(chunk)
    fh.seek(0)
    return h.hexdigest(), size


def detect_type(fh: BinaryIO) -> str:
    """Identify the file from its content."""
    fh.seek(0)
    head = fh.read(8)
    fh.seek(0)
    if head[:2] == b"MZ":
        return "pe"
    if head[:4] == b"PK\x03\x04" or head[:4] == b"PK\x05\x06":
        return "zip"
    if head == OLE_MAGIC:
        try:
            ole = olefile.OleFileIO(fh)
            clsid = (ole.root.clsid or "").upper()
            ole.close()
        except Exception:
            fh.seek(0)
            return "ole"
        fh.seek(0)
        return MSI_CLSIDS.get(clsid, "ole")
    return "other"


def is_mismatch(ext: str, detected: str) -> bool:
    """True when the name hides what the file really is."""
    ext = ext.lower()
    if detected == "pe":
        return ext not in PE_EXTENSIONS  # an EXE renamed to .pdf, .jpg, .txt ...
    if detected in ("msi", "msp", "mst"):
        return ext not in MSI_EXTENSIONS
    if ext in PE_EXTENSIONS:
        return True  # claims to be an executable but is not one
    if ext in MSI_EXTENSIONS:
        return detected not in ("msi", "msp", "mst")
    if ext == ".zip":
        return detected != "zip"
    return False


def _name_part(name: Any, oid_name: str) -> str | None:
    try:
        parts = name.get_components(oid_name)
        parts = list(parts)
        return str(parts[0]) if parts else None
    except Exception:
        return None


def _ekus(cert: Any) -> list[str]:
    try:
        parsed = asn1_x509.Certificate.load(cert.to_der())
        val = parsed.extended_key_usage_value
        return [str(x) for x in val.native] if val is not None else []
    except Exception:
        return []


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def _signer_from(signed_data: Any) -> Signer | None:
    si = signed_data.signer_info
    try:
        cert = signed_data.certificates.find_certificate(
            issuer=si.issuer, serial_number=si.serial_number)
    except Exception:
        return None
    return Signer(
        subject=cert.subject.dn,
        common_name=_name_part(cert.subject, "CN"),
        organization=_name_part(cert.subject, "O"),
        issuer=cert.issuer.dn,
        serial_number=format(cert.serial_number, "x"),
        sha1_thumbprint=cert.sha1_fingerprint.lower(),
        sha256_fingerprint=cert.sha256_fingerprint.lower(),
        valid_from=_iso(cert.valid_from) or "",
        valid_to=_iso(cert.valid_to) or "",
        extended_key_usages=_ekus(cert),
    )


def _timestamp_from(signed_data: Any) -> str | None:
    cs = getattr(signed_data.signer_info, "countersigner", None)
    if cs is None:
        return None
    ts = getattr(cs, "signing_time", None)
    if ts is None and hasattr(cs, "signer_info"):
        ts = getattr(cs.signer_info, "signing_time", None)
    return _iso(ts)


def _digest_name(signed_data: Any) -> str | None:
    fn = getattr(signed_data, "digest_algorithm", None)
    name = getattr(fn, "__name__", None) or getattr(fn, "name", None)
    return name.replace("openssl_", "") if name else None


# --- Trusted publishers --------------------------------------------------------------
def load_publishers(path: str | None) -> list[dict[str, str]]:
    """Publisher list format:

    {"publishers": [
      {"label": "Digerati Experts (Artifact Signing)",
       "eku": "1.3.6.1.4.1.311.97.XXXXXXXXX.XXXXX.XXXXX.X",
       "organization": "Digerati Experts LLC"},
      {"label": "Microsoft", "organization": "Microsoft Corporation"},
      {"label": "Some vendor", "sha1": "abcdef..."}
    ]}

    Every field given in an entry must match. Use "eku" (or "organization" +
    "common_name") for Artifact Signing, whose certificates rotate every few
    days, so thumbprints change with each signing.
    """
    if not path:
        return []
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    pubs = data.get("publishers", data if isinstance(data, list) else [])
    for p in pubs:
        if not any(k in p for k in ("sha1", "eku", "organization", "common_name")):
            raise ValueError(f"publisher entry has nothing to match on: {p}")
    return pubs


def match_publisher(signer: Signer, pubs: list[dict[str, str]]) -> str | None:
    for p in pubs:
        checks = []
        if "sha1" in p:
            checks.append(signer.sha1_thumbprint == p["sha1"].lower().replace(":", ""))
        if "eku" in p:
            checks.append(p["eku"] in signer.extended_key_usages)
        if "organization" in p:
            checks.append((signer.organization or "") == p["organization"])
        if "common_name" in p:
            checks.append((signer.common_name or "") == p["common_name"])
        if checks and all(checks):
            return p.get("label") or p.get("organization") or p.get("sha1") or p.get("eku")
    return None


# --- Core checks ----------------------------------------------------------------------
def _check_authenticode(fh: BinaryIO, res: Result, pubs: list[dict[str, str]]) -> None:
    fh.seek(0)
    try:
        af = AuthenticodeFile.from_stream(fh)
    except Exception as e:  # noqa: BLE001
        res.verdict, res.reason = "invalid", f"could not parse file structure: {e}"
        return

    try:
        signatures = list(af.embedded_signatures)
    except Exception as e:  # noqa: BLE001
        res.verdict, res.reason = "invalid", f"signature could not be parsed: {e}"
        res.signed = True
        return

    if not signatures:
        res.verdict, res.reason = "unsigned", "no Authenticode signature found"
        return

    res.signed = True
    first = signatures[0]
    res.signer = _signer_from(first)
    res.timestamp = _timestamp_from(first)
    res.digest_algorithm = _digest_name(first)
    res.program_name = getattr(first.signer_info, "program_name", None)

    status, err = af.explain_verify(signature_types="embedded")
    if status.name != "OK":
        res.verdict = "invalid"
        res.reason = f"{status.name.lower()}: {err}"
        return

    res.signature_valid = True
    try:
        used = af.verify(signature_types="embedded")
        sd, _ind, chains = used[0]
        chain = next(iter(chains), [])
        res.chain = [c.subject.dn for c in chain]
        signer = _signer_from(sd)
        if signer:
            res.signer = signer
            res.timestamp = _timestamp_from(sd) or res.timestamp
            res.digest_algorithm = _digest_name(sd) or res.digest_algorithm
    except Exception:
        pass

    if pubs:
        match = match_publisher(res.signer, pubs) if res.signer else None
        res.trusted_publisher_match = match
        if match:
            res.verdict, res.reason = "trusted", f"valid signature from trusted publisher: {match}"
        else:
            who = (res.signer.organization or res.signer.common_name) if res.signer else "unknown"
            res.verdict = "signed_unlisted"
            res.reason = f"valid signature, but publisher '{who}' is not on the trusted list"
    else:
        res.verdict, res.reason = "trusted", "valid signature chained to a trusted root"


def _check_zip(fh: BinaryIO, res: Result, pubs: list[dict[str, str]], depth: int) -> None:
    if depth >= MAX_ARCHIVE_DEPTH:
        res.verdict, res.reason = "unscannable", "archives nested too deeply"
        return
    try:
        zf = zipfile.ZipFile(fh)
    except zipfile.BadZipFile as e:
        res.verdict, res.reason = "unscannable", f"malformed archive: {e}"
        return

    infos = [i for i in zf.infolist() if not i.is_dir()]
    if len(infos) > MAX_ARCHIVE_MEMBERS:
        res.verdict, res.reason = "unscannable", f"archive has more than {MAX_ARCHIVE_MEMBERS} files"
        return
    if any(i.flag_bits & 0x1 for i in infos):
        res.verdict, res.reason = "unscannable", "archive is password-protected; contents cannot be checked"
        return
    total = sum(i.file_size for i in infos)
    if total > MAX_ARCHIVE_TOTAL_BYTES:
        res.verdict, res.reason = "unscannable", "archive expands beyond the size limit"
        return
    for i in infos:
        if i.file_size > MAX_MEMBER_BYTES or (
                i.compress_size and i.file_size / i.compress_size > MAX_COMPRESSION_RATIO
                and i.file_size > 10 * 1024**2):
            res.verdict, res.reason = "unscannable", f"suspicious compression in '{i.filename}'"
            return

    for i in infos:
        # signify needs a real file on disk (it reads by path internally).
        with tempfile.NamedTemporaryFile(prefix="signcheck-", suffix=".bin") as tmp:
            with zf.open(i) as src:
                while True:
                    chunk = src.read(1024 * 1024)
                    if not chunk:
                        break
                    tmp.write(chunk)
            tmp.seek(0)
            kind = detect_type(tmp)
            ext = os.path.splitext(i.filename)[1].lower()
            if kind in ("pe", "msi", "msp", "mst", "zip") or ext in PE_EXTENSIONS | MSI_EXTENSIONS:
                res.members.append(_check_stream(tmp, i.filename, i.filename, pubs, depth + 1))

    executables = [m for m in res.members if m.verdict != "not_executable"]
    if not executables:
        res.verdict, res.reason = "not_executable", f"archive with {len(infos)} files, none executable"
        return
    worst = max(res.members, key=lambda m: SEVERITY[m.verdict])
    counts: dict[str, int] = {}
    for m in res.members:
        counts[m.verdict] = counts.get(m.verdict, 0) + 1
    summary = ", ".join(f"{n} {v}" for v, n in sorted(counts.items()))
    res.verdict = worst.verdict if SEVERITY[worst.verdict] > 0 else "trusted"
    res.reason = f"archive contents: {summary}"


def _check_stream(fh: BinaryIO, display_path: str, name: str,
                  pubs: list[dict[str, str]], depth: int = 0) -> Result:
    sha, size = _sha256_stream(fh)
    ext = os.path.splitext(name)[1].lower()
    kind = detect_type(fh)
    res = Result(path=display_path, name=os.path.basename(name), size=size, sha256=sha,
                 detected_type=kind, extension=ext, extension_mismatch=is_mismatch(ext, kind),
                 verdict="error", reason="")
    try:
        if kind in ("pe", "msi", "msp", "mst"):
            _check_authenticode(fh, res, pubs)
        elif kind == "zip":
            _check_zip(fh, res, pubs, depth)
        else:
            res.verdict, res.reason = "not_executable", "not a Windows executable or installer"
    except Exception as e:  # noqa: BLE001
        res.verdict, res.reason = "error", f"scanner error: {type(e).__name__}: {e}"

    if res.extension_mismatch:
        res.reason = (f"name says '{ext or 'no extension'}' but content is '{kind}'; "
                      + res.reason)
        if SEVERITY[res.verdict] < 20:
            res.verdict = "invalid"
    return res


def check_file(path: str, pubs: list[dict[str, str]] | None = None,
               original_name: str | None = None) -> Result:
    """Check one file on disk. `original_name` is the name the uploader gave it
    (use it when the server stores uploads under random names)."""
    pubs = pubs or []
    name = original_name or path
    st = os.stat(path)
    if st.st_size > MAX_FILE_BYTES:
        return Result(path=path, name=os.path.basename(name), size=st.st_size, sha256="",
                      detected_type="unknown", extension=os.path.splitext(name)[1].lower(),
                      extension_mismatch=False, verdict="unscannable",
                      reason="file is larger than the scan limit")
    with open(path, "rb") as fh:
        return _check_stream(fh, path, name, pubs)


def worst_exit_code(results: list[Result]) -> int:
    return max((SEVERITY[r.verdict] for r in results), default=0)


# --- CLI ----------------------------------------------------------------------------------
def _print_human(r: Result, indent: str = "") -> None:
    mark = {"trusted": "OK  ", "not_executable": "--  ", "signed_unlisted": "WARN",
            "unsigned": "WARN"}.get(r.verdict, "FAIL")
    print(f"{indent}[{mark}] {r.name}  ({r.detected_type}, {r.size:,} bytes)")
    print(f"{indent}       verdict: {r.verdict} — {r.reason}")
    print(f"{indent}       sha256:  {r.sha256}")
    if r.signer:
        print(f"{indent}       signer:  {r.signer.common_name}  |  O={r.signer.organization}")
        print(f"{indent}       issuer:  {r.signer.issuer}")
        print(f"{indent}       thumb:   {r.signer.sha1_thumbprint}")
    if r.timestamp:
        print(f"{indent}       signed:  {r.timestamp}")
    for m in r.members:
        _print_human(m, indent + "    ")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Check Authenticode signatures on EXE/MSI/ZIP files.")
    ap.add_argument("files", nargs="+")
    ap.add_argument("--json", action="store_true", help="print JSON")
    ap.add_argument("--trusted-publishers", metavar="FILE")
    ap.add_argument("--name", help="original file name (only with a single file)")
    ap.add_argument("--version", action="version", version=f"signcheck {TOOL_VERSION}")
    args = ap.parse_args(argv)
    if args.name and len(args.files) != 1:
        ap.error("--name works with a single file")
    try:
        pubs = load_publishers(args.trusted_publishers)
    except Exception as e:  # noqa: BLE001
        print(f"signcheck: cannot read trusted publishers: {e}", file=sys.stderr)
        return 2

    results = []
    for f in args.files:
        if not os.path.isfile(f):
            print(f"signcheck: not a file: {f}", file=sys.stderr)
            return 2
        results.append(check_file(f, pubs, args.name))

    if args.json:
        out = {"tool": "signcheck", "version": TOOL_VERSION,
               "checked_at": datetime.now(timezone.utc).isoformat(),
               "exit_code": worst_exit_code(results),
               "results": [r.to_dict() for r in results]}
        print(json.dumps(out, indent=2))
    else:
        for r in results:
            _print_human(r)
    return worst_exit_code(results)


if __name__ == "__main__":
    sys.exit(main())
