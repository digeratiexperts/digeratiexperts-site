# Public phone retirement: static assets (2026-11-14)
Owner: ChatGPT. Branch: chatgpt/public-phone-static-retirement-20261114.
Scope: public static website assets and Zoho help-center footer template only; 13 paths listed in scripts/public-phone-static-retirement.test.mjs.
Authority: Joe's November 14 public-phone decision. Use [DE_PUBLIC_PHONE] pending a dedicated local 480 business line. Preserve internal/historical records.
Relay: https://github.com/digeratiexperts/Intelligence-Hub/issues/886#issuecomment-6875977726

Implemented: remove retired demo number from this slice; replace dialable phone anchors with noninteractive text, preserve alternate email/assessment paths. No fake tel or schema telephone values.
Checks: in-memory content assertions on all 13 files passed. Added standalone Node regression tests. Full application tests/build and rendered viewport QA NOT RUN. CI pending.
Overlaps: canonical shared/companyContact.ts, React UI, metadata and legal paths remain owned by open PRs #1006, #1019, #1020, #1021, #1022, #1023; owners notified on those PRs. Do not claim full cleanup or live deployment from this draft.
Not changed: internal records, archived designs/reports, production, Zoho published configuration, credentials, pricing.
Next: run node --test scripts/public-phone-static-retirement.test.mjs and normal build/viewport checks, reconcile owner PRs, independently review, then release via existing pipeline and verify public pages.
