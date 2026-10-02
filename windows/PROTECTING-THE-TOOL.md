# Protecting DE Tech Tool from being taken

## The honest starting point

DE Tech Tool is PowerShell. Anyone who can run it can open the files and read them. A technician who knows
PowerShell can delete any check in the code, and no obfuscation or lock changes that.

So the protection does not depend on hiding the code. Instead:

- The code on its own is the least valuable part.
- Everything valuable (the right to run, client data, keys, the Hub) is controlled by DE, per technician,
  for short periods.
- Every copy can be traced to the person it was given to.

## Threats and answers

| What a technician might try | What stops it, or makes it pointless |
|---|---|
| Copy the zip and use it at another company, or after leaving DE | Real work needs a licence the Hub signs for that technician, for one device, for up to 12 hours. Leaving DE means the Hub stops issuing licences, and a copied tool can only do the unlicensed minimum. |
| Copy a licence from one laptop to another | A licence names the device it was issued for (`dev` = `<maker>:<SERIAL>`). On any other device it is rejected. |
| Set the clock back to keep an expired licence | The tool records the latest time it has ever seen, in the data folder that only SYSTEM and Administrators can write. A clock earlier than that invalidates the licence. |
| Forge a licence | Licences are RS256-signed by the Hub's private key, and the key never leaves the Hub. The tool only carries public keys (`console/trust/license-keys.json`), which can verify a licence but cannot sign one. |
| Edit the scripts to skip the licence check | Possible, and this is the limit. The edited copy still has no client profiles, no vendor tenant IDs, no secrets and no Hub access, because those come from DE per licence. It also breaks `integrity.json`, so the tool reports itself as tampered in every report and every Hub record. |
| Take client data (profiles, orders, keys) | None of it ships in the package. Profiles and orders come from the Hub for the clients in the licence, and secrets are typed or come from the vault at run time. The only profile in the zip is the example. |
| Leak the zip publicly | Every build is watermarked with a build ID and the person it was issued to (`console/BUILD.json`). The ID appears in the window title, every evidence bundle and every Hub record, so a leaked copy names its source the first time it runs anywhere with a network. |
| Keep using an old copy offline | Licences expire. Dropship kits carry an order licence bound to the ordered serial, valid until the order's expiry date and never for another device. |
| Keep using a licence DE has revoked (a lost laptop, someone leaving) | DE revokes it on the Hub. The tool downloads the Hub's revocation list at launch and after activation, and every release built with `-HubUrl` ships the list current at build time (`console/trust/revoked.json`). A licence in either list is refused, also offline once the list has been seen. |
| Use a licence in a different copy of the tool | A licence approved with the build pin (`bid`) works only in the build it was issued for. In any other copy it is refused as `wrong-build`. |
| Use the Hub-side tools (Microsoft Admin jobs) | Hub jobs are HMAC-signed per job, tied to a tenant, allowlisted, replay-proof, and need an approver to change anything (DE Microsoft Admin v0.2). |

## Layers

1. **A licence from the Hub** (`DE.License`; the API contract is `docs/techtool-license-openapi.yaml` in
   the Intelligence-Hub repository).
   - The token is a JWT-style `header.payload.signature` signed with RS256.
   - Its claims are:
     - `sub`: the technician
     - `dev`: the device key
     - `clients`: the clients the technician may work on
     - `features`: `apply`, `toolbox`, `rescue`, `msadmin`
     - `iat`, `nbf`, `exp`: at most 12 hours for a technician, the order's window for dropship
     - `jti`
     - `bid`: optional, the build the licence is pinned to; in any other build the licence is refused
       (`wrong-build`)
   - The tool gets a licence in one of two ways:
     - **Activate on this device:** it shows a code, the technician approves it in the Hub, and the Hub
       returns a licence for this device.
     - **Paste:** the technician pastes a licence copied from the Hub.
   - The tool stores only a licence that verifies. The token goes in its own file,
     `state/license.jws`, in the data folder that only SYSTEM and Administrators can write. It is
     written by write-then-replace and checked again every time it is read. It never goes into the
     state file, logs, evidence, bundles, the Hub record or a client profile. The state file keeps only
     what the licence says (`jti`, `sub`, `dev`, `exp`, features, clients and its current state).
     Removing the licence deletes the file.
   - A revoked licence ID is refused when it is in either list:
     - `console/trust/revoked.json`, shipped with the build and covered by `integrity.json`. A release
       build made with `-HubUrl` fills it from the Hub. It never changes at run time.
     - the list downloaded from the Hub (`GET /api/techtool/license/revocations`, https only) into the
       data folder that only SYSTEM and Administrators can write (`state/license-revocations.json`).
       The tool downloads it once per run at launch when the Hub URL is set in Settings, and after an
       activation (`Update-DELicenseRevocations`). Its shape and size are checked before it is saved,
       and an answer older than the saved list never replaces it. Offline, or when the Hub's answer is
       refused, the last saved list stays and the run carries on; a download never makes a licence
       valid and never stops work.
