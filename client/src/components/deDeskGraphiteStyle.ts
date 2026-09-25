/**
 * DE Desk — graphite enterprise shell (C5, 2026-09-12).
 *
 * The widget's base theme is already the graphite shell Joe asked for: near-black
 * surfaces, magenta on primary actions, a compact header, no glow. Three blocks
 * inside it were still hard-coded white — the security-incident card, the
 * "What do you need help with?" issue list, and the Client Tools list — which
 * put cream cards inside a dark shell. This override brings those three onto
 * the same graphite tokens the rest of the shell uses and retires the white
 * sheen/radial hover effects that only make sense on paper.
 *
 * It is applied through the same `customCSS` slot the paper reference style
 * (`deDeskReferenceStyle.ts`) used, so switching between the two is one line in
 * MarketingChrome and the paper file stays available for rollback.
 *
 * Contrast: label #fff and muted rgba(255,255,255,0.72) on #151217 both clear
 * 4.5:1; the magenta icon tint sits on a magenta-8% tinted raised surface.
 */
export const DE_DESK_GRAPHITE_STYLE = String.raw`
  .de-desk-shell {
    --desk-card: var(--de-raised, #151217);
    --desk-card-hover: #1b1720;
    --desk-card-border: var(--de-hairline, rgba(255,255,255,0.10));
    --desk-card-border-strong: rgba(255,255,255,0.18);
    --desk-card-ink: #ffffff;
    --desk-card-ink-muted: rgba(255,255,255,0.72);
    --desk-card-ink-dim: rgba(255,255,255,0.55);
  }

  /* Message timestamps: the base value is below 4.5:1 on the graphite well. */
  .de-desk-msg-time { color: rgba(255,255,255,0.66) !important; }

  /* ---- Possible security incident (pinned card) ---- */
  .de-desk-incident {
    background: var(--desk-card) !important;
    color: var(--desk-card-ink) !important;
    border: 1px solid var(--desk-card-border) !important;
    box-shadow: inset 3px 0 0 #D3126A !important;
  }
  .de-desk-incident::before { display: none !important; }
  .de-desk-incident:hover,
  .de-desk-incident:focus-visible {
    background: var(--desk-card-hover) !important;
    border-color: rgba(211,18,106,0.45) !important;
    box-shadow: inset 3px 0 0 #D3126A, 0 0 0 1px rgba(211,18,106,0.28) !important;
    transform: none !important;
  }
  .de-desk-incident.is-on {
    background: var(--desk-card-hover) !important;
    border-color: rgba(211,18,106,0.55) !important;
    box-shadow: inset 3px 0 0 #D3126A, 0 0 0 1px rgba(211,18,106,0.35) !important;
  }
  .de-desk-incident-icon {
    background: color-mix(in srgb, #D3126A 12%, var(--desk-card)) !important;
    border-color: rgba(211,18,106,0.45) !important;
    color: #ff5aa0 !important;
  }
  .de-desk-incident:hover .de-desk-incident-icon { background: color-mix(in srgb, #D3126A 20%, var(--desk-card)) !important; }
  .de-desk-incident-copy strong { color: var(--desk-card-ink) !important; }
  .de-desk-incident-copy span { color: var(--desk-card-ink-muted) !important; }
  .de-desk-incident-arrow { color: var(--desk-card-ink-dim) !important; }

  /* ---- "What do you need help with?" list ---- */
  .de-desk-issue-list {
    background: var(--desk-card) !important;
    border: 1px solid var(--desk-card-border-strong) !important;
    box-shadow: none !important;
  }
  .de-desk-issue-row {
    background: transparent !important;
    color: var(--desk-card-ink) !important;
    border-bottom: 1px solid var(--desk-card-border) !important;
  }
  .de-desk-issue-row:last-child { border-bottom: 0 !important; }
  .de-desk-issue-row::before,
  .de-desk-issue-row::after { display: none !important; }
  .de-desk-issue-row:hover,
  .de-desk-issue-row:focus-visible {
    background: rgba(255,255,255,0.05) !important;
    box-shadow: none !important;
    transform: none !important;
  }
  .de-desk-issue-row.is-on,
  .de-desk-issue-row.is-on:hover {
    background: color-mix(in srgb, #D3126A 10%, var(--desk-card)) !important;
    color: var(--desk-card-ink) !important;
    box-shadow: inset 3px 0 0 #D3126A !important;
  }
  .de-desk-issue-icon {
    background: color-mix(in srgb, #D3126A 12%, var(--desk-card)) !important;
    border: 1px solid rgba(211,18,106,0.35) !important;
    color: #ff5aa0 !important;
  }
  .de-desk-issue-row:hover .de-desk-issue-icon {
    background: color-mix(in srgb, #D3126A 20%, var(--desk-card)) !important;
    border-color: rgba(211,18,106,0.5) !important;
  }
  .de-desk-issue-label { color: var(--desk-card-ink) !important; }
  .de-desk-issue-arrow { color: var(--desk-card-ink-dim) !important; }

  /* ---- Client Tools list ---- */
  .de-desk-tools-list {
    --desk-ink: var(--desk-card-ink) !important;
    --desk-ink-muted: var(--desk-card-ink-muted) !important;
    --desk-ink-dim: var(--desk-card-ink-dim) !important;
    --desk-border: var(--desk-card-border) !important;
    --desk-border-strong: var(--desk-card-border-strong) !important;
    background: var(--desk-card) !important;
    border: 1px solid var(--desk-card-border-strong) !important;
    box-shadow: none !important;
  }
  .de-desk-tool-group { background: transparent !important; }
  .de-desk-tool-link { --tool-color: var(--desk-card-ink) !important; color: var(--desk-card-ink) !important; }
  .de-desk-tool-link:hover,
  .de-desk-tool-link:focus-visible { background: rgba(255,255,255,0.05) !important; }
  .de-desk-tool-icon {
    background: color-mix(in srgb, #D3126A 12%, var(--desk-card)) !important;
    border: 1px solid rgba(211,18,106,0.35) !important;
    color: #ff5aa0 !important;
  }
`;
