# signcheck — DE code-signature scanner

Checks whether Windows executables and installers are code-signed, before DE shares them with a client through the portal.

**Checks:** EXE, DLL, SYS, MSI, MSP, and every executable inside ZIP files (up to 3 levels deep).
**Runs on:** the Linux portal server. No Windows needed.
**Trust source:** Microsoft's own trusted root list (`mscerts`), the same roots Windows trusts for code signing.

## What it reports
| Verdict | Meaning | Portal action |
|---|---|---|
| `trusted` | Valid signature from a trusted root (and on the publisher list, if used) | Publish |
| `not_executable` | Not a program or installer (PDF, DOCX, plain ZIP of documents) | Publish |
| `unsigned` | Program or installer with no signature | Warn; DE staff must confirm |
| `signed_unlisted` | Valid signature, but publisher isn't on DE's trusted list | Warn; DE staff must confirm |
| `invalid` | Tampered or broken signature, **or a file disguised with the wrong extension** | Quarantine |
| `unscannable` | Password-protected or suspicious archive, or over the size limit | Quarantine |
| `error` | The scanner failed | Quarantine (fail closed) |

Each result also includes the SHA-256 hash, the signer's name, organization, issuer and thumbprint, the timestamp, and the certificate chain.

**Not covered:** certificate revocation (CRL/OCSP) and malware detection. This tool answers "who signed it, and is the signature intact?" The portal's malware scanner still runs on every upload.

## Install on the portal server
```bash
sudo ./install.sh              # installs to /opt/de-signcheck
sudo ./install.sh --update     # monthly: refresh Microsoft's trusted roots
```
Add the three `SIGNCHECK_*` lines it prints to the portal's `.env`.

## Use it
Command line:
```bash
/opt/de-signcheck/venv/bin/python /opt/de-signcheck/signcheck.py setup.exe
/opt/de-signcheck/venv/bin/python /opt/de-signcheck/signcheck.py --json --name "Setup.msi" /uploads/7f3a9c
```
Exit codes: `0` OK, `10` warning, `20` block, `2` error.

From the portal (Node):
```js
import { checkSignature, decide } from "/opt/de-signcheck/signcheck.mjs";
const report = await checkSignature(storedPath, { originalName: upload.originalname });
const action = decide(report); // "publish" | "warn" | "quarantine"
```
Always pass `originalName` when uploads are stored under random names; that's how disguised files are caught.

## Trusted publishers (optional)
Copy `publishers.example.json` to `/opt/de-signcheck/publishers.json` and fill in DE's values. Files from publishers not on the list get `signed_unlisted` instead of `trusted`.

For DE's own agent, match on the **identity EKU** and organization from the Artifact Signing certificate profile. Artifact Signing certificates rotate every few days, so thumbprints change with every build and can't be pinned.

## Tests
```bash
python3 -m pip install pytest -r requirements.txt
python3 -m pytest -q tests/
```
17 tests: Microsoft-signed, unsigned, tampered, disguised (EXE renamed to PDF), ZIP contents, nested ZIP, password-protected ZIP, and publisher matching. MSI parsing uses the same engine but has no test fixture yet; the agent release pipeline runs signcheck on the signed MSI it builds, which covers it.

## Third-party code
- `vendor/oscrypto/`: unmodified copy of oscrypto from GitHub master (MIT, see `vendor/oscrypto-LICENSE`). The PyPI release can't detect OpenSSL 3.0.10+, which Ubuntu 22.04/24.04 ship.
- `tests/fixtures/ms_signed.exe`: from the debugpy package (MIT), signed by Microsoft.
- `tests/fixtures/unsigned.exe`: from pywin32 (PSF license).
