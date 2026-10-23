# Claude Code Prompt — Client Portal: Roles, Client Navigation, and File Delivery

## Goal
1. Clients see only what applies to them (about 6 items for a regular user).
2. DE gets three clear account types: a break-glass super admin, a daily DE staff account, and DE as its own client.
3. DE staff can upload files (documents, PDFs, EXE, MSI, ZIP) into any client's profile, safely.

Work on branch `claude/portal-roles-client-nav-<date>`. Open a PR when done. **Do not merge, push to main, or deploy.** Joe deploys production himself.

---

## Phase 0 — Report first (STOP after this phase)
1. **Map the nav.** List every sidebar item with its route, its section (Support / Account / Programs / Tools / DE Admin), and its current visibility rule.
2. **Map the roles.** List every role/permission that exists today (portal DB, auth, middleware). Report what a client standard user, a client admin, and the current "Administrator / DE administrator" account each see.
3. **Find the sample data.** List every item with a SAMPLE badge or mock data (DE Questionnaires, IT Roadmap, Business Reviews, System Status, VPN Access, Cytracom Phone, Ship Center, others).
4. **Check data sources.** Report where role and entitlement data come from today (portal DB; Zoho CRM Contact/Account for company, tier, entitlements).
5. **Check file storage.** Report how Files & Downloads stores files today: storage location, whether files are scoped per client, upload limits, allowed types, and whether any malware scanning exists.
6. **Check DE as a tenant.** Report whether "Digerati Experts" exists as a client company record.

**Deliver the Phase 0 report and wait for Joe's approval.**

---

## Phase 1 — Account and role model

### Three DE account types
| Account | Who | What it sees |
|---|---|---|
| **Break-glass super admin** | Emergency/setup only, never daily use | Everything: all clients, DE Admin, system settings, auth config, role management. This is today's "Administrator" access; do not reduce it |
| **DE staff (daily account)** | Joe's normal login | Two hats on one account: (1) a member of the **Digerati Experts** client company, seeing the normal client menu for DE's own internal use; (2) **client manager** permissions across all client companies |
| **Client users** | Client employees | Client menu only, filtered by role and entitlement |

### Break-glass requirements
- Separate login from the daily DE staff account.
- Strongest MFA available (passkey/hardware key); no password-only login.
- Every login triggers an alert to Joe (email at minimum).
- Every action is written to the audit log with a "break-glass" flag.

### DE staff "client manager" permissions
**Can:**
- Switch into any client company (the existing company switcher)
- Manage client users, client roles, and entitlements
- Upload, replace, and remove files in any client's profile
- View and work client tickets, requests, approvals, orders
- See DE-only items (Infrastructure Issues, Structure & IDs, Ship Center, SAMPLE items for testing)

**Cannot (super admin only):**
- Change global system settings or auth configuration
- Create, delete, or change DE staff / super admin roles
- Delete a client company
- Change billing/integration configuration

### DE as its own client
- "Digerati Experts" is a normal client company record.
- When Joe's DE staff account is switched to it, Joe sees the standard client menu with his DE role there (likely client admin + billing + purchaser + owner).
- DE's internal files, tickets, and services live there like any client's. No special-case code paths.

---

## Phase 2 — Client navigation

### Target client menu
**Everyone (client standard user):**
| New item | Merges |
|---|---|
| Home | Dashboard + Self-Service. Pending questionnaires/surveys appear here as tasks only when one is assigned |
| Get help | Support Tickets + Chats / DE Desk + Request Forms, as one hub with tabs |
| My requests | Service Requests and their status |
| Files | Files DE has shared with this user or their company. Shown only when at least one file is shared with them |
| How-to guides | Knowledge Base |
| Desktop agent | Download page |
| My profile | Personal settings |

**By role:**
| Item | Role | Merges |
|---|---|---|
| Approvals | Approver | Approvals; shown only when the user can approve |
| People and devices | Client admin | People & Org + My Groups + Company + Licenses + My Services |
| Billing and contracts | Billing contact | Billing + Invoices + Contracts |
| Order equipment | Purchaser | Orders + New Order + Client Marketplace + Procurement Store, as one place |
| IT plan and reviews | Owner / decision-maker | IT Roadmap + Business Reviews; shown only when real data exists |

**By purchased service** (entitlement from Zoho CRM / portal DB):
| Item | Shown when | Rename |
|---|---|---|
| Secure access | Cloud Edge / SASE is subscribed | Was "VPN Access" |
| Business phone | Voice service is subscribed | Was "Cytracom Phone". No vendor names in client UI |
| Security training | Security Awareness is subscribed | Was "Learning" |

### Hidden from all client roles (DE staff and super admin only)
- Infrastructure Issues. Surface client-relevant outages as a status line on Home instead.
- Structure & IDs
- Ship Center
- System Status, unless it shows real data
- DE Admin section

### Navigation rules
- **No sample data anywhere.** SAMPLE items are unfinished work, not a feature. Each one gets fully built in Phase 4. Until its build is merged, it stays hidden from client roles.
- **Show nothing empty.** Hide a section header when every item under it is hidden.
- **One visibility rule per item,** defined in a single nav config (role + entitlement + hasData). No scattered conditionals.
- **Routes still work.** A hidden route visited directly redirects to Home with a short "not available for your account" note. No route is deleted.
- **Rename labels only.** Keep URLs and keep aliases for old paths.
- Labels use sentence case, and DE canonical service names where a service is named.

---

## Phase 3 — DE-to-client file delivery