2. **Enforcement where it matters.** Applying a change, rolling one back, running a Toolbox script,
   loading a client profile, and headless `-Apply` all check the licence and the feature, and the client
   when there is one. Read-only discovery on the device itself is allowed, so a technician can always see
   what's wrong.
3. **Policy** (`console/trust/license-policy.json`, covered by `integrity.json`).
   - `warn` (now): an unlicensed run works but is marked UNLICENSED in the window, the evidence and the Hub
     record.
   - `required`: the moment the Hub issues licences, unlicensed runs stop at the actions above. It is
     turned on in the release build, so no technician edits it by hand.
4. **Watermarked builds** (`packaging/New-DEReleasePackage.ps1`). Each zip carries its build ID, when it
   was built and who it was issued to, and the zip's sha256 is recorded.
5. **Integrity and signing.** These already exist: `integrity.json` plus Authenticode. An edited copy
   reports itself as tampered in every report.
6. **Server-held value.** The Hub keeps client profiles, orders, secrets, catalog updates and the fleet
   record. The tool is a client of those, not a container for them.
7. **An audit trail.** Every run records its build ID, technician, licence ID and device in evidence and in
   the Hub device record. The Hub sees which technician used which build on which client device, and
   notices a build that runs where no licence was issued.
8. **People and paper.** Distribute builds only through RMM or Intune, or to named technicians. Get an IP
   and confidentiality clause in the technician agreement, and remove access the same day someone leaves.
   A leaked watermark only helps if there's an agreement behind it.

## The Hub side

The Hub licence service merged in Intelligence-Hub PR #310 (`a4e26bc8`, 2026-10-02). Its operations
note is `docs/TECHTOOL-LICENSING.md` in that repository.

What the Hub serves:

- `POST /api/techtool/license/device-code` and `POST /api/techtool/license/token`: activation. The
  technician approves in the Hub (Tech Center > DE Tech Tool licences), which can pin the licence to
  the build that asked for it (`bid`).
- `GET /api/techtool/license/jwks`: the public keys.
- `GET /api/techtool/license/revocations`: the revoked licence IDs. The tool downloads this list
  (above).
- Revoking with a reason, from the Hub page.
- The licence and build fields in the device record (`session.licenseId`, `licenseState`, `buildId`,
  `issuedTo`).

Checked on 2026-10-02 against `https://techsales.digerati-experts.com`:

- `GET /api/techtool/license/revocations` answers 200 with `{"jti":[],"updatedAt":null}`, so it is
  live.
- `GET /api/techtool/license/jwks` answers 503 `licensing_not_configured`. No licence can be issued yet.

What DE still configures on the Hub (a production change, DE only; steps in `docs/TECHTOOL-LICENSING.md`):

1. Generate the RS256 signing key offline and set `TECHTOOL_LICENSE_SIGNING_KEY` in the Hub's env file,
   then restart. The JWKS check above then returns the public key.
2. Confirm the database migration `2026-10-01-techtool-licenses.sql` is applied. The revocation list
   answering 200 suggests it is.
3. Build a release with `New-DEReleasePackage.ps1 -HubUrl https://techsales.digerati-experts.com`, so
   `license-keys.json` and `revoked.json` come from the Hub. Add `-Enforce` once technicians can
   activate, to switch the policy to `required`.
4. Set the Hub URL in each copy's Settings so the tool downloads the revocation list at launch.
