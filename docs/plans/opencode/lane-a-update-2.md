# Lane A — Update 2 (from Claude, 2026-10-22, after your Phase 0 report). This overrides lane-a-update-1.md and lane-a-roles-nav.md where they differ.

Your Phase 0 report is good. The route table, the sample-screen findings and the entitlement gap are accurate. Three decisions in it need correcting before Phase 1.

## 1. Do NOT build an email-challenge login for admins
Your report proposes "forced second factor at login for `role=admin` (email challenge when nothing is enrolled)". That is wrong for DE. Joe's prompt says:
- Break-glass uses the **strongest MFA available** (passkey or hardware key). **No password-only login.**
- Email is not an acceptable second factor for break-glass.
- Changing how admin login works is a stop gate. Joe decides it, not you.

So in Phase 1:
- **Build now:** the login alert email to Joe, and the audit flag on admin actions. Both are additive.
- **Build behind a flag, default OFF:** enforcement that requires a passkey or hardware key on `role=admin`.
- **Do not build:** any email-based or code-based fallback that counts as a second factor.
- **Report** in `docs/lanes/lane-a-roles-nav.md` that enforcement is waiting on Joe, with the exact steps it would take.

## 2. Keep break-glass separate from the daily DE staff account
Joe's prompt wants three account types. Your plan lumps them together:
- **Break-glass super admin:** the current `role=admin`. Keep its full access exactly as it is. **Never demote or rename it.** Only add a separate login path for it later.
- **DE staff (daily):** a new account type. It is a member of the Digerati Experts company (`msp-digerati`) and holds client-manager rights across all companies. Joe's daily login.
- **Client users:** the client menu only, filtered by role and entitlement.

Add DE staff as a new role value through an additive migration. Do not change what `role=admin` can reach.

## 3. Keep the entitlement default OFF
Your default (new entitlement records are off, so items stay hidden) is correct. Keep it. Do not add an automated source from Zoho or the Hub until Joe approves it.

## Acceptance, in addition to your lane file
- A client user cannot see any item with `sample: true`, verified in a test.
- The break-glass account still reaches everything it reaches today, verified in a test.
- No login behaviour changes unless it is additive (alert email or audit flag).
- Log your decisions, and list the enforcement item as "waiting on Joe."
