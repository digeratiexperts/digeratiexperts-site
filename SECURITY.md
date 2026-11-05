# Security

This repository is private and holds the DE Tech Tool, which runs elevated on client endpoints.
Treat it as sensitive source; do not mirror it into a public repository, a gist or an AI tool
that keeps or shares what it is given.

## Reporting a problem

Tell Joe (Digerati Experts) directly. Do not open a public issue or post details in a channel
outside DE. Include the file, the commit and what an attacker could do.

## What never goes in this repository

- Private keys, code-signing certificates (`.pfx`, `.p12`, `.pem`, `.key`), licence signing keys.
- Hub secrets (`TECHCONSOLE_TO_HUB_SECRET`, `DE_HUB_SIGNING_SECRET`, `MSADMIN_WORKER_SECRET`) or
  any other value; the configs hold secret *names* only, resolved at runtime from the vault.
- Client data: evidence bundles, logs, device inventories, serials from real machines, PHI.
- Build output: `windows/packaging/out/`, `windows/integrity.json`, `windows/community/`
  (all gitignored).

Release builds carry public keys only; `New-DEReleasePackage.ps1` refuses a JWKS with a
private component. The protection model is in `windows/PROTECTING-THE-TOOL.md`, the agent
threat model in `windows/AGENT-THREAT-MODEL.md`.

## Secret scan at the split (2026-11-05)

Before the first push every unique blob in the filtered history (1,056 blobs, 344 commits, cut from website `main` at `ca244410`)
and every commit message was scanned with `detect-secrets` and a gitleaks-style pattern set
(private-key headers, GitHub, Stripe, Slack, Google, Anthropic, Zoho refresh, Azure storage,
AWS keys, database URLs). No live credential was found. The findings were all test fixtures,
SHA-256 installer pins, secret *names*, redaction regexes, the AWS documentation example key
`AKIAIOSFODNN7EXAMPLE` and the RFC 8032 Ed25519 test vectors. Re-run a scanner on every PR.
