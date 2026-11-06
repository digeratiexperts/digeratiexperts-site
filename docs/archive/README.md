# Archived reports

Point-in-time reports and early guides that used to sit at the repository root. They were moved here
on 2026-11-04 (website hygiene slice) with `git mv`, so `git log --follow docs/archive/<file>` still
shows their full history.

**These are Tier 3 evidence, not authority** (`design/DESIGN-AUTHORITY.md`). Several describe
things that are no longer true: Stripe checkout (retired; Zoho Payments is live), PM2 and
`/root/Replit-Site` (production is systemd under `/home/digeratiexperts.com/current`, see
`deploy/vps/README.md`), and Zoho setup steps that predate the single Zoho Connect grant. For Zoho,
follow `docs/ZOHO-OAUTH-INVENTORY.md` and never the steps in `ZOHO_INTEGRATION.md` /
`ZOHO_QUICK_START.md`. For secrets, follow `docs/SECRETS-REQUIRED.md`.

| File | What it was |
|---|---|
| `API_IMPROVEMENTS.md` | Portal API and cross-service communication notes |
| `MEGAMENU_IMPROVEMENTS.md` | MegaMenu fix summary |
| `OPENAI_BILLING_CONTROL.md` | OpenAI integration billing-control notes |
| `OVERNIGHT_STORE_SITE_UX_REPORT.md` | Overnight Store and site UX report |
| `PHASE_2_STORE_DESIGN_REPORT.md` | Phase 2 Store visual design report |
| `PORTAL_SYSTEM_IMPROVEMENTS.md` | Portal system improvements summary |
| `QUICK_START_TESTING.md` | Early portal testing guide |
| `REQUIREMENTS_COVERAGE_AUDIT.md` | Portal requirements coverage audit |
| `REQUIREMENTS_FULFILLED.md` | Portal requirements checklist (lists the retired Stripe route) |
| `ROUTE_CONSOLIDATION_RECOMMENDATIONS.md` | Route consolidation recommendations |
| `SECURITY_IMPLEMENTATION.md` | Early security implementation guide |
| `SECURITY_QUICK_START.md` | Early security quick start |
| `SECURITY_SUMMARY.md` | Early security summary |
| `STORE_FUNNEL_LOGIN_WALL_TRACE.md` | Store purchase-funnel trace and three proposals |
| `ZOHO_INTEGRATION.md` | Early Zoho One / Flow / ASAP integration notes |
| `ZOHO_QUICK_START.md` | Early Zoho quick start |

Still at the root on purpose, because a doc of record or code links them: `SHIPPING_API_REFERENCE.md`
(`docs/plans/opencode/lane-d-status-shipping.md`), `VENDOR_INTEGRATION_GUIDE.md` and
`VENDOR_SETUP_STATUS.md` (`docs/plans/opencode/lane-e-integrations.md`, `server/integrations/vpn/`).
