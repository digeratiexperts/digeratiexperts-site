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
| Use the Hub-side tools (Microsoft Admin jobs) | Hub jobs are HMAC-signed per job, tied to a tenant, allowlisted, replay-proof, and need an approver to change anything (DE Microsoft Admin v0.2). |

## Layers

1. **A licence from the Hub** (`DE.License`, `contracts/license.schema.json`).
   - The token is a JWT-style `header.payload.signature` signed with RS256.
   - Its claims are:
     - `sub`: the technician
     - `dev`: the device key
     - `clients`: the clients the technician may work on
     - `features`: `apply`, `toolbox`, `rescue`, `msadmin`
     - `iat`, `nbf`, `exp`: at most 12 hours for a technician, the order's window for dropship
     - `jti`
     - `bid`: optional, a build the licence is pinned to
   - The tool gets a licence in one of two ways:
     - **Activate on this device:** it shows a code, the technician approves it in the Hub, and the Hub
       returns a licence for this device.
     - **Paste:** the technician pastes a licence copied from the Hub.
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

## What is still needed on the Hub

This build has the tool side of licensing and the policy in `warn`. The Hub needs:

- `POST /api/techtool/license/device-code`
- `POST /api/techtool/license/token`, which issues an RS256 licence after the technician approves it in
  the Hub
- a JWKS of the public keys
- a revocation list
- licence and build fields in the device record

That is a Hub change, so merging it needs DE approval. Once it is live, the release build switches the
policy to `required`.
