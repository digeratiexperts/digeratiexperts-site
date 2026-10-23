# Lane E — Secure access, Business phone, Desktop agent page (Wave 2)

Start only after Lane A is merged. Read `docs/plans/opencode/LANE-RULES.md`, `docs/lanes/registry.md`, the portal plan's **Phase 4** (items 5–6), `VENDOR_SETUP_STATUS.md`, `VENDOR_INTEGRATION_GUIDE.md`, and `docs/SECRETS-REQUIRED.md`.

**You own:** Secure access, Business phone, and the Desktop agent page.

## Build. One PR per feature.
1. **Secure access** (was "VPN Access"; DE service name: Cloud Edge / SASE)
   - Shows the user's access status, the agent download, and setup steps, from the SASE platform's API.
   - Visible only to companies entitled to Cloud Edge / SASE.
2. **Business phone** (was "Cytracom Phone")
   - Shows the user's extension, voicemail access, and app download links, from the voice platform's API.
   - Visible only to entitled companies.
3. **Desktop agent page**
   - Reads `manifest.json` from the latest **published** DE Windows Agent release. Its fields are version, file, sha256, size_bytes, signer and built_at.
   - Shows the version, a download button, the SHA-256, and "Signed by Digerati Experts".
   - If no release is published yet, show an honest "coming soon" empty state. Never show a fake version.

## Rules for the vendor integrations
- **No vendor names anywhere in the client UI.**
- Credentials come only from server env vars. Check `VENDOR_SETUP_STATUS.md` and `docs/SECRETS-REQUIRED.md` for what already exists.
- **If credentials or API access are missing, STOP that feature.** List the exact env var names and API permissions needed, and continue with the next feature. **Never build on mock data.**

## Done means
- Real data only, with honest empty, loading and error states.
- Server-side entitlement and tenant checks, with tests.
- Set `featureReady: true` in your registry file only when everything passes.
