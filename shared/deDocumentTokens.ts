/**
 * DE document system: the tokens and type every DE document shares.
 *
 * One source for the resource PDFs (`scripts/de-documents/`) and the Store
 * client documents (`server/pdf/`). Approved record:
 * `design/approved/de-document-system-2026-10-03.md`.
 */

export const DE_DOC_TOKENS = {
  ink: "#050312",
  ink2: "#2f2c38",
  muted: "#5b5866",
  rule: "#cfccd6",
  hair: "#e4e2e8",
  tint: "#f4f3f6",
  paper: "#F7F5F2",
  paperRule: "#ddd7ce",
  mag: "#D3126A", // brand magenta: rules, bars, marks only (5.2:1 on white)
  magText: "#B80F5C", // magenta for text (6.4:1 on white, 5.9:1 on paper)
} as const;

/**
 * Static font instances in `scripts/de-documents/fonts/` (OFL, licences
 * alongside). Static only: Chromium embeds variable fonts as Type 3, which
 * breaks text extraction and accessibility.
 * [family, file stem, weight, style]
 */
export const DE_DOC_FONT_FACES: readonly (readonly [string, string, number, "normal" | "italic"])[] = [
  ["Inter", "inter-400", 400, "normal"],
  ["Inter", "inter-500", 500, "normal"],
  ["Inter", "inter-600", 600, "normal"],
  ["Inter", "inter-700", 700, "normal"],
  ["Inter", "inter-italic-400", 400, "italic"],
  ["Space Grotesk", "space-grotesk-500", 500, "normal"],
  ["Space Grotesk", "space-grotesk-600", 600, "normal"],
  ["Newsreader Display", "newsreader-400-o72", 400, "normal"],
  ["Newsreader", "newsreader-400-o16", 400, "normal"],
  ["Newsreader", "newsreader-500-o24", 500, "normal"],
  ["Newsreader", "newsreader-italic-400-o16", 400, "italic"],
  ["Plex Mono", "plex-mono-400", 400, "normal"],
  ["Plex Mono", "plex-mono-500", 500, "normal"],
];

/** Repo-relative directory holding the static font files. */
export const DE_DOC_FONTS_DIR = "scripts/de-documents/fonts";