### How it works for DE staff
- From the DE staff account, pick a client company, then "Share a file".
- Allowed types: PDF, DOCX, XLSX, PPTX, TXT, CSV, images, **EXE, MSI, ZIP**.
- Choose who sees it: whole company / client admins only / specific users.
- Optional note shown to the client ("Install this before Monday's migration").
- DE staff can replace a file (keeps version history) or remove it.

### Security requirements (non-negotiable — EXE and ZIP are high-risk)
- **Malware scan before publish.** Every upload is scanned; ZIPs are scanned including their contents. A failed or unscannable file goes to quarantine and is never shown to the client.
- **Check type by file content,** not by extension. Reject mismatches (e.g. an EXE renamed to .pdf).
- **Size limit,** configurable; propose a default in the PR.
- **SHA-256 hash** stored and shown to the client next to each EXE/MSI/ZIP.
- **Signature check for EXE/MSI.** Use `tools/signcheck` (already built and tested; see its README). It reports whether a file is signed, by whom, whether the signature is intact, and catches disguised file types and executables inside ZIPs. Follow its `decide()` result: publish / warn (DE staff confirm) / quarantine.
- **Tenant isolation.** A client can only ever list or download its own company's files. Add a test that proves client A cannot reach client B's file by ID or URL.
- **No public links.** Downloads require login and use short-lived signed URLs.
- **Audit log** for every upload, replace, delete, and download: who, when, which client, which file, hash.
- Client-facing label on each file: "Shared by Digerati Experts", uploader name, date.

---

## Phase 4 — Finish every SAMPLE feature (no samples, no mock data)

### Standing rule
DE never ships sample, mock, placeholder, or demo data. Every portal feature is fully written, working code backed by a real data source, or it does not exist in the menu.

### What "done" means for each feature
- **Real data source.** Portal DB records, or a live integration. No hard-coded arrays, seed data, or fallback mock data in production code.
- **Proper empty state.** When there is no data yet, say so plainly ("No roadmap items yet. Your DE team adds these after your business review."). Never fill gaps with examples.
- **Loading and error states.** A failed integration shows a clear error and a "Get help" link, never fake numbers.
- **Permissions.** Uses the Phase 1 role model and Phase 2 entitlement rules.
- **DE staff side.** Every client-facing feature has the DE staff screen to create, edit, and manage its data.
- **Tests.** Unit tests for the data layer, plus a cross-client isolation test.
- **SAMPLE badge removed** only when all of the above pass.

### Build each feature (one PR per feature, in this order, stop for Joe's review after each)
Phase 0 must report what each sample screen currently does. Joe confirms the scope below before each build starts.

1. **DE Questionnaires.** DE assigns questionnaires (onboarding, assessment intake, annual reviews) to client users. Clients fill in, save a draft, and submit; DE sees responses. **Build it on the existing Surveys engine** (Surveys has no SAMPLE badge). Do not create a second form system.
2. **IT Roadmap.** DE creates roadmap items per client: title, why it matters, priority, target quarter, estimated cost, status. Clients view it; owners can comment and mark items approved.
3. **Business Reviews.** DE creates a review per client: meeting date, summary, decisions, linked roadmap items, attached PDF. Clients see their review history.
4. **System Status.** DE-posted incidents and maintenance notices per client or for all clients, plus a live device/service health summary **only if** an RMM integration already exists (report this in Phase 0). If no RMM integration exists, ship the incidents-and-notices version and list the integration as follow-up work. Do not fake health data.
5. **Secure access** (was "VPN Access"). From the Cloud Edge / SASE platform's API: the user's access status, agent download, and setup steps. Entitlement-gated. Check the vendor API dossier for the integration details; the vendor name never appears in the client UI.
6. **Business phone** (was "Cytracom Phone"). From the voice platform's API: the user's extension, voicemail access, and softphone/app download links. Entitlement-gated. The vendor name never appears in the client UI.
7. **Ship Center.** Shipments of hardware DE sends to clients: carrier, tracking number, status, linked order. The DE staff side creates and updates shipments. Clients see tracking **inside "Order equipment"** on each order, not as a separate menu item.

### Integration rules
- API credentials live in server environment settings, never in client code or the repo.
- If an integration's credentials or API access aren't available yet, stop that feature and report what's needed. Do not build it with mock data in the meantime.

### Guardrail
Add a CI check that fails the build if production code contains a SAMPLE badge, a `mock`/`sample`/`demo` data import outside test folders, or a feature flag that enables sample data.

---

## DO NOT CHANGE
- The break-glass/super admin's full access (today's Administrator)
- Authentication methods: passkey, Microsoft SSO, Google, magic link, password opt-in
- Company switcher behavior for DE staff
- Zoho Desk / DE Desk integrations, ticket creation, approvals logic
- Store/cart/order backend, billing/invoice data sources
- Any API removal, route removal, or destructive database migration (additive migrations only)

---

## QA
- **Test as each account:** break-glass super admin, DE staff (in a client and in the Digerati Experts company), client standard user, approver, client admin, billing contact, purchaser, owner.
- **Test entitlements on and off:** Cloud Edge, Voice, Security Awareness.
- **Test each Phase 4 feature:** with real data, with no data (empty state), and with the integration failing (error state). Confirm no SAMPLE badges remain and the CI guardrail passes.
- **Test file delivery:** upload each allowed type; upload a test malware file (EICAR) and confirm quarantine; upload a renamed EXE and confirm rejection; confirm cross-client access fails.
- **Test widths:** 390, 768, 1024, 1440, including the mobile drawer.
- **PR description must include:** before/after menu per account (screenshots), the final nav config table, the role/permission matrix, and the file-delivery security checklist with test results.
