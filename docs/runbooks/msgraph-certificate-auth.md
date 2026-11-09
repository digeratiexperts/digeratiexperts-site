# Microsoft Graph: move from the client secret to a certificate

**Who:** Joe (Entra ID admin and VPS access). **When:** any time; nothing changes until the certificate settings are on the server.
**Why:** the website's Graph app (License Patch Bay → Microsoft 365 licence pushes, `server/integrations/msGraph.ts`) signs in with a client secret, while the MS Admin worker is certificate-only (2026-11-04 cross-repo review, issue #974). A certificate's private key never leaves the server, and nothing reusable crosses the wire.

Env var **names** only below. Values live in `/home/digeratiexperts.com/shared/.env` and in files next to it, never in this repository, a PR, an issue or chat.

## How the website chooses

| Settings present for an app | `authMode` in `/api/health` → `services.msGraph` | What happens |
|---|---|---|
| Certificate settings, all usable | `certificate` | Token request is signed with the certificate (client assertion, PS256, `x5t#S256`). The secret is ignored even if still set. |
| Certificate settings, any unusable (file missing, key and certificate don't match, expired, not RSA) | `invalid` with `error` naming the setting | **Fails closed.** Licence pushes for that app stop with that error. The secret is **not** used instead. |
| No certificate settings, a client secret | `secret` with a `warning` | Exactly the old behaviour. |
| Neither | `not_configured` | Licence pushes are off. |

`services.msGraph` has two entries: `commercial` (commercial and GCC tenants) and `gccHigh` (the Azure Government app). It is in the staff view of `/api/health` only (sign in as DE staff); the anonymous view does not show it. Checking health never calls Microsoft.

The settings, per app:

| | Commercial / GCC app | GCC High app |
|---|---|---|
| App id (unchanged) | `MS_GRAPH_CLIENT_ID` | `MS_GRAPH_GOV_CLIENT_ID` |
| Private key: a file path **or** the PEM itself | `MS_GRAPH_CERT_PRIVATE_KEY_PATH` or `MS_GRAPH_CERT_PRIVATE_KEY` | `MS_GRAPH_GOV_CERT_PRIVATE_KEY_PATH` or `MS_GRAPH_GOV_CERT_PRIVATE_KEY` |
| Certificate (public part): a file path **or** the PEM itself | `MS_GRAPH_CERT_PATH` or `MS_GRAPH_CERT` | `MS_GRAPH_GOV_CERT_PATH` or `MS_GRAPH_GOV_CERT` |
| Client secret (remove at the end) | `MS_GRAPH_CLIENT_SECRET` | `MS_GRAPH_GOV_CLIENT_SECRET` |

Use the `_PATH` form. A PEM pasted inline into `.env` must be on one line with `\n` where the line breaks were.

## Steps (commercial app; repeat with the `GOV` names for the GCC High app if it is in use)

1. **Make the certificate on the VPS**, so the private key never leaves it. Signed in on the VPS:

   ```bash
   cd /home/digeratiexperts.com/shared
   sudo mkdir -p msgraph && cd msgraph
   sudo openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 730 \
     -keyout msgraph.key -out msgraph.pem -subj "/CN=digeratiexperts-site Graph"
   sudo openssl x509 -in msgraph.pem -outform der -out msgraph.cer
   sudo chown diger7051:diger7051 msgraph.key msgraph.pem msgraph.cer
   sudo chmod 600 msgraph.key && sudo chmod 644 msgraph.pem msgraph.cer
   ```

   If the review settles on one certificate shared with the MS Admin worker instead, use that certificate and key here and skip `openssl req`. A separate certificate per system is the default: either one can then be revoked alone.

2. **Upload the public part to Entra ID.** Entra admin center → App registrations → the website's Graph app (its Application (client) ID is the value of `MS_GRAPH_CLIENT_ID`) → Certificates & secrets → Certificates → Upload certificate → choose `msgraph.cer` (download it from the VPS; it holds no secret). Add a description such as "website VPS, 2026-11". Note the expiry date for renewal.

3. **Point the website at it.** Add to `/home/digeratiexperts.com/shared/.env`:

   ```
   MS_GRAPH_CERT_PATH=/home/digeratiexperts.com/shared/msgraph/msgraph.pem
   MS_GRAPH_CERT_PRIVATE_KEY_PATH=/home/digeratiexperts.com/shared/msgraph/msgraph.key
   ```

   Keep `MS_GRAPH_CLIENT_SECRET` for now. Then restore the file's owner and mode: `sudo chown diger7051:diger7051 .env && sudo chmod 600 .env`.

4. **Restart:** `sudo systemctl restart digeratiexperts-site`.

5. **Check.** Signed in as DE staff, open `https://digeratiexperts.com/api/health` and confirm `services.msGraph.commercial.authMode` is `"certificate"` with no `warning`. Then send one real Microsoft 365 licence push from License Patch Bay and confirm it works (health only reads the settings; the push is what proves Microsoft accepts the certificate).
   - `invalid`: the `error` names the setting to fix. Fix it and restart. Licence pushes stay off until then; to go back to the secret meanwhile, remove the two `MS_GRAPH_CERT_*` lines and restart.
   - Sign-in error from Microsoft (`AADSTS700027` and similar): the uploaded certificate does not match the one on the server, or it was uploaded to a different app.

6. **Remove the secret** once step 5 passes:
   1. Entra → the same app → Certificates & secrets → Client secrets → delete the website's secret.
   2. Delete the `MS_GRAPH_CLIENT_SECRET` line from `.env`, restore owner and mode as in step 3, restart, and check step 5 again.

## Renewal

The certificate above lasts two years. About a month before it expires, repeat steps 1 to 5 with new file names, upload the new `.cer` beside the old one, switch the two paths, restart and check, then delete the old certificate in Entra. An expired certificate reads `invalid` ("The Graph certificate has expired") and stops licence pushes.

## Still to do in other files

The new env var names belong in `docs/SECRETS-REQUIRED.md` and `deploy/vps/env.production.example`. Both files are held by open PRs #955, #968 and #969, so they are added after those land.
