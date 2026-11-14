# Digerati Experts agent rules

- Treat `.cursorrules` as the authoritative project policy and follow `AGENTS.md` for the execution loop.
- In Cursor, use the strongest available Thinking model for architecture, security, commerce, data integrity, and critical review. As of this recovery branch, that is Claude Opus 5 Thinking; fall back to the strongest currently available Thinking model rather than a fast visual pass.
- In Antigravity, use `gemini-3.7-flash-high` only for rendered screenshot critique, responsive visual analysis, imagery, and art direction. Use Antigravity's automatic image model only when an actual visual artifact is required.
- Do not send the same routine task to both tools. Duplicate work only for an independent review of security-, tenancy-, or revenue-sensitive changes.
- Never trust browser-supplied prices, roles, tenant IDs, totals, or discounts.
- Run focused tests first, then `npm run check`, `npm test`, `npm run test:advisor`, and `npm run build` before delivery.
- For UI work, verify rendered behavior at 390, 768, and 1440 pixels and preserve the locked Blog and Store palettes.
- Keep `desktop/` independently installable and buildable; never add Electron or its packaging chain back to the web server package.
- Treat Electron as an unprivileged Portal companion. Never expose arbitrary shell commands, executable paths, renderer token storage, or unrestricted filesystem access; privileged MSP actions require the signed broker and controls in `desktop/SECURITY.md`.
- Do not deploy, rotate credentials, or change production data without an explicit delivery checkpoint.
