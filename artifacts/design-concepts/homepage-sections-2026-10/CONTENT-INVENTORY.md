# Homepage content inventory — live `/` (`client/src/pages/DigeratiHomepage.tsx`)

Read from source on 2026-10-01 (branch state at that date). Every string below is transcribed verbatim from the component or the data file it imports. Nothing is paraphrased unless marked "(summary)". Use this to mock up each section with the real copy.

Conventions used in this file:

- **Field** = the wrapper surface classes (see glossary).
- **Accent** = which word carries the `de-hero-accent` text gradient (`linear-gradient(90deg, #9a8bff, #7b6cff 45%, #d3126a)`), or a solid magenta span.
- Magenta colon = several headings end in a `<span class="text-[#D3126A]" aria-hidden>:</span>`; written here as `…:` with a note.
- `CTA.primary` = **"Get My Cyber Risk Assessment"** (`client/src/lib/ctaCopy.ts`). Other CTA constants: `heroPrimary` "Get My Cyber Risk Assessment", `primaryShort` "Cyber Risk Assessment", `primaryNavCompact` "Risk Assessment", `secondary` "See Plans & Pricing", `secondaryHref` `/proactive-ecosystem-pricing`, `utilitySupport` "Client Support".
- `PRIMARY_PHONE` = **325-480-9870**, `tel:+13254809870`, label "Sales & Business" (`shared/companyContact.ts`, re-exported from `client/src/data/companyContact.ts`).
- `COMPANY` (same file): legalName "Digerati Experts"; email info@digeratiexperts.com; supportEmail support@digeratiexperts.com; billingEmail billing@digeratiexperts.com; privacyEmail privacy@digeratiexperts.com; website https://digeratiexperts.com; bookingUrl https://meet.digerati-experts.com/; address "3165 S Alma School Rd Suite 29, Chandler, AZ 85248"; areaServed "Arizona and Greater Phoenix (Chandler, Phoenix, Scottsdale, Tempe, Mesa, Gilbert)"; mapsUrl https://maps.google.com/?cid=1710856351091471339. Socials: LinkedIn https://www.linkedin.com/company/digerati-experts · Facebook https://www.facebook.com/digeratiexperts · Twitter https://twitter.com/digerati_experts · Instagram https://www.instagram.com/digerati.experts.
- "openBooking(source)" = opens the booking modal (`BookingContext`, Zoho booking URL https://meet.digerati-experts.com/). `/book` is the booking page route.

## Surface glossary (`client/src/index.css`)

| Class | What it is |
|---|---|
| `de-dark-well` | page black, `--de-bg` `#050312` |
| `de-dark-chapter` | one step up, `--de-surface` `#0a0a0a` |
| `de-dark-raised` / `bg-de-raised` | `--de-raised` `#151217` |
| `de-chapter-hairline` | 1px top border `--de-hairline` |
| `de-field-grain` | grain texture tile (180px) on the dark field |
| `de-style-box` | contained charcoal field: `--de-raised` bg, 1px hairline, radius 1.5rem, grain; page black shows in the gutters |
| `de-paper-island` | warm paper island on the dark well: `--de-paper` bg, white/18% border, radius 1.75rem, magenta ring + deep shadow, paper grain |
| `de-paper-island--md-up` | island only from `md`; on phone the content sits directly on the dark field |
| `de-paper-lift-lg` | raised white card on paper (`--de-paper-raised`, hairline, 8/32 shadow) |
| `de-paper-on-well` | white card sitting directly on the dark well (white/16% border, dark shadow, faint magenta ring) |
| `de-paper-faq-item` | FAQ row on paper, same white lift, magenta left rail |
| `de-process-band` | `--de-surface` band with violet + magenta radial glows at the top corners, hairline top and bottom, grain |
| `de-founder-seam` | 1px magenta-fade seam at the top of the team section |
| `de-interactive-tile` | hover lift/border treatment on clickable tiles |

Page shell: `<div class="de-dark-well min-h-screen bg-[#050312] pb-8">`; canvas width `var(--de-canvas)`; `FullPageScrollProvider` (disabled on mobile). `useSEO` title "Managed Security Service Provider", description "Arizona MSP/MSSP. Cybersecurity-first managed IT, 24/7 emergency incident response, and a Cyber Risk Assessment that matches the operating model to your environment." Organization + WebSite JSON-LD emitted (not visible).

## `homepageSections` map (order on page)

| # | id | label | theme | chapter | in nav | Components |
|---|---|---|---|---|---|---|
| 1 | `hero` | Home | dark | yes | yes | ReferenceHeroSection + DigeratiAlertBanner |
| 2 | `stats` | Why DE | dark | yes | yes | DigeratiStatsSection |
| 3 | `challenges` | Problems | light | no | **no** | DigeratiWhatWeTackleSection |
| 4 | `services` | How It Works | dark | yes | yes | DigeratiServicesSection |
| 5 | `protection` | Protect | light | no | **no** | DigeratiHowWeProtectSection |
| 6 | `testimonials` | Proof | dark | no | **no** | DigeratiTestimonialsSection + HomepageProofSection |
| 7 | `trust` | Trust | light | no | **no** | DigeratiTrustPhotoSection |
| 8 | `team` | Team | dark | no | **no** | DigeratiMeetExpertsSection |
| 9 | `industries` | Industries | dark | yes | yes | DigeratiIndustriesSection |
| 10 | `pricing` | Packages | dark | yes | yes | DigeratiPricingSection |
| 11 | `insights` | Insights | dark | no | **no** | DigeratiThreatsInsightsSection + DigeratiAIAssistanceSection |
| — | (none) | — | — | — | — | DigeratiLeadFormSection (rendered between `insights` and `faq`, outside the scroll-section map; its own `id="assessment-form"`) |
| 12 | `faq` | FAQ | light | yes | **no** | DigeratiFAQSection + DigeratiNewsletterSection |
| 13 | `cta` | Next step | light | no | **no** | DigeratiCTASection |
| 14 | `contact` | Contact | dark | yes | yes | DigeratiContactSection + DigeratiEnhancedFooterSection |

The top table-of-contents strip and the bottom dock both show only `TOP_CHAPTERS`/`DOCK_CHAPTERS` = hero, stats, services, pricing, industries, contact, rendered in page order: **Home · Why DE · How It Works · Industries · Packages · Contact** (`client/src/components/HomepageSectionNav.tsx`).

---

## Site chrome

### A. MegaMenu (`client/src/components/MegaMenu.tsx`)

**Announcement strip** (black, dismissible, above the utility row): 🚀 "Get Your Free Cybersecurity Assessment – See Where You Stand Today!" · underlined button "Start My Assessment" → openBooking('announcement-bar') · X "Dismiss announcement".

**Utility row** (right-aligned): phone icon "325-480-9870" (sm-down: "Call") → tel · monitor icon "Support" → https://assist.zoho.com/ (new tab) · "Client Portal" (sm-down: "Portal") → `PORTAL_LOGIN` (`client/src/lib/portalUrls.ts`).

**Main nav bar** (fixed; `bg-black/90` blur, solid `#050312` when needed): logo `DE_LOGO_REVERSE` (`brand/digerati-logo-reverse.svg`, aria "Digerati Experts home"), items, right CTA button (lg+) showing "Risk Assessment" (lg) / "Cyber Risk Assessment" (xl+) → openBooking("megamenu"); hamburger below lg ("Open menu"/"Close menu").

Nav items and mega-menu columns (title · description · url):

- **Solutions** → `/solutions`
  - *Ways to Work With Us*: ProActive Ecosystem · "Cybersecurity-first operating model: IT → Office → Business → Enterprise" · `/solutions/proactive-ecosystem` | Co-Managed IT · "Extend your internal IT team without replacing it" · `/solutions/co-managed-it` | Standalone Services · "A specific gap — backup, UCaaS, awareness, or a project" · `/solutions/standalone-services` | Solve a Business Need · "Curated DE solutions organized around the outcome you need" · `/store` | Cyber Risk Assessment · "Match the operating model to your environment" · `/book`
  - *ProActive Ecosystem* (each shows price "From $N/user" from pricing.ts): IT · "Smaller, less complex environments that need essential protection and a documented baseline" · From $125/user · `/solutions/proactive-it-ecosystem` | Office · "Broader managed workplace — more users, devices, and a professionally operated network" · From $165/user · `/solutions/proactive-office-ecosystem` | Business · "Deeper infrastructure, cyber operations, recovery, governance, and strategy" · From $245/user · `/solutions/proactive-business-ecosystem` | Enterprise · "Multi-site, regulated, or security-sensitive environments that need the greatest operating depth" · From $345/user · `/solutions/proactive-enterprise-ecosystem` | Compare All Packages · "Capabilities and operating depth — not a ranking" · `/proactive-ecosystem-pricing`
  - *Managed IT & Workplace*: Managed IT Support · "Service desk and day-to-day issue ownership" · `/solutions/managed-it-support` | Managed Workplace · "Identity, devices, apps, and employee lifecycle" · `/solutions/managed-workplace` | Identity & Access · "SSO, MFA, and access architecture" · `/solutions/unified-security` | Managed Network & Connectivity · "Firewall, Wi-Fi, and connectivity operations" · `/solutions/managed-it-support` | Cloud / SaaS Backup · "Endpoint, M365, and Google backup — not BCDR" · `/solutions/cloud-backup` | UCaaS · "Unified phone and meeting systems" · `/services/ucaas`
  - *Cybersecurity & Resilience*: Endpoint & Email Protection · "Device and mailbox defenses" · `/solutions/threat-detection` | Threat Detection & Response · "Find and contain attacks before damage spreads" · `/solutions/threat-detection` | Security Operations / SOC · "Human-led monitoring and response" · `/solutions/security-operations` | Security Awareness · "Training and phishing simulations for staff" · `/solutions/security-awareness` | Data Encryption · "Protect data even if an endpoint is lost" · `/solutions/data-encryption` | Backup & Disaster Recovery · "Continuity, RPO/RTO, failover, and restore testing" · `/solutions/backup-disaster-recovery`
  - *Strategy & Compliance*: vCIO · "Executive technology and security guidance" · `/solutions/vcio-strategy` | Compliance & Risk Reporting · "Evidence and reporting for audits and insurers" · `/solutions/compliance-reports` | Cyber Insurance Readiness · "Controls and documentation carriers typically ask for" · `/solutions/compliance-reports`
- **Industries** → `/industries`
  - *Industries We Serve*: Healthcare · "HIPAA compliance made simple" · `/industries/healthcare` | Law Firms · "Protect client confidentiality" · `/industries/law-firms` | Accounting · "Secure tax & financial data" · `/industries/accounting-finance`
  - *More Industries*: Real Estate · "Prevent wire fraud attacks" · `/industries/real-estate` | Nonprofits · "Affordable IT for mission" · `/industries/nonprofits` | Professional Services · "Secure client data" · `/industries/professional-services`
  - Featured rail: eyebrow "Arizona practices" · title "HIPAA, privilege, tax data, and wire fraud" · body "Healthcare, legal, accounting, and real estate each fail in a different place. Start with the industry that matches how you actually operate." · CTA "See industries we serve" → `/#industries`
- **Resources** → `/resources`
  - *Learn*: Case Studies · "Real Arizona success stories" · `/resources/case-studies` | Digerati Journal · "Cybersecurity & managed IT field notes" · `/resources/blog` | Cyber Facts · "Interactive credibility stats & sources" · `/resources/cyber-facts` | Videos & Webinars · "Educational content library" · `/resources/videos`
  - *Tools*: Downtime Calculator · "See what downtime really costs" · `/resources/downtime-calculator` | Security Checklist · "Assess your security posture" · `/resources/security-checklist` | Datasheets · "Package PDFs and sample reports" · `/resources/datasheets` | Executive briefs · "Short buyer-ready operating notes" · `/resources/briefs` | Campaign offers · "Single-offer pages for ads and search" · `/go`
  - Featured rail (with image `client/src/assets/images/ebook-defending-digital-realm-cover.webp`, alt "Defending the Digital Realm ebook cover"): eyebrow "Free ebook" · title "Defending the Digital Realm" · body "What a cyber risk assessment finds in identity, email, backups, and insurance gaps — before an incident finds it for you." · CTA "Read the ebook" → `/resources/ebook/defending-digital-realm`
- **Pricing** → `/proactive-ecosystem-pricing` (simple link)
- **About** → `/about/mission-values`
  - *Is This You?*: Frustrated with IT? · "Slow response and recurring issues" · `/contact` | Worried about Security? · "Concerned about ransomware" · `/solutions/threat-detection` | Need Compliance? · "HIPAA, SOC 2, or FTC needs" · `/solutions/compliance-reports`
  - *Company*: Mission & Values · "Our commitment to partnership" · `/about/mission-values` | Case Studies · "Arizona business success stories" · `/resources/case-studies` | Meet The Experts · "Chandler, AZ team" · `/about/team` | Client Bill of Rights · "Our 8 pledges to you" · `/about/client-bill-of-rights` | 100% Guarantee · "30-day money-back promise" · `/about/guarantee` | 21 Questions to Ask · "Before hiring any IT company" · `/about/21-questions`
  - Featured rail: eyebrow "Chandler, Arizona" · title "You know who owns the ticket" · body "Principal-led MSP/MSSP. An Arizona team you can reach — not an anonymous remote queue." · CTA "Meet the experts" → `/about/team`
- **Store** → `/store` (simple link)
- **Contact** → `/contact` (simple link)

**Mobile drawer** (below lg): same items as accordions, then three tiles — "Call Us" / 325-480-9870 (tel) · "Remote Support" / "Support" (assist.zoho.com) · "Existing Client?" / "Client Portal" (portal login) — then full-width magenta button "Get My Cyber Risk Assessment" (openBooking "megamenu_mobile") and bottom line "Digerati Experts • Arizona's MSP Leader".

**Homepage on-page TOC** (`HomepageOnPageNav`, desktop only, under the nav): links Home · Why DE · How It Works · Industries · Packages · Contact with magenta underline on the active one.

### B. SiteBottomBar / dock (`client/src/components/SiteBottomBar.tsx`)

Floating pill (`de-unified-bar-shell`, glass, white/20 border) bottom-right. States:

- Collapsed (default, every page): scroll-to-top round button (appears after 500px; aria "Scroll to top") + **Ask DE launcher**: white round glyph button + two-line label "Ask DE" / "We're here to help." (label hidden below sm; compact glyph-only on Door 2 / store paths).
- Expanded (desktop, after 72px scroll, not near footer, cookie consent stored): left lead-in shield icon "Protected?" then chapter chips Home · Why DE · How It Works · Industries · Packages · Contact (active = magenta pill with white dot); divider; actions: phone icon "325-480-9870" (xl+) → tel, magenta button "Risk Assessment" → openBooking("homepage_section_dock").
- **Ask DE chooser** (white card, 380px / phone sheet): title "Ask DE", sub "How can we help you today?", glyph; four rows — "Get Support" · "Open a ticket or report an issue" | "Get Help" · "Ask DE a question and get guidance" | "Client Tools" · "Access tools and resources for your business" | "Give Feedback" · "Share feedback or suggestions"; footer "We're here to help!" + "Call 325-480-9870". Close X "Close Ask DE".
- **Nudge** (once, after 6s, paper card above the dock): "Stuck on something IT or security?" / small "Ask DE — real engineers, clear next step." with × "Dismiss Ask DE suggestion".

---

## 1. ReferenceHeroSection — `hero` / "Home"

File: `client/src/pages/sections/ReferenceHeroSection.tsx` (section `id="home"`).

**Field:** bare dark field, no island. Inline background: `radial-gradient(circle at 78% 36%, rgba(87,68,255,0.22)…)`, `radial-gradient(circle at 92% 68%, rgba(211,18,106,0.10)…)`, `linear-gradient(110deg, #050312 0%, #060617 52%, #090924 100%)`. Over that: the Phoenix city-lights plate at 30% opacity, masked so the left text column stays dark (mask `to right` 0.3 → 1), oversized 112% with gentle scroll parallax (0 → 9%); a 52px violet grid (`rgba(123,108,255,0.14)`) on the right 58%, faded to the left. Then a **paper trust strip** (`bg-[#f7f5f2]`, ink `#17141f`) across the bottom.

**Layout:** two columns from lg (`minmax(0,1.02fr) minmax(420px,0.98fr)`), min-height 680px, top padding `nav-offset + 3rem`. Left column max 760px; right column holds the assessment preview (max 560/600px) with a violet radial glow behind it. Stacked on mobile (preview under copy).

**Copy (left column):**
- Eyebrow (uppercase, `#a99cff`, 0.2em tracking): "Arizona MSP · Cybersecurity & Managed IT"
- H1 (three lines on lg, `clamp(2.2rem,4.6vw,4.75rem)`, `#fbfaf8`): "Cybersecurity-First" / "IT That Powers" / **"Your Business"** — third line is the gradient line (inline `from-[#9a8bff] via-[#7b6cff] to-[#d3126a]`, same recipe as `de-hero-accent`).
- Sub (17px, white/72, max 650px): "Managed IT, security, and compliance — built for Arizona businesses that can't afford downtime."
- Buttons: primary gradient button (`#5f4ae8 → #7d5cf4`) "Get My Cyber Risk Assessment" + arrow → openBooking("hero-reference"); outline button "See Plans & Pricing" → `/proactive-ecosystem-pricing`.
- Reassurance row (14px, white/70, green checks): "No obligation" · "Response within one business day" · link "Call 325-480-9870" (tel).
- Positioning row (sm, white/58, dot separators): "Assessment-led" · "Client-owned access" · "Fully managed or co-managed".
- **PronunciationCard** (`client/src/components/PronunciationCard.tsx`, max 620px, raised card with 3px magenta rail): gold wordmark bars (the only gold on the page) + headword "DIG·ER·A·TI" (the A underlined magenta); phonetics `\ ˌdi-jə-ˈrä-tē \` and "dij-uh-RAH-tee"; magenta button "Hear it" (plays `/audio/digerati-pronunciation.wav` — a Windows SAPI synthesized file, not a human recording, per `client/public/audio/README.md`; falls back to speech synthesis); line "plural noun · a blend of digital and literati, in use since the early 1990s"; definition "1 People with deep expertise in computers and digital technology — the ones who actually know how the machinery works."; sub-head "Tap a syllable to hear it"; four chips DIJ "as in digit" · UH "unstressed" · RAH "stress here" (magenta, stressed) · TEE "as in tea"; note "Commonly heard: dye-ger-AH-tee, dig-er-AT-ee, dih-ger-AH-tie. The g is soft, and the weight lands on the third syllable."; fallback line "Audio is not supported in this browser — use the sounded-out spelling above."; sr status "Ready to play pronunciation."

**Right column — DashboardMockup** (`client/src/components/graphics/DashboardMockup.tsx`, aria "Illustrative preview of a Digerati Experts Cyber Risk Assessment"). A dark app-window illustration (not a screenshot): title bar with shield icon "Assessment overview"; heading "What the assessment reviews" + "Review of identity, endpoints, email, backups, and foundational security controls."; pill "Illustrative preview"; 4 toggle tiles "Identity & access" · "Endpoints & devices" · "Email security" · "Backups & recovery"; bar panel "Posture across key areas" with label "Overall posture" / "{area} posture", value "69 / 100" + "Illustrative"; six bars Identity 68 · Endpoints 77 · Email 61 · Backups 84 · Controls 56 · Overall 69 (overall bar magenta); outcomes list "Prioritized findings" · "Business-impact context" · "Right-sized recommendations". All values are sample posture, not client data.

**Trust strip** (paper, below the hero): heading (xl/2xl semibold) "Trusted IT Partner for Arizona Businesses"; white bordered 1→2→4-column strip, min cell height 128px, Lucide icon left of each:
1. ShieldCheck — "Cybersecurity First" — "We secure your business from the inside out."
2. CheckCircle2 — "Proactive IT" — "Prevent issues before they impact your business."
3. ClipboardCheck — "Compliance Ready" — "Stay compliant with industry standards and regulations."
4. MapPin — "Local & Responsive" — "Arizona-based team, always here when you need us."

**Images:** `attached_assets/de-hero-arizona-dusk-1600.webp` (1600×1067, 50 KB; PNG master `de-hero-arizona-dusk.png` also in repo) — Phoenix aerial city lights at dusk. Provenance: `scrollcraft/builds/de-v2/BRIEF.md` lists it under "Photography (real)". No vendor logos in the hero by decision (Joe 2026-08-30).

---

## 2. DigeratiAlertBanner — inside `hero` chapter ("Why we exist")

File: `client/src/pages/sections/DigeratiAlertBanner.tsx`.

**Field:** `de-dark-well` section → `de-paper-island` (paper, max-w 3xl inner). Dark ink `#1A1228`, body `#2A2438`, eyebrow `#A30E52`.

**Copy:**
- Eyebrow: "Why we exist"
- H2 (3xl→5xl): "We Exist to Protect and Enable Your Business" (no accent)
- Para: "If you're like most business leaders, you don't want another vendor — you want a security-first partner who proactively reduces risk, improves uptime, and keeps your team moving."
- White bordered list card, 3 rows, each a link with a short magenta dash:
  1. "Security-First Operations" — "Every system, endpoint, and user is protected - by design, not by reaction." → `/solutions/proactive-ecosystem`
  2. "Co-Managed or Fully Managed" — "We support your internal IT or serve as your outsourced technology team." → `/solutions/co-managed-it`
  3. "Executive-Level Transparency" — "Reports, KPIs, and compliance insights that make sense - and drive decisions." → `/trust`
- H3: "Ready to Secure Your Business?"
- Para: "Get enterprise-grade protection tailored for Arizona businesses. Let's discuss your security needs."
- Buttons: magenta "Schedule Consultation" (arrow icon) → `/book`; white outline "Call 325-480-9870" (phone icon) → tel.

No images.

---

## 3. DigeratiStatsSection — `stats` / "Why DE"

File: `client/src/pages/sections/DigeratiStatsSection.tsx`; data `client/src/data/cyberAwarenessFacts.ts` → `getHomepageCyberFacts()` (`HOMEPAGE_FACT_IDS`).

**Field:** `de-dark-well de-field-grain` → `de-style-box` (charcoal box, mx-3/4/6) with inline violet/magenta radial drift (`circle at 12% 18% rgba(87,68,255,0.12)`, `circle at 95% 90% rgba(211,18,106,0.05)`).

**Copy:**
- Eyebrow (magenta ink): "Why Digerati Experts"
- H2: "The Threats Are **Real**" — accent on "Real"
- Para: "Don't become a statistic. These numbers show why proactive security matters — and why endpoint, identity, and recovery discipline have to be owned, not assumed."
- Grid 1→2→4 of fact cards (gradient `#181520 → #0f0d14`, white/10 border, radius 2xl; `IconWell` icon top-left, magenta dot top-right; metric mono 3xl/4xl; statement; source line above a hairline). Each card is an external link to `sourceUrl`:
  1. AlertTriangle — **48%** — "of breaches involve ransomware" — "— Verizon DBIR 2026" → https://www.verizon.com/business/resources/reports/dbir/
  2. DollarSign — **$11.5M** — "average cost of a data breach in the United States" — "— IBM Cost of a Data Breach 2026" → https://www.ibm.com/reports/data-breach
  3. Shield — **99%+** — "of unauthorized access attempts are blocked by multifactor authentication (MFA)" — "— Microsoft Digital Defense Report 2025" → https://www.microsoft.com/en-us/corporate-responsibility/cybersecurity/microsoft-digital-defense-report-2025/
  4. MapPin — **$392M** — "in internet crime losses reported from Arizona in 2024 (IC3 state ranking by loss)" — "— FBI IC3 Annual Report 2024" → https://www.ic3.gov/AnnualReport/Reports/2024_IC3Report.pdf
- Link: "Full sourced facts" + arrow → `/resources/cyber-facts`

Other facts in the file (not on the homepage, available if the designer wants alternates): "45 days" Arizona breach-notification window (Arizona Attorney General 2025); "31%" of breaches begin with exploitation of software vulnerabilities (Verizon DBIR 2026); "62%" human element (Verizon DBIR 2026); "~96%" of ransomware victims were SMBs (Verizon DBIR 2026); "$4.99M" global average breach cost (IBM 2026); "$2.77B" BEC losses (FBI IC3 2024). Banned phrasing: any "60% of small businesses close within six months" claim.

No images.

---

## 4. DigeratiWhatWeTackleSection — `challenges` / "Problems" (not in nav)

File: `client/src/pages/sections/DigeratiWhatWeTackleSection.tsx`.

**Field:** `de-dark-well` → `de-paper-island` (paper), inner max-w 5xl. Editorial layout: header with bottom hairline, then a 1→2→3 column grid divided by hairlines (no boxed cards), then a hairline footer row.

**Copy:**
- Eyebrow (bold, `#D3126A`): "Problems we solve"
- H2 (bold 3xl→5xl): "What We Tackle" (no accent)
- Para: "Compact view of the problems we own with you. Sourced industry statistics live on Cyber Facts; capability detail lives on Solutions."
- Header link (right on md): "Full threat context" + arrow → `/resources/cyber-facts`
- Six items, numbered mono 01–06 with a small arrow, two per column (col 1: 01–02, col 2: 03–04, col 3: 05–06), each a link:
  1. "Ransomware & Malware" — "Advanced threat detection and rapid response to eliminate malicious attacks before damage occurs" → `/solutions/threat-detection`
  2. "Data Loss Prevention" — "Comprehensive backup strategies with tested disaster recovery ensuring business continuity" → `/solutions/backup-disaster-recovery`
  3. "Compliance Gaps" — "Navigate HIPAA, PCI DSS, and SOC 2 requirements with continuous monitoring and reporting" → `/resources/cyber-facts`
  4. "Phishing & Social Engineering" — "Multi-layered email security combined with ongoing employee security awareness training" → `/solutions/security-operations`
  5. "Zero-Day Vulnerabilities" — "Proactive patch management and security assessments to close gaps before exploitation" → `/solutions/threat-detection`
  6. "Insider Threats" — "User behavior analytics and access controls to prevent internal security breaches" → `/solutions/unified-security`
- Footer row: "Don't see your specific challenge? We handle custom threat profiles across Arizona." + magenta button "Discuss Your Security Needs" + arrow → `/book` (opens in new tab).

No images.

---

## 5. DigeratiServicesSection — `services` / "How It Works"

File: `client/src/pages/sections/DigeratiServicesSection.tsx`.

**Field:** `de-dark-chapter de-chapter-hairline de-field-grain` (surface `#0a0a0a`, no island, `container`).

**Copy — header:**
- Eyebrow (magenta ink): "How to work with us"
- H2: "Cybersecurity-First **Managed IT**" — accent on "Managed IT"
- Para: "Three clear paths. Capability depth stays available here and under Protect — nothing removed."

**Three path cards** (grid 1→3, radius 2xl, `IconWell` md icon; card 1 is featured: magenta/60 border, deeper gradient, badge pill "Full Operations"):
1. Shield — eyebrow "ProActive Ecosystem" — "Fully Managed IT & Cybersecurity" — "One accountable team for support, identity, endpoints, email, backup, and security operations — delivered through our ProActive Ecosystem." — link text "Explore managed services" → `/solutions/proactive-ecosystem`
2. Users — (no eyebrow; blank line reserved) — "Co-Managed IT" — "Augment your internal IT with DE security operations, monitoring, and specialized coverage without replacing your team." — "See co-managed" → `/solutions/co-managed-it`
3. ClipboardCheck — "Cyber Risk Assessment" — "Start with a practical review of identity, endpoints, email, backups, and security posture — then choose what to own together." — "Get My Cyber Risk Assessment" → `/book`

- Line under cards: "Need one specific service? **View Standalone Services**" (underlined link) → `/solutions/standalone-services`

**Capability preview** (`data-testid="engage-capability-preview"`, centered):
- H3 (3xl→5xl): "ProActive Ecosystem**:**" (magenta colon)
- Para: "Preview of the stack we manage — also detailed under Protect."
- Radix **Tabs** (horizontal scroll on mobile, wrapped/centered on md; active tab = magenta border + inset ring, icon turns magenta); aria "Security capabilities". Tab → panel (centered: title, desc, "{title} details" link):
  1. Eye — "SOC / MDR Monitoring" — "24/7 detection and response." → `/solutions/security-operations`
  2. ShieldCheck — "Endpoint Security (EDR)" — "Protect devices across the environment." → `/solutions/threat-detection`
  3. UserCheck — "SMART Identity (MFA + SSO)" — "Stronger access without user chaos." → `/solutions/unified-security`
  4. KeyRound — "Privileged Access Controls" — "Admin controls and audit visibility." → `/solutions/unified-security`
  5. Cloud — "Backup & Disaster Recovery" — "Recovery planning and restore discipline." → `/solutions/backup-disaster-recovery`
  6. AlertCircle — "Email Protection" — "Anti-phishing and mailbox defenses." → `/solutions/security-operations`
- Link (Layers icon): "See full Protect process" → `/#protection`
- Bottom link: "How the ProActive Ecosystem works" + arrow → `/solutions/proactive-ecosystem`

No images.

---

## 6. DigeratiHowWeProtectSection — `protection` / "Protect" (not in nav)

File: `client/src/pages/sections/DigeratiHowWeProtectSection.tsx`; deck `client/src/components/visual/ProtectionCommandDeck.tsx` (`protectionDomains`).

Two stacked `<section>`s.

### 6a. "What we protect" (island)

**Field:** `de-dark-well` → `de-paper-island de-paper-island--md-up` (paper from md; on phone the deck reads directly on the dark field — note the eyebrow/heading colours flip: phone eyebrow `#F04C97` on dark, md+ `#A30E52` on paper; heading white on phone, `#1A1228` on md+).

- Eyebrow: "What we protect"
- H2: "Eight blocks. One accountable operating model." (no accent)
- Para: "Protection is layered around the business, and each block answers a specific class of threat. Risk and exposure runs continuously beneath the other seven. Select a block below to see how we operate it."
- `<div id="protection-stack">` → **ProtectionCommandDeck** (interactive switcher; default selection `identity`).

**Deck — desktop (md+)**: wrapped in `EvidenceFrame` (dark raised frame): header row badge **"Illustration"** (classification `ILLUSTRATIVE`, magenta tint, ShieldCheck icon) + status token **"INTERACTIVE MODEL"** (magenta dot); frame title "Eight-block protection model"; subtitle "Explore how DE thinks about identity, endpoints, email, browser and web, network, detection and response, and human risk, with risk and exposure running continuously beneath them, without implying every client receives the same controls or tooling."; footer "Source: Illustrative architecture. Exact scope, controls, monitoring, deliverables, vendors, and cadence depend on the selected operating model and client environment."
  - Tab row (white mono pills; selected = solid magenta): the 8 `shortName`s; Risk & exposure pill adds "· continuous". Note under tabs (mono 10px): "Seven blocks answer a threat class each. Risk & exposure runs continuously beneath all seven as the visibility and intelligence layer."
  - Selected block, 3 columns (lg 4/4/4): **left** icon + name, purpose, white card "Questions the assessment should answer" + 3 bullets; **middle** `SecurityBoundary` labelled with `boundaryName` containing two `DiagramNode`s (title / subtitle / detail chip, status "monitored") and a `ControlGate` ("{gate.label}: {gate.policy}", magenta dot = not enforced); **right** raised card with four groups — "Representative scope" (chips), "Management may include" (list), "Signal examples" (list), "Representative outputs" (list).

**Deck — phone (<md)**: tab row of the seven `phoneLabel`s (Identity · Endpoint · Email · Browser · Network · Detection · Human) with a magenta underline on the active one; beneath, a dashed-rail row "Risk & exposure" + "Continuous · under all seven"; sentence "Seven blocks each answer a threat class, and risk and exposure runs under all of them."; then the selected block as plain reading: name + "Answers {answers}", purpose, the 3 questions as a hairline list (aria "What an assessment asks"), then boundary name with nodes as dt/dd and the gate.

**The eight domains (verbatim data):**

1. **Identity & Access** (short "Identity & access", phone "Identity", Lock) — answers "credential theft". Purpose: "Control who can access business systems, how access is verified, and how accounts are changed or removed over time." Questions: "Is MFA appropriate and enforced where required?" / "Are privileged accounts separated and reviewed?" / "Does offboarding remove access consistently?" Boundary "Identity boundary": "Users & administrators" · "Accounts, roles, authentication" · "Access inventory"; "Access policy" · "Authentication and device/context rules" · "Policy layer". Gate "Access decision": "Apply the approved authentication and access rules for the environment". Scope: User accounts · Admin access · SSO applications · Joiner/mover/leaver workflow. Management: Access-policy review · MFA configuration · Onboarding/offboarding support. Signals: Risky sign-ins · Unexpected access changes · Privilege changes. Outputs: Account review · Access findings · Remediation roadmap.
2. **Endpoint** (Shield) — answers "malware". Purpose: "Keep managed devices visible, maintained, and protected with controls matched to device ownership, user role, and business risk." Questions: "Which devices are actually in scope?" / "Are security and patch states visible?" / "What happens when a device needs containment or rebuild?" Boundary "Managed device boundary": "Workstations & servers" · "Company-managed devices in scope" · "Device inventory"; "Security controls" · "Endpoint, patch, configuration, and policy tooling" · "Control layer". Gate "Device decision": "Use the deployed controls and authorized procedure appropriate to the event". Scope: Laptops/desktops · Servers where contracted · Device configuration · Patch posture. Management: Agent deployment · Patch/configuration management · Device lifecycle support. Signals: Security alerts · Patch drift · Device-health exceptions. Outputs: Device inventory · Posture findings · Remediation actions.
3. **Email & Collaboration** (short "Email & collaboration", phone "Email", Mail) — answers "phishing". Purpose: "Reduce email-driven risk while keeping authentication, filtering, user behavior, and account settings understandable and supportable." Questions: "Are domain-authentication records configured correctly?" / "Are risky mailbox rules or forwarding visible?" / "How are users trained and supported after suspicious messages?" Boundary "Messaging boundary": "Mail & collaboration" · "Tenant, domains, users, and shared resources" · "Service scope"; "Protection layer" · "Authentication, filtering, policy, and awareness controls" · "Control layer". Gate "Message decision": "Apply the mail-security controls and investigation path available in the environment". Scope: Mailboxes · Domain authentication · Shared resources · User awareness. Management: Configuration review · Filter/policy tuning · Awareness support where included. Signals: Suspicious messages · Forwarding changes · Account-related alerts. Outputs: Mail posture findings · Configuration actions · User/security follow-up.
4. **Browser & Web** (short "Browser & web", phone "Browser", Globe) — answers "web-borne compromise". Purpose: "Reduce web-borne risk on managed devices: filtering, browser policy, and safe access to the SaaS the business actually runs on." Questions: "Is web or DNS filtering enforced on managed devices?" / "Which browser settings and extensions are controlled?" / "How is business SaaS access separated from personal browsing?" Boundary "Web boundary": "Browsers & SaaS access" · "Managed browsers, business web applications, and sessions" · "Access scope"; "Filtering & policy layer" · "Web/DNS filtering, browser policy, and extension control" · "Control layer". Gate "Web decision": "Apply the filtering and browser policy appropriate to the role and the device". Scope: Managed browsers · Web/DNS filtering · Extension policy · Business SaaS access. Management: Policy baseline · Filter tuning · Exception handling. Signals: Blocked destinations · Policy drift · Risky extensions. Outputs: Web posture findings · Policy actions · Exception record.
5. **Network** (Wifi) — answers "lateral movement". Purpose: "Document and manage the business network so internet edge, switching, Wi-Fi, segmentation, and remote access match the operating model." Questions: "Who owns and administers the network equipment?" / "Are guest/IoT/business networks separated appropriately?" / "Is the configuration documented and recoverable?" Boundary "Network boundary": "Internet edge" · "Firewall/router and provider handoff" · "Edge layer"; "LAN & wireless" · "Switching, Wi-Fi, segmentation, and devices" · "Internal layer". Gate "Traffic decision": "Apply documented network policy and segmentation appropriate to the client environment". Scope: Firewall/router · Switching · Business/guest Wi-Fi · Remote-access configuration. Management: Configuration management · Firmware/change planning · Network documentation. Signals: Availability alerts · Configuration exceptions · Unexpected network behavior. Outputs: Topology/documentation · Risk findings · Change roadmap.
6. **Detection & Response** (short "Detection & response", phone "Detection", Activity) — answers "persistence". Purpose: "Watch the environment continuously and act on what matters: detection, triage, containment, and escalation through a documented path." Questions: "Who is watching, and around the clock?" / "What is the containment authority and the escalation path?" / "Are detections tuned to this environment or generic?" Boundary "Monitoring boundary": "Telemetry sources" · "Endpoint, identity, email, and network signals in scope" · "Signal scope"; "Detection & response layer" · "Analysts, playbooks, containment, and escalation" · "Response layer". Gate "Response decision": "Follow the documented playbook and containment authority for the event". Scope: Endpoint & identity telemetry · Alert triage · Containment actions · Escalation path. Management: Detection tuning · Playbook maintenance · Incident communication. Signals: Confirmed detections · Containment events · Escalations. Outputs: Incident summaries · Response evidence · Tuning changes.
7. **Human Risk** (short "Human risk", phone "Human", Users) — answers "social engineering". Purpose: "Make people a managed control: awareness, simulation, and a reporting path that fit the organization rather than a checkbox." Questions: "Do users know how to report a suspicious message?" / "Is training matched to role and risk?" / "Are results used to adjust controls, not to assign blame?" Boundary "People boundary": "Users & roles" · "Who handles what, and what they are exposed to" · "Role scope"; "Awareness & simulation layer" · "Training cadence, simulations, and the reporting path" · "Control layer". Gate "Awareness decision": "Apply the training cadence and simulation scope agreed for the organization". Scope: Awareness training · Phishing simulation where included · Reporting path · Role-based guidance. Management: Campaign cadence · Content selection · Results review. Signals: Simulation results · Reported messages · Repeat-risk users. Outputs: Awareness summary · Training evidence · Follow-up actions.
8. **Risk & Exposure** (short "Risk & exposure", phone "Risk & exposure", Search, `continuous: true`) — answers "unknown exposure". Purpose: "The continuous visibility and intelligence layer beneath the other seven: what is exposed, what is unpatched, what changed, and what that means for the business." Questions: "What is exposed to the internet right now?" / "Which findings are open, and who owns them?" / "How is risk reported in business terms?" Boundary "Visibility layer": "Exposure & vulnerability data" · "External exposure, vulnerability posture, and configuration drift" · "Evidence scope"; "Risk register & priorities" · "Findings, owners, and priorities in business terms" · "Intelligence layer". Gate "Risk decision": "Prioritize by exposure and business impact, then route the finding to the block that owns it". Scope: External exposure · Vulnerability posture · Configuration drift · Risk register. Management: Scan review · Prioritization · Roadmap upkeep. Signals: New exposures · Aging findings · Material changes. Outputs: Risk summary · Exposure findings · Prioritized roadmap.

### 6b. "How protection works" (`id="how-protection-works"`)

**Field:** `de-process-band` (surface band, violet/magenta top glows, hairlines top and bottom).

- Eyebrow (magenta ink): "How protection works"
- H3: "Assessment → Roadmap → Implementation → Continuous"
- Right link: "Full methodology" + arrow → `/solutions/proactive-ecosystem`
- Ordered list, 1→2→4 columns, lg columns separated by hairlines; each step is a link tile: mono number, magenta-tinted icon well (44px, magenta glow), title, description:
  1. "01" Search — "Assessment" — "Review identity, endpoints, email, backups, network, and operating reality." → `/book`
  2. "02" FileText — "Roadmap" — "Match the operating model to the environment — fit, not a ranking ladder." → `/solutions/proactive-ecosystem`
  3. "03" Settings — "Implementation" — "Documented credentials you own. Controls sized to the model we matched." → `/solutions/proactive-ecosystem`
  4. "04" Activity — "Continuous" — "Day-to-day support and the DE Security Foundation are included at every tier; detection, response, recovery, and governance deepen with the plan." → `/solutions/proactive-ecosystem`

No images.

---

## 7. DigeratiTestimonialsSection — `testimonials` / "Proof" (not in nav)

File: `client/src/pages/sections/DigeratiTestimonialsSection.tsx` (`data-testid="section-client-proof"`). Reviews data: `client/src/data/reviewsCatalog.ts` (+ `yelpReviewsManual.ts`, `thumbtackReviewsManual.ts`), `client/src/components/ReviewsCarousel.tsx`.

**Field:** `de-dark-well de-chapter-hairline de-field-grain`, centered header.

**Header:**
- Eyebrow (magenta ink, wide tracking): "Client proof"
- H2 (bold 3xl→5xl): "**Outcomes** Arizona businesses hire us for" — accent on "Outcomes"
- Para: "Fewer vendors, clearer security visibility, and accountable support when something breaks — backed by real client reviews from Google, Yelp, and Thumbtack."

**Reviews slot** (`id="google-reviews"`, raised card). **LIVE DATA:** `GET /api/public/reviews` (8s timeout) merging live Google Places, optional Yelp Fusion, and the verbatim catalog; on failure it falls back to the catalog.
- Loading: spinner + "Loading reviews…"
- Populated state: "Client reviews"; optional "{rating} · {N} on Google" (or "{rating} avg on Google") only when Google returns a rating; "From {Source}" + " (published with permission)" when only one source and all catalog; source chips "All" / Google / Yelp / Thumbtack (only if ≥2 sources); carousel of review cards (5 amber stars, uppercase source tag, "“{text}”", "{author} · {relativeTime}", dot tabs, prev/next); links "Read us on Google" / "Read us on Yelp" / "Read us on Thumbtack" (Yelp/Thumbtack only when a listing URL exists).
- **Empty state (what renders today):** "Client reviews" / uppercase "Google · Yelp · Thumbtack" / "We publish only real client reviews — never placeholders. Highlights from Google, Yelp, and Thumbtack appear here as a single feed when live API or approved catalog entries are available." / white button "Read us on Google" + arrow → https://maps.google.com/?cid=1710856351091471339.
- Reality check: `reviewsCatalog` is empty (`googleManualReviews`, `yelpReviewsManual`, `thumbtackReviewsManual` are all `[]`), `YELP_LISTING_URL` and `THUMBTACK_LISTING_URL` are `""`, and Google Places cannot answer for this service-area listing (`docs/GOOGLE-REVIEWS.md`), so the empty state is the real current render. Do not mock quotes.

**Outcomes card** (raised, Quote icon): "What clients hire us to improve"; 3-column list:
1. "Fewer vendors to manage" — "One accountable team for IT support and security operations."
2. "Clearer security visibility" — "Identity, endpoint, email, and backup posture you can actually explain."
3. "Faster triage when something breaks" — "Named ownership and documented standards — not ticket roulette."

**Case studies band** (white/10 border, gradient): Building2 icon; "Case studies" — "See how we approach real Arizona engagements — challenge, approach, and outcome."; buttons outline "View case studies" → `/resources/case-studies`; magenta "Get My Cyber Risk Assessment" → openBooking("proof_section"). (Note: per `docs/CLAIMS-REGISTER.md`, `publishedCaseStudies` is empty — the link goes to a page, not to published studies.)

**Link row:** "Client Bill of Rights" → `/about/client-bill-of-rights` · "Our Guarantee" → `/about/guarantee` · "Trust Center" → `/trust/trust-center` · "Browse industries" → `/industries/healthcare`.

**Footer line:** "Serving professional services, healthcare, construction, nonprofit, and regulated organizations across Greater Phoenix · 325-480-9870"

No images.

---

## 8. HomepageProofSection — same `testimonials` chapter (`id="proof"`)

File: `client/src/pages/sections/HomepageProofSection.tsx`.

**Field:** `de-dark-well de-chapter-hairline de-field-grain`, max-w 7xl, centered.

- Eyebrow: "Trust & transparency"
- H2 (3xl→5xl): "Built for accountability you can verify**:**" (magenta colon)
- Para: "Ownership clarity, documented operations, and public surfaces you can open before you engage — not marketing claims you have to take on faith."
- Radix **Tabs** (2-col grid on mobile, wrapped row on lg; aria "Trust and transparency surfaces"; each trigger has a small bordered icon box that fills magenta when active). Panel = `IconWell` + H3 + body + CTA link:
  1. Star — "Client reviews" — "Real client feedback from Google and other approved sources — shown only when we have live API data or verbatim published reviews." — "See reviews" → `/#google-reviews`
  2. Scale — "Client Bill of Rights" — "Your credentials, tenants, and licenses stay yours — with access transparency and a clear path if you ever need to transition." — "Read the Bill of Rights" → `/about/client-bill-of-rights`
  3. ShieldCheck — "Trust Center" — "Security documentation and operating expectations in one place for diligence and cyber-insurance conversations." — "Open Trust Center" → `/trust/trust-center`
  4. FileText — "Case studies" — "Real engagements with challenge, approach, and outcome — published with client permission." — "View case studies" → `/resources/case-studies`
- Quiet nav row under a hairline (aria "Open a trust surface") repeating all four CTAs in white/50.

No images.

---

## 9. DigeratiTrustPhotoSection — `trust` / "Trust" (not in nav)

File: `client/src/pages/sections/DigeratiTrustPhotoSection.tsx`.

**Field:** `de-dark-well` → `de-paper-island`; 2-column grid from lg (copy left, photo right, equal stretch).

- Eyebrow (Shield icon + bold `#A30E52`): "Why Arizona businesses work with us"
- H2 (bold 3xl→5xl): "Protection that fits **how you actually operate.**" — second phrase is a solid magenta span (`text-[#D3126A]`), not the gradient
- Para: "From medical practices to law firms to family-owned offices, we protect the businesses Arizona runs on—the ones that cannot afford downtime, a breach, or lost client data."
- Three pillars (magenta-tint icon box 36px, title, detail):
  1. MapPin — "Arizona-based" — "Local principal support for businesses that need a real person, not a ticket queue."
  2. UserCheck — "Principal-led" — "Recommendations come from the people who will stand behind the work."
  3. Scale — "Sized to your business" — "Controls and tooling matched to your risk—not an enterprise stack you will not use."
- Magenta button "Get My Cyber Risk Assessment" + arrow → `/book`
- Photo panel (4:3 on mobile, full height on lg, radius 2xl, parallax 6px): `ParallaxStill` of `attached_assets/de-trust-assessment-desk-960.webp` (960×640, 41 KB; PNG master `de-trust-assessment-desk.png` in repo), alt "Principal-led cyber risk assessment work for an Arizona business"; bottom gradient caption: "Principal-led assessments sized to how your business runs" / "Arizona MSP · Cybersecurity & Managed IT".

**Image provenance is contested in the docs:** `docs/VISUAL-ASSET-INVENTORY.md` (2026-08-08) calls it "real scene, not founder"; `scrollcraft/builds/de-v2/BRIEF.md` lists it under "Photography (real)"; but `docs/CLAIMS-REGISTER.md` (Version 6 row, 2026-10-01) lists "the generated office and desk stills" among items removed for lacking a source. Treat as unverified until Joe confirms; it is not a photo of DE staff.

---

## 10. DigeratiMeetExpertsSection — `team` / "Team" (not in nav)

File: `client/src/pages/sections/DigeratiMeetExpertsSection.tsx` (`data-testid="section-meet-experts"`).

**Field:** `de-dark-well de-chapter-hairline de-field-grain` with a `de-founder-seam` magenta seam at the top. Grid 12 cols from lg: photo card 5 cols (self-start), text 7 cols.

- Pill eyebrow (magenta/10 bg, pulsing magenta dot): "Human Trust & Ownership"
- H2 (bold 3xl→5xl): "The people behind **your technology**" — accent on "your technology"
- Para: "When something happens, you should know who owns it — not wonder which anonymous queue picked up your ticket. **Meet the team**" (underlined link → `/about/team`)
- **Founder card** (radius 2xl, white/15 border, gradient `#1a1522 → #0e0c13`): top-left glass badge MapPin "Chandler, Arizona HQ"; image `/images/founder/joe-petro-studio-blazer-white.jpg` (`client/public/images/founder/`, 768×1024 attr, 3:4 crop, `object-[center_20%]`; a `.webp` sibling exists), alt "Joseph Petro, Founder of Digerati Experts" — **real photo** (approved per `docs/CLAIMS-REGISTER.md`); bottom gradient: "Joseph Petro" / uppercase magenta "Founder & Chief Technology Strategist".
- H3 (bold 3xl→2.75rem): "Principal-Led Managed Security Operations"
- Para: "Based right here in Chandler, Arizona. Joe stays directly involved in risk assessments, infrastructure architecture, and key client milestones — so growing organizations get elite cybersecurity-first managed IT without becoming account number four thousand."
- Three role cards (1→3 cols, gradient `#18141f → #0e0c13`, icon box + mono index):
  1. "01" ShieldCheck — "Security Operations" — "Monitoring, detection, and response ownership when threats appear."
  2. "02" Cpu — "Technical Operations" — "Day-to-day support, identity, endpoints, and environment stability."
  3. "03" Users — "Client Success" — "QBRs, roadmaps, and a named relationship — not a rotating ticket queue."
- Gradient magenta button "Talk to an Expert" + arrow → openBooking("meet_experts")

Only one named person on the page; no other team photos exist in the repo.

---

## 11. DigeratiIndustriesSection — `industries` / "Industries"

File: `client/src/pages/sections/DigeratiIndustriesSection.tsx`.

**Field:** `de-dark-well de-field-grain` → `de-style-box` (charcoal box), centered header.

- Pill (raised, Briefcase icon): "Specialized Solutions"
- H2 (bold 2xl→5xl): "Industries We Serve**:**" (magenta colon)
- Para: "Specialized cybersecurity solutions for Arizona's essential sectors"
- **Desktop (lg+):** 5-column grid of photo cards (h-72, radius 2xl, hairline → magenta on hover). Background image is **grayscale, colour on hover/focus**, with a black gradient from the bottom; content bottom-aligned: icon box (48px, `#0a0a0a/80`), name, description, "View {name}" + arrow. Each card → `/industries/{slug}`.
- **Mobile/tablet:** horizontal snap-scroll row of 280×320 cards, round prev/next buttons ("Scroll left"/"Scroll right"), gradient fade edges, five inert dots under the row.
- Cards:
  1. Briefcase — "Law Firms" — "Protect client privilege and meet ABA compliance requirements" — `/industries/law-firms` — image `attached_assets/Rectangle-152058-1_1767027918697.webp` (law scales)
  2. Calculator — "CPA Firms" — "Secure tax data and ensure IRS/FTC compliance" — `/industries/accounting-finance` — `Rectangle-152058_1767027918697.webp` (law books)
  3. Stethoscope — "Medical Practices" — "HIPAA compliance and patient data protection" — `/industries/healthcare` — `Rectangle-152058-2_1767027918698.webp` (healthcare)
  4. Home — "Real Estate Firms" — "Wire fraud prevention and transaction security" — `/industries/real-estate` — `Rectangle-152058-3_1767027918698.webp` (real estate)
  5. Heart — "Animal Hospitals" — "Veterinary practice and client data protection" — `/industries/animal-hospitals` — `Rectangle-152058-4_1767027918698.webp` (animal hospital)
- Magenta button (h-12/14): "Get Industry-Specific Protection" + arrow → `/book`

**Images:** five small WebPs (8–14 KB each) named after a Figma rectangle export. `docs/CLAIMS-REGISTER.md` (v6 row) calls them "the industry stock photographs" — i.e. stock, not DE photography. The nav lists six industries (Healthcare, Law Firms, Accounting, Real Estate, Nonprofits, Professional Services); the homepage shows five, including Animal Hospitals which is not in the nav.

---

## 12. DigeratiPricingSection — `pricing` / "Packages"

File: `client/src/pages/sections/DigeratiPricingSection.tsx`; rail `client/src/components/EcosystemProgression.tsx` (`detailed`); data `client/src/data/pricing.ts`.

**Field:** `de-dark-chapter de-chapter-hairline de-field-grain`; the rail sits in a bordered surface box (`rounded-2xl border hairline bg-[var(--de-surface)]`), then a hairline-divided footer row.

**EcosystemProgression (detailed):**
- Eyebrow (magenta ink): "ProActive Ecosystem"
- H2 (2xl→4xl): "Four operating models. One matched to your environment."
- Para: "We do not start with a package and pile on add-ons. If Office would need heavy modification, Business is the correct fit for that environment — not universally “better.” User count is a signal, never the sole criterion."
- Ordered grid 1→2→4 of tier tiles (mono index; **Business** is flagship: magenta/60 border + badge "Flagship Cyber"); each tile: name, "$N/user/mo", "$N monthly minimum", fit line, 3 highlights with magenta dots, link label = tier `label` + arrow → `learnMoreUrl`:
  1. "01" **IT** — $125/user/mo — $1,600 monthly minimum — "Smaller, less complex environments that need essential protection and a documented baseline." — Managed IT & help desk · Baseline identity & endpoint · Entry cybersecurity — "ProActive IT" → `/solutions/proactive-it-ecosystem`
  2. "02" **Office** — $165/user/mo — $2,400 monthly minimum — "Broader managed workplace — more users, devices, and a professionally operated network." — Everything in IT · Managed network · Endpoint backup — "ProActive Office" → `/solutions/proactive-office-ecosystem`
  3. "03" **Business** (Flagship Cyber) — $245/user/mo — $5,400 monthly minimum — "Deeper infrastructure, cyber operations, recovery, governance, and strategy." — Identity · endpoint · email / SOC / MDR / BCDR · strategy reviews — "ProActive Business" → `/solutions/proactive-business-ecosystem`
  4. "04" **Enterprise** — $345/user/mo — $9,000 monthly minimum — "Multi-site, regulated, or security-sensitive environments that need the greatest operating depth." — Advanced governance · Audit-ready reporting · Quarterly strategy — "ProActive Enterprise" → `/solutions/proactive-enterprise-ecosystem`
- Para under grid: "Not sure which package fits? We assess your environment — users, devices, locations, infrastructure, security, compliance, recovery, and whether you need fully managed or co-managed operations — then match the model."

**Footer row:**
- H3: "Not just IT support — one operating model"
- Para: "ProActive Business consolidates capabilities organizations often buy separately: managed IT, workplace, identity, endpoint security, email security, network security, backup & recovery, security operations, and technology + cyber strategy — one accountable partner."
- `PRICING_SCOPE_NOTE`: "Final pricing depends on users, endpoints, locations, infrastructure, backup requirements, and security/compliance scope. Estimates are not quotes — your Cyber Risk Assessment confirms final scope."
- Buttons: magenta "Compare Everything" + arrow → `/proactive-ecosystem-pricing`; outline "Pricing tools" → `/proactive-ecosystem-pricing#pricing-tools`.

**Extra tier data in `pricing.ts` (not rendered on `/`, usable in mockups):** tier badges Entry / Foundation / Operations / Compliance; `note` lines ("Essential managed IT with the DE Security Foundation included — a fit when the environment is smaller and less complex." / "Managed workplace and stronger protection when Office is the right operating depth — not a ranking." / "The fit when Office would need heavy modification — deeper ops, not universally better." / "Greatest operating depth for complex, regulated, or security-sensitive environments."); full inclusions — IT: Service desk & issue ownership · DE Security Foundation included · Managed endpoint, identity, email, and security monitoring baseline · Security awareness and phishing resilience · Documented environment basics · Clear upgrade path into Office. Office: Everything meaningful in IT, plus · Managed network & connectivity · Stronger MFA / SSO / password hygiene · Advanced email anti-phishing · DE Security Foundation with 24/7 managed detection and response · Security awareness and phishing resilience · Endpoint backup · Annual technology + cyber review. Business: Everything in Office, plus · DE Security Foundation with 24/7 managed detection and response · Enhanced security operations / threat detection · Security awareness training · Backup & disaster recovery posture · Compliance / risk reporting support · Semi-annual technology + security reviews. Enterprise: Everything in Business, plus · Unified security posture reporting · Advanced compliance / risk reporting · Custom BCDR architecture support · Privileged access program elements · Quarterly executive reviews. Tagline `NO_BLACK_BOX_TAGLINE`: "No Black-Box IT. You know what you're buying, what you're paying, what's included, and who owns it."

No images.

---

## 13. DigeratiThreatsInsightsSection — `insights` / "Insights" (not in nav)

File: `client/src/pages/sections/DigeratiThreatsInsightsSection.tsx`; hook `client/src/hooks/useThreatFeed.ts`; types `shared/threatFeed.ts`.

**Field:** `de-dark-well de-chapter-hairline de-field-grain`, `container`, centered header. Cards are **white paper-on-well** tiles.

- Badge (red tint, Zap icon): "24/7 Security Response Team"
- H2 (bold 2xl→5xl): "Recent Threats & Insights**:**" (magenta colon)
- Para (gray-400): "Current items prioritized by active exploitation, exploit probability, and SMB relevance. Full stream, dates, and sources live on **Security Updates**." (underlined link → `/resources/security-updates`)
- Category filter chips (only when more than two categories are present): "All" + any of Active Exploitation · Threat Advisory · Critical Vulnerability · Malware Activity · Ransomware · Microsoft Security · Digerati Advisory.
- **LIVE DATA:** `GET /api/public/threats?scope=homepage` (10s timeout). Scoring from CISA KEV, CISA advisories, FIRST EPSS, NIST NVD, Microsoft MSRC; homepage shows at most 4 items, score ≥ 40, published within 45 days.
- Loading state (white card): "Loading current threats…" / "Checking CISA, FIRST, NVD, and Microsoft MSRC. Nothing is invented while this loads."
- **Empty state** (white card): "No current items meet the homepage threshold." / "We only promote threats with confirmed exploitation, high exploit probability, or clear SMB relevance — and only within the last 45 days. The full stream stays on Security Updates with dates and sources."
- Card anatomy (white, 1px magenta gradient top rule, radius xl): category badge with icon (severity colours: critical = red tint, high = magenta outline, watch = hairline) · calendar date (`formatThreatDate`) · magenta uppercase kicker · title (2-line clamp) · excerpt (3-line clamp) · footer mono "{sourceName} · {vendor} · {cve}" + "Read source" external link. Desktop: 4-col grid when ≥4 items else 3-col; mobile: 300/340px snap-scroll row with arrows.
- Attribution line (always shown): "Sources: CISA, NIST NVD, FIRST, and Microsoft MSRC. Digerati prioritizes items based on active exploitation, exploit probability, and relevance to SMB environments."
- Buttons: magenta "View All Security Updates" + arrow → `/resources/security-updates`; outline "Read the Digerati Journal" + arrow → `/resources/blog`.

Mock with the empty state or with clearly labelled sample cards; never invent CVEs.

---

## 14. DigeratiAIAssistanceSection — same `insights` chapter

File: `client/src/pages/sections/DigeratiAIAssistanceSection.tsx`.

**Field:** `de-dark-chapter de-chapter-hairline de-field-grain de-field-lit`; 2-col grid from lg (image left, copy right; on mobile copy first).

- Pill (Radio icon): "Detection & Response"
- H2 (bold 3xl→5xl): "Monitoring that ends with a person who owns the outcome" (no accent)
- Para: "We leverage modern threat detection tooling so signals surface immediately — then our team investigates, prioritizes, and acts. Technology scales coverage; accountability remains human."
- Checklist (green CheckCircle):
  - "Partner-backed detection and alerting across endpoints and identity"
  - "Human triage — analysts decide what matters before you get a false alarm"
  - "Prioritized remediation guidance tied to your environment"
  - "Documented response paths when something needs escalation"
- Two white `de-paper-on-well` cards (magenta top rule, icon box):
  1. Shield — "Coverage with Context" — "Alerts are interpreted against your specific environment — never dumped into an unmonitored ticket queue."
  2. Layers — "Documented Next Steps" — "Findings translate into actionable steps your executive and IT teams can execute without decoding cryptic jargon."
- Gradient magenta button "Get My Cyber Risk Assessment" + arrow → openBooking("ai_assistance_section")
- Image panel (4:3, min 18rem, radius 2xl): glass badge with pulsing green Activity icon "Arizona SOC Operations"; `ParallaxStill` of `attached_assets/de-arizona-office-evening-960.webp` (960×640, 39 KB; PNG master in repo), alt "Arizona professional office where Digerati Experts supports local businesses"; caption "Local Operations · Human Judgment" / "Arizona-Based · Principal-Led · Always-On Telemetry".

**Image provenance:** same conflict as §9 — the scrollcraft brief calls it real photography, the claims register calls the office still "generated". Unverified; it is not a photo of a DE SOC.

---

## 15. DigeratiLeadFormSection — `id="assessment-form"` (not in `homepageSections`)

File: `client/src/pages/sections/DigeratiLeadFormSection.tsx`. Rendered after the insights chapter and before FAQ.

**Field:** `de-dark-well` → `de-paper-island`; inner `de-paper-lift-lg` card (max-w 4xl, centered header).

- Eyebrow (magenta): "Cyber Risk Assessment"
- H2 (3xl→5xl): "Get Your Free Security Assessment"
- Para: "Discover vulnerabilities before attackers do. Our experts will analyze your security posture and provide actionable recommendations."
- Proof strip inside the card (white bordered, 1→3 cols, magenta dashes): "Independent findings" · "No switch required" · "Arizona-based experts"
- Form (2-col from sm): "Full Name *" (placeholder "John Smith") · "Work Email *" ("john@company.com") · "Phone (Optional)" ("(555) 123-4567") · "Company (Optional)" ("Acme Corp"). Validation: name 2–50 chars ("Name must be at least 2 characters" / "Name must be less than 50 characters"), email ("Please enter a valid email address").
- Submit (full width, h-14, magenta): "Get My Cyber Risk Assessment" + arrow; submitting "Submitting...".
- Benefits row under the button (magenta icons): Shield "Complimentary security assessment" · Clock "Results in 24-48 hours" · CheckCircle "No obligation, no credit card".
- Below card: "Prefer to call? **325-480-9870**" (tel).
- **Submits** `POST /api/assessment` `{ fullName, email, phone, company, source: "lead_form" }`. Toast success: "Assessment Request Submitted!" / "We'll contact you within 24 hours to schedule your Cyber Risk Assessment." Error: "Error" / "Something went wrong. Please try again later."

Flag: `docs/CLAIMS-REGISTER.md` lists "Results in 24-48 hours" as having no source (removed from the v6 preview). Keep it in the mock only if the designer is reproducing the live page as-is.

No images.

---

## 16. DigeratiFAQSection — `faq` / "FAQ" (chapter, not in nav)

File: `client/src/pages/sections/DigeratiFAQSection.tsx` (emits FAQ JSON-LD).

**Field:** `de-dark-well` → `de-paper-island`, max-w 4xl, centered header; accordion rows are `de-paper-faq-item` (white lift, magenta rail) with a round magenta-tint chevron button; one open at a time, none open by default.

- Eyebrow (magenta): "Common questions"
- H2 (3xl→5xl): "Frequently Asked Questions"
- Para: "Straight answers on how we work, what we recommend, and why."
- Q&A:
  1. **"What is your best service?"** — "There isn’t a universally “best” package. ProActive is four operating models — IT, Office, Business, and Enterprise — matched to users, devices, locations, infrastructure, security, compliance, and whether you need fully or co-managed coverage. If Office would need heavy modification, Business is the correct fit for that environment, not a higher rank."
  2. **"How do I choose the right plan for my business?"** — "User count is a signal, never the sole criterion. We start with a Cyber Risk Assessment of your environment, then match IT, Office, Business, or Enterprise. We do not start with a package and pile on add-ons."
  3. **"Can I customize the solutions?"** — "Yes! We understand every business is unique. Our packages can be customized with additional services, and we offer both co-managed and fully managed options to fit your existing IT structure."
  4. **"Is my data secure?"** — "Yes. We use enterprise-grade controls, 24/7 monitoring, and documented security protocols. We help Arizona businesses prepare for HIPAA, PCI DSS, SOC 2, and cyber-insurance reviews — with clear ownership of credentials, policies, and evidence."

No images.

---

## 17. DigeratiNewsletterSection — same `faq` chapter (`id="newsletter"`)

File: `client/src/pages/sections/DigeratiNewsletterSection.tsx`; cities `client/src/data/greaterPhoenixCities.ts`.

**Field:** `de-dark-chapter de-chapter-hairline de-field-grain`, `container`.

**Top block — compliance support:**
- H2 (xl/2xl): "Security & Compliance Support**:**" (magenta colon)
- Para: "Framework names describe customer requirements Digerati Experts helps organizations address — not certifications DE holds."
- Outline chips: "HIPAA-aligned security and compliance support" · "SOC 2 readiness and control alignment" · "Cyber insurance readiness" · "Security and compliance reporting"
- Partner marks (plain outline chips, text only, no logos): "Microsoft Partner" · "Apple Consultants" — flagged in `docs/CLAIMS-REGISTER.md` as unsupported badges (removed on v6).

**Two-column grid (lg):**
1. **Stay Updated card** (surface box): `IconWell` Mail + uppercase "Monthly · Arizona operators"; H2 "Stay Updated**:**" (magenta colon); para "Get the latest cybersecurity insights and IT tips delivered to your inbox."; form: paper input placeholder "Enter your email" (sr label "Email address") + magenta button "Subscribe" (Mail icon) / "Subscribing..."; success state: shield in a ring, "You're Subscribed!", "Check your inbox for a confirmation email. Welcome to our security community!", ghost link "Subscribe another email"; benefit chips with magenta icons: "Security Alerts" · "Best Practices" · "Industry Trends" · "Expert Insights"; footnote "Monthly security notes for Arizona operators." / "Unsubscribe anytime. We respect your privacy." Submits `POST /api/newsletter` `{ email }`; toast "Successfully Subscribed!" / "You'll receive our security updates and expert insights." or "Error" / "Failed to subscribe. Please try again."
2. **Serving Greater Phoenix card:** H2 "Serving Greater Phoenix**:**" (magenta colon); 2→3 col grid of large city chips (min-h 12/16/20): Chandler (highlighted magenta border) → `/locations/chandler-az` · Phoenix → `/locations/phoenix-az` · Gilbert → `/locations/gilbert-az` · Tempe → `/locations/tempe-az` · Mesa → `/locations/mesa-az` · Scottsdale → `/locations/scottsdale-az`.

No images.

---

## 18. DigeratiCTASection — `cta` / "Next step" (not in nav)

File: `client/src/pages/sections/DigeratiCTASection.tsx`.

**Field:** `de-dark-well` → `de-paper-island`, max-w 3xl, left-aligned.

- Eyebrow (magenta): "Cyber Risk Assessment"
- H2 (3xl→5xl): "Start with a Cyber Risk Assessment"
- Para: "Discover identity, endpoint, email, backup, and operating gaps before you buy a package."
- Para (muted): "Assessment-led recommendations. Final scope confirmed after we see the environment."
- Bold line: "Serving Arizona professional services, healthcare, and growing SMBs."
- White bordered list card, 2-col from sm, magenta dashes: "Audit readiness support" · "Microsoft-aligned stack" · "HIPAA-minded controls" · "Documented standards"
- Form: label "Work email"; input with Mail icon, placeholder "name@company.com"; inline errors "Enter your work email." / "Enter a valid work email."; magenta button "Get My Cyber Risk Assessment" + arrow. **Behaviour:** validates the email client-side then calls openBooking("homepage-cta") — the email is not posted anywhere.
- Hairline footer row: left link "Or send a message below" → `#contact`; right "Prefer to call? **325-480-9870**" (tel).

No images.

---

## 19. DigeratiContactSection — `contact` / "Contact"

File: `client/src/pages/sections/DigeratiContactSection.tsx` (`data-testid="homepage-contact-chapter"`).

**Field:** `de-dark-well de-chapter-hairline de-field-grain`; background = the hero's Phoenix city-lights plate again (`de-hero-arizona-dusk-1600.webp`) at 14% opacity, `objectPosition center 70%`, masked to fade in from the bottom, plus violet/magenta radial drift. 12-col grid from lg: copy 6 / form 6.

**Left column:**
- Eyebrow (`#F04C97`): "Contact"
- H2 (3xl/4xl): "Ready to Secure Your Business?" (as h1 on the contact page the "?" is accent-coloured; on the homepage it is plain)
- Para: "Located in the heart of Chandler, we're your local cybersecurity experts. Whether you need immediate help or want to explore our services, we're here for you."
- Buttons: magenta "Get My Cyber Risk Assessment" + arrow → `/book`; outline "Call 325-480-9870" → tel.
- Directory (hairline grid, 2 cols on md; `IconWell` + uppercase label + value):
  - Mail — "Email" — info@digeratiexperts.com → mailto
  - Phone — "Phone" — 325-480-9870 → tel
  - MapPin — "Office" (spans 2 cols) — "3165 S Alma School Rd Suite 29, Chandler, AZ 85248" → https://maps.google.com/?cid=1710856351091471339 (new tab)
- "Office Hours" (Clock `IconWell`): dl — "Monday - Friday" / "7:00 AM - 6:00 PM MST" · "Saturday & Sunday" / "Emergency Support Only"; accent line with Shield icon: "24/7 Security Operations Center Always Active"
- "Follow us:" square icon buttons LinkedIn · Facebook · Twitter (hrefs from `COMPANY_SOCIAL`).

**Right column — form card** (`de-paper-lift-lg`, white):
- H3: "Get in Touch"
- Para: "Tell us about the environment. We'll follow up on a Cyber Risk Assessment — no hard sell."
- Fields: "Your Name *" ("John Smith") · 2-col: "Business Email *" ("john@company.com") + "Phone Number *" ("(480) 000-0000"; regex-validated "Please enter a valid phone number") · "Company Name" ("Your Company Inc.") · "Service Interested In" select, placeholder "Select a service", options: Managed Security Services · Managed IT Services · Compliance & Governance · Incident Response · Security Assessment · "Message" textarea 4 rows ("Tell us about your security needs..."; 10–500 chars).
- Submit (full width, ink `#1A1228` → magenta on hover): "Send Message" / "Sending...".
- **Submits** `POST /api/contact`. Toast "Message Sent Successfully!" / "We'll get back to you within 24 hours." Error: "Error" / "Failed to send message. Please try again or call us directly."

---

## 20. DigeratiEnhancedFooterSection — same `contact` chapter

File: `client/src/pages/sections/DigeratiEnhancedFooterSection.tsx` (`<footer>`).

**Field:** `de-dark-well de-chapter-hairline`, max-w 1440. Grid: brand block 4/12, four link columns 2/12 each (2-col on md, 1-col on mobile).

**Brand block:** logo `DE_LOGO_REVERSE` (SVG, h-12, alt "Digerati Experts Logo"); "Digerati Experts"; "Arizona MSP · Cybersecurity & Managed IT"; link "Chandler, Arizona" → `/locations/chandler-az`; magenta `BookingLink` "Get My Cyber Risk Assessment" → `/book` (source "footer"); mini newsletter: uppercase "Stay Updated", "Get the latest cybersecurity insights and IT tips delivered to your inbox.", dark input "Enter your email" + white button "Subscribe" (Send icon), success "Thank you for subscribing!" (posts `/api/newsletter`); social square buttons LinkedIn · Twitter · Facebook · Instagram.

**Columns** (uppercase heads):
- **Client:** Client Portal → https://portal.digeratiexperts.com/portal/login · Submit Ticket → `/support/submit-ticket` · Remote Support → https://assist.zoho.com/ · Pay Invoice → `/support/pay-invoice`
- **Services:** Managed IT → `/solutions/managed-it-support` · Cybersecurity → `/solutions/security-operations` · Compliance & Risk → `/solutions/compliance-reports` · Backup & DR → `/solutions/backup-disaster-recovery`
- **Resources:** Digerati Journal → `/resources/blog` · Cyber Facts → `/resources/cyber-facts` · Knowledge Base → `/support/knowledge-base` · Contact → `/contact`
- **Trust & Legal:** Trust Center → `/trust/trust-center` · Status → `/trust/trust-center` · Vulnerability Disclosure → `/trust/vulnerability-disclosure` · Privacy → `/legal/privacy-policy` · Terms → `/legal/terms-of-use` · MSA → `/legal/msa` · SLA → `/legal/sla`

**Bottom bar** (hairline): "© {currentYear} Digerati Experts · Chandler, Arizona (→ `/locations/chandler-az`) · Accessibility (→ `/trust/accessibility`) · Security (→ `/trust/trust-center`)".

---

## Appendix A — every image on the page

| Where | File | Dimensions / size | What it is | Provenance |
|---|---|---|---|---|
| Hero background; Contact background | `attached_assets/de-hero-arizona-dusk-1600.webp` (PNG master `de-hero-arizona-dusk.png`) | 1600×1067, 50 KB | Phoenix aerial city lights at dusk | Listed as "Photography (real)" in `scrollcraft/builds/de-v2/BRIEF.md`; no license record found in repo |
| Hero right column | `DashboardMockup` (React, no bitmap) | — | Illustrative assessment UI, sample numbers | Code-drawn illustration; labelled "Illustrative preview" |
| Hero PronunciationCard | `client/public/audio/digerati-pronunciation.wav` | 37 KB | Audio, synthesized voice | Not a human recording (`client/public/audio/README.md`) |
| Trust photo | `attached_assets/de-trust-assessment-desk-960.webp` (PNG master) | 960×640, 41 KB | Desk / assessment scene | **Contested**: "real scene" (VISUAL-ASSET-INVENTORY 2026-08-08) vs "generated … desk still" (CLAIMS-REGISTER v6, 2026-10-01) |
| Detection & Response panel | `attached_assets/de-arizona-office-evening-960.webp` (PNG master) | 960×640, 39 KB | Office interior at evening | **Contested**: same two sources disagree |
| Industries ×5 | `attached_assets/Rectangle-152058*.webp` | 8–14 KB each | Scales, law books, healthcare, real estate, animal hospital | "industry stock photographs" per CLAIMS-REGISTER v6 |
| Team | `client/public/images/founder/joe-petro-studio-blazer-white.jpg` (+ `.webp`) | 768×1024 attr, 142 KB | Joseph Petro studio portrait | **Real, approved** (CLAIMS-REGISTER) — the only person photo on the page |
| Nav (Resources rail) | `client/src/assets/images/ebook-defending-digital-realm-cover.webp` | 18 KB | Ebook cover | DE's own ebook art |
| Nav + footer | `brand/digerati-logo-reverse.svg` | SVG | Wordmark | Brand asset |

All other visuals are Lucide icons, `IconWell` tiles, CSS gradients and grain. No client logos, certifications or rating badges exist anywhere on the page.

## Appendix B — live-fetched data and forms

| Section | Endpoint | Honest empty / fallback state |
|---|---|---|
| Testimonials reviews slot | `GET /api/public/reviews` → fallback to empty catalog | Empty state copy in §7; currently what renders |
| Threats & Insights | `GET /api/public/threats?scope=homepage` → empty payload on failure | "No current items meet the homepage threshold." (§13) |
| Lead form | `POST /api/assessment` | — |
| Contact form | `POST /api/contact` | — |
| Newsletter (section + footer) | `POST /api/newsletter` | — |
| CTA section email | none (opens booking modal) | — |
| Booking modal (all `openBooking` CTAs) | iframe to https://meet.digerati-experts.com/ | — |

## Appendix C — claims the register already flags on this page

From `docs/CLAIMS-REGISTER.md` (v6 "Removed on purpose" row): "Results in 24-48 hours" (lead form), "Microsoft Partner" / "Apple Consultants" (newsletter chips), the office and desk stills, the industry stock photographs, and the illustrative assessment dashboard are all live on `/` today but were dropped from the v6 preview for lack of a source. A designer reproducing the live page can keep them; a designer building the next version should not reintroduce them without a source.
