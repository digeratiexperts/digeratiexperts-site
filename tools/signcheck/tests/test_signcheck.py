"""Tests for signcheck. Run: python3 -m pytest -q tests/"""

import io
import json
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import signcheck  # noqa: E402

FX = ROOT / "tests" / "fixtures"
SIGNED = FX / "ms_signed.exe"      # Microsoft-signed PE (from debugpy, MIT)
UNSIGNED = FX / "unsigned.exe"     # unsigned PE (from pywin32, PSF)


def test_signed_microsoft_binary_is_trusted():
    r = signcheck.check_file(str(SIGNED))
    assert r.detected_type == "pe"
    assert r.signed and r.signature_valid
    assert r.verdict == "trusted"
    assert r.signer.organization == "Microsoft Corporation"
    assert r.timestamp is not None
    assert r.chain and "Root" in r.chain[0]
    assert len(r.sha256) == 64


def test_unsigned_binary():
    r = signcheck.check_file(str(UNSIGNED))
    assert r.verdict == "unsigned"
    assert not r.signed


def test_tampered_signed_binary_is_invalid(tmp_path):
    bad = tmp_path / "tampered.exe"
    data = bytearray(SIGNED.read_bytes())
    data[0x2000] ^= 0xFF  # flip a byte inside the signed code
    bad.write_bytes(bytes(data))
    r = signcheck.check_file(str(bad))
    assert r.signed
    assert not r.signature_valid
    assert r.verdict == "invalid"
    assert "digest" in r.reason.lower()


def test_exe_renamed_to_pdf_is_blocked(tmp_path):
    fake = tmp_path / "invoice.pdf"
    shutil.copy(SIGNED, fake)
    r = signcheck.check_file(str(fake))
    assert r.extension_mismatch
    assert r.verdict == "invalid"


def test_original_name_is_used_for_mismatch(tmp_path):
    stored = tmp_path / "upload-7f3a"  # server-side random name
    shutil.copy(UNSIGNED, stored)
    r = signcheck.check_file(str(stored), original_name="report.docx")
    assert r.extension_mismatch and r.verdict == "invalid"


def test_text_file_named_exe_is_blocked(tmp_path):
    fake = tmp_path / "setup.exe"
    fake.write_text("not really an executable")
    r = signcheck.check_file(str(fake))
    assert r.extension_mismatch and r.verdict == "invalid"


def test_plain_document_is_not_executable(tmp_path):
    doc = tmp_path / "notes.pdf"
    doc.write_bytes(b"%PDF-1.7\n%fake pdf body\n")
    r = signcheck.check_file(str(doc))
    assert r.verdict == "not_executable"
    assert not r.extension_mismatch


def _zip(path, members, encrypted_flag=False):
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in members.items():
            zf.writestr(name, data)
    if encrypted_flag:
        # Python's writer strips the encryption bit, so set it in the raw headers
        # the way a password-protected archive would have it.
        raw = bytearray(Path(path).read_bytes())
        for sig, off in ((b"PK\x03\x04", 6), (b"PK\x01\x02", 8)):
            i = raw.find(sig)
            while i != -1:
                raw[i + off] |= 0x1
                i = raw.find(sig, i + 4)
        Path(path).write_bytes(bytes(raw))


def test_zip_reports_each_executable_and_worst_verdict(tmp_path):
    z = tmp_path / "tools.zip"
    _zip(z, {"bin/good.exe": SIGNED.read_bytes(),
             "bin/plain.exe": UNSIGNED.read_bytes(),
             "readme.txt": b"hello"})
    r = signcheck.check_file(str(z))
    assert r.detected_type == "zip"
    assert {m.name: m.verdict for m in r.members} == {"good.exe": "trusted", "plain.exe": "unsigned"}
    assert r.verdict == "unsigned"


def test_zip_of_signed_only_is_trusted(tmp_path):
    z = tmp_path / "ok.zip"
    _zip(z, {"good.exe": SIGNED.read_bytes(), "a.txt": b"x"})
    assert signcheck.check_file(str(z)).verdict == "trusted"


def test_zip_without_executables(tmp_path):
    z = tmp_path / "docs.zip"
    _zip(z, {"a.txt": b"x", "b.csv": b"1,2"})
    assert signcheck.check_file(str(z)).verdict == "not_executable"


def test_zip_hiding_renamed_exe_is_blocked(tmp_path):
    z = tmp_path / "photos.zip"
    _zip(z, {"photo.jpg": UNSIGNED.read_bytes()})
    r = signcheck.check_file(str(z))
    assert r.members[0].extension_mismatch
    assert r.verdict == "invalid"


def test_nested_zip_is_scanned(tmp_path):
    inner = io.BytesIO()
    with zipfile.ZipFile(inner, "w") as zf:
        zf.writestr("deep/plain.exe", UNSIGNED.read_bytes())
    z = tmp_path / "outer.zip"
    _zip(z, {"inner.zip": inner.getvalue()})
    r = signcheck.check_file(str(z))
    assert r.members[0].members[0].verdict == "unsigned"
    assert r.verdict == "unsigned"


def test_password_protected_zip_is_unscannable(tmp_path):
    z = tmp_path / "locked.zip"
    _zip(z, {"setup.exe": b"MZ" + b"\0" * 100}, encrypted_flag=True)
    assert signcheck.check_file(str(z)).verdict == "unscannable"


def test_trusted_publisher_list(tmp_path):
    pubs_ok = [{"label": "Microsoft", "organization": "Microsoft Corporation"}]
    r = signcheck.check_file(str(SIGNED), pubs_ok)
    assert r.verdict == "trusted" and r.trusted_publisher_match == "Microsoft"

    pubs_other = [{"label": "DE", "organization": "Digerati Experts LLC"}]
    r = signcheck.check_file(str(SIGNED), pubs_other)
    assert r.verdict == "signed_unlisted"


def test_publisher_match_by_thumbprint():
    thumb = signcheck.check_file(str(SIGNED)).signer.sha1_thumbprint
    r = signcheck.check_file(str(SIGNED), [{"label": "pinned", "sha1": thumb.upper()}])
    assert r.verdict == "trusted"


def test_publisher_entry_must_have_a_match_field(tmp_path):
    p = tmp_path / "pubs.json"
    p.write_text(json.dumps({"publishers": [{"label": "empty"}]}))
    with pytest.raises(ValueError):
        signcheck.load_publishers(str(p))


def test_cli_json_and_exit_codes(tmp_path):
    out = subprocess.run([sys.executable, str(ROOT / "signcheck.py"), "--json", str(SIGNED)],
                         capture_output=True, text=True)
    assert out.returncode == 0
    data = json.loads(out.stdout)
    assert data["results"][0]["verdict"] == "trusted"

    out = subprocess.run([sys.executable, str(ROOT / "signcheck.py"), str(UNSIGNED)],
                         capture_output=True, text=True)
    assert out.returncode == 10

    bad = tmp_path / "x.pdf"
    shutil.copy(UNSIGNED, bad)
    out = subprocess.run([sys.executable, str(ROOT / "signcheck.py"), "--json", str(bad)],
                         capture_output=True, text=True)
    assert out.returncode == 20
