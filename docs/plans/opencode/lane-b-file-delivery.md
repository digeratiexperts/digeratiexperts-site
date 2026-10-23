# Lane B — DE-to-client file delivery (Wave 2)

Start only after Lane A is merged. Read `docs/plans/opencode/LANE-RULES.md`, `docs/lanes/registry.md`, the portal plan's **Phase 3**, and `tools/signcheck/README.md`.

**You own:** file sharing, uploads, storage, quarantine, the malware-scan and signcheck integration, the client "Files" page, and the file audit log.

## Build
**DE staff side:**
- Pick a client, then "Share a file".
- Allowed types: PDF, DOCX, XLSX, PPTX, TXT, CSV, images, EXE, MSI, ZIP.
- Choose the audience: whole company, client admins only, or specific users.
- Add an optional note.
- Replace a file (keeps version history) or remove it.

**Client side:**
- A "Files" item appears only when something is shared with that user.
- Each file shows "Shared by Digerati Experts", the uploader, the date and the SHA-256. EXE/MSI files also show the signer.

**Upload pipeline (every file):**
1. Store under a random name, outside the web root. Check how storage works today first (the repo already uses `@google-cloud/storage`).
2. Malware scan. Use ClamAV via clamd unless Phase 0 finds an existing scanner; document the server install in your PR.
3. Run `checkSignature()` from `tools/signcheck/signcheck.mjs`, passing `originalName`.
4. Act on `decide()`:
   - `publish`: visible to the chosen audience
   - `warn`: DE staff must confirm after seeing the signer and the reason
   - `quarantine`: never visible to clients
5. Any scanner error means quarantine (fail closed).

**Downloads:** login required, short-lived signed URLs, no public links.

**Audit log:** upload, replace, delete, download and quarantine, each with who, when, which client, which file and the hash.

## Server setup
These steps go in the PR description, for Joe to run. Never run them yourself.
- `sudo tools/signcheck/install.sh`
- Add the `SIGNCHECK_*` env names to `docs/SECRETS-REQUIRED.md` (they're paths, not secrets).
- The ClamAV install steps.

## Tests
- Each allowed type.
- EICAR test file → quarantine.
- EXE renamed to `.pdf` → quarantine.
- Password-protected ZIP → quarantine.
- Cross-client download attempt fails, by ID and by URL.

Add your nav item through the registry. Open one PR.
