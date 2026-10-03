# Portal QA login: one-time setup and how to run the check

Purpose: a read-only test client account lets the "Portal production check"
workflow sign in to the live portal, open every client page with GET requests
only, and report errors, layout overflow and accessibility violations with
screenshots at phone and desktop width. It never creates, edits or submits
anything. Decision source: Joe, 2026-10-02 (read-only test client login on
production, credentials kept as secrets).

Secrets never go in chat, in git, in an issue, or in a PR description.

## 1. Create the test account

What the code does today (checked against `server/routes.ts` and
`client/src/pages/portal/`):

- Manage Companies (`/portal/admin/companies`, DE admin only) has **Add
  Company** and a company detail view with a user list. It does **not** create
  portal users, and it has no edit or deactivate control.
- Portal users come from self-signup at `/portal/signup` (email, username,
  password) or Zoho sign-in for allow-listed emails. Signup creates a user with
  role `user`, org role `staff` (a non-admin, non-IT-contact client user) and
  its own company named after the username with "(Prospect)" appended.
- The portal server does not read `PORTAL_QA_EMAIL` or `PORTAL_QA_PASSWORD`.
  Setting them on the VPS does not create an account. They are only read by
  `scripts/qa/portal-prod-check.mjs`.

Steps:

1. Pick a mailbox you control for the test user, for example
   `qa+portal@digeratiexperts.com` (a plus-address or alias that lands in a DE
   inbox). The verification email goes there.
2. Open `https://digeratiexperts.com/portal/signup`. Use that email, username
   `de-qa-test` (the company will then show as "de-qa-test (Prospect)"; there
   is no screen to rename it, so that name is the closest to "DE QA (test)"
   available today) and a long random password (at least 8 characters, one
   capital, one number; use a password manager).
3. Click the verification link in the email. Password sign-in is refused for
   non-admin users until the email is verified.
4. Keep the role as it is. Do not make this user a DE admin and do not mark it
   a Company IT Contact. Non-admin means the check sees what a real client
   sees. Expect a few client pages (People, Approvals queue) to answer 403 for
   a plain staff user; the check only fails on page errors and HTTP 5xx.
5. Leave MFA **off**. The check script cannot answer an MFA prompt, and the
   server only asks for MFA when that user has switched it on in Settings; it
   is not forced for any role. Do not enable it on this account.
6. In Manage Companies, find "de-qa-test (Prospect)" and confirm the user is
   listed and Active.

Known gap to check on first use: `/portal/signup` posts no Cloudflare
Turnstile token, while the server requires one when `TURNSTILE_SECRET_KEY` is
set. If signup answers "Bot verification required", create the user another
way (a developer can add one, or sign in once through Zoho SSO if the email is
on `PORTAL_OAUTH_EMAIL_ALLOWLIST`) and tell the dev team so signup can be
fixed.

## 2. Store the values

GitHub (this is what the workflow reads):

Repository > Settings > Secrets and variables > Actions > New repository
secret. Add:

| Secret name | Value |
|---|---|
| `PORTAL_QA_EMAIL` | the test user's email |
| `PORTAL_QA_PASSWORD` | the test user's password |
| `PORTAL_QA_TOKEN` | optional, see section 4 |

Optional, for runs on the VPS itself: put the same names in
`/home/digeratiexperts.com/shared/.env` (the file the systemd unit loads; see
`deploy/vps/README.md`). The portal server ignores them; only the script uses
them, so add them only if you run `node scripts/qa/portal-prod-check.mjs` on
that host. Never add them to `deploy/vps/env.production.example` with real
values.

## 3. Run the check and read the report

1. GitHub > Actions > **Portal production check** > Run workflow. Leave the
   base URL as `https://digeratiexperts.com` (it must stay on
   digeratiexperts.com). The run takes a few minutes; the limit is 20.
2. With no secrets set the run finishes green and prints "Add PORTAL_QA_EMAIL
   and PORTAL_QA_PASSWORD as repository secrets". That means skipped, not
   passed.
3. Open the run. The summary lists each issue: width, route, kind and detail.
   Kinds: `pageerror` (script error in the page), `http 5xx`, `http 4xx`,
   `overflow` (horizontal scroll) and `axe <rule>` (accessibility). The job
   fails only on `pageerror` and `http 5xx`; the rest are findings.
4. Download the **portal-prod-check** artifact (kept 14 days, uploaded even on
   failure): `report.json` plus a screenshot per page at 390 and 1440 wide. If
   sign-in failed, `login-failed.png` shows where it stopped.

## 4. Turnstile and the PORTAL_QA_TOKEN fallback

Production keeps Cloudflare Turnstile on the login form and the script does
not bypass it. A GitHub runner's headless browser may be challenged and fail
with "Sign-in did not reach the dashboard". Then use the cookie fallback:

1. In a normal browser, sign in at `https://digeratiexperts.com/portal/login`
   as the test user.
2. Open developer tools > Application (Chrome/Edge) or Storage (Firefox) >
   Cookies > `https://digeratiexperts.com`, and copy the **Value** of the
   cookie named `portalAuth`. It is HttpOnly, so it does not show in the
   console; read it from this panel.
3. Save it as the `PORTAL_QA_TOKEN` repository secret (replace the old value).
4. Sign out of that browser session only after the run is done (signing out
   clears the cookie in that browser; the token itself stays valid until it
   expires).

The token is a signed JWT with a **24 hour** lifetime
(`expiresIn: "24h"` in `server/routes.ts`, cookie max age also 24 hours). It
cannot be refreshed, so repeat steps 1 to 3 before each run that is more than
a day after the last sign-in. A run with an expired token fails at the first
page with 401s. When both are set, the token is used instead of the password.

## 5. Retire the account

When the QA login is no longer needed:

1. Delete the three secrets in Settings > Secrets and variables > Actions.
   With them gone the workflow skips itself.
2. Remove the values from the VPS `shared/.env` if you added them there.
3. Neutralise the account: sign in as it once and change the password to a
   random value nobody keeps (Settings), or use Forgot password and discard
   the result. There is no deactivate control in the portal today. To fully
   disable it, a developer sets `is_active` to false on that row of
   `portal_users` (the auth middleware rejects inactive users), or deletes the
   user and the "de-qa-test (Prospect)" company row.
4. Optionally delete old workflow artifacts; they expire after 14 days
   anyway.
