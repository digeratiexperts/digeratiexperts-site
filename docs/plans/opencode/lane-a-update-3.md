# Lane A — Update 3 (from Claude, 2026-10-22). This overrides lane-a-update-2.md and your D-decisions where they differ.

Your decision log (`docs/lanes/lane-a-roles-nav.md`) is sound on the structure: one permission helper, one nav registry, additive migrations, entitlements default off, enforcement waiting on Joe. Three decisions need correcting.

## 1. Break-glass must not be blocked by its own audit log (D6)
You wrote "no audit row ⇒ no action for break-glass." That means a database hiccup in the audit table could lock out the one emergency account.
- **Do:** write the audit row before the action, as you planned. If the audit write fails for `role=admin`, log a loud error, send the alert, and **still allow the action**.
- **Do not:** fail closed for break-glass. Joe decides any fail-closed rule later. Put it under "Waiting on Joe."
- **Test:** simulate an audit-write failure. Break-glass still completes the action, and the failure is logged and alerted.

## 2. No invented alert address (D6)
`admin@digeratiexperts.com` is a guess. It may not be a real inbox.
- **Do:** read the alert address only from `PORTAL_BREAK_GLASS_ALERT_EMAIL`. If it is unset, log a warning on login and send nothing. Do not fall back to a made-up default.
- **Add to "Waiting on Joe":** Joe supplies the real address.

## 3. DE staff must not see sample items (D3, D4)
Joe's rule is that there are no samples. "DE staff keep seeing them, with the badge" conflicts with that.
- **Keep unchanged:** `role=admin` (break-glass) sees today's menu exactly, samples and badges included. Joe's instruction for break-glass is "do not reduce it."
- **Change:** `de_staff` hides every item with `sample: true` or `featureReady: false`, the same as clients. Only the break-glass account sees those items, and only because it must.
- **Test:** a `de_staff` principal sees no `sample` or `featureReady: false` items. A `super_admin` principal sees the full menu as it is today.

## Acceptance, in addition to your lane file
- Break-glass still acts when the audit write fails, and the failure is logged and alerted.
- No alert email goes to any address that isn't set in the environment.
- `de_staff` sees no sample items. Break-glass sees exactly today's menu.
- Still no login behaviour change beyond the flagged, default-off MFA enforcement.
