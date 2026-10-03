/**
 * Homepage versions — every homepage the site has had or is considering,
 * each reachable at /version-<n> for reference, never for search.
 *
 * A version is a frozen snapshot made with
 * scripts/snapshot-homepage-version.mjs (kind "react"), a live build under
 * active development in this app (kind "build"), a static build served by
 * Express (kind "static"), or a placeholder for work that has not started
 * (kind "planned"). /versions lists them all.
 *
 * "react" and "build" are deliberately different kinds. A "react" version is
 * frozen history and must never be edited; a "build" version is work in
 * progress and is expected to change. Conflating them would put the frozen
 * snapshots' guard test on a moving file, and the first inconvenient failure
 * would get the guard relaxed for everything.
 */
export type HomepageVersionKind = "react" | "build" | "static" | "planned";

export interface HomepageVersion {
  /** Sequential number; the URL is /version-<n>. */
  n: number;
  path: string;
  title: string;
  /** ISO date the snapshot was taken or the version was defined. */
  date: string;
  /** Where it stands: live, preview, draft PR, planned. */
  status: string;
  summary: string;
  kind: HomepageVersionKind;
  /** Git ref or PR the snapshot came from. */
  source?: string;
  /** For static versions: the URL the version path forwards to. */
  href?: string;
}

export const HOMEPAGE_VERSIONS: HomepageVersion[] = [
  {
    n: 1,
    path: "/version-1",
    title: "Production homepage until 2026-09-02, restored 2026-09-03",
    date: "2026-09-02",
    status: "Live at / again from 2026-09-03 (Joe's direction: the homepage before the Scrollcraft-era sections)",
    summary:
      "The homepage as it ships on main: reference hero with four trust cards, sourced stats, the Six Domains command deck, four process cards, reviews and outcome tiles, team cards, package tiers, compliance marks, the assessment island, contact.",
    kind: "react",
    source: "origin/main @ 2d7d12a",
  },
  {
    n: 2,
    path: "/version-2",
    title: "Version B, the Scrollcraft story page",
    date: "2026-09-01",
    status: "Preview at /v2, noindex",
    summary:
      "The isolated scroll-driven interpretation: ten acts from fragmentation to the environment waking up, the range rail, the cadence, proof, Arizona, the ask. Reviewed 2026-09-02 as too long for the primary homepage; candidate for a Why DE story.",
    kind: "static",
    source: "PR #164 (build), PR #172 (served at /v2)",
    href: "/v2",
  },
  {
    n: 3,
    path: "/version-3",
    title: "Diagram-system sections",
    date: "2026-09-02",
    status: "Was live at / from 2026-09-02 (PR #178) to 2026-09-03; retired from / at Joe's direction, kept here for reference",
    summary:
      "The nine service sections rebuilt on the DE diagram system: one environment, layered protection, the operating cadence, coverage depth, the inspection; plain-language disclosure; How DE delivers; SLA line; mobile step.",
    kind: "react",
    source: "claude/digerati-experts-v2-scrollcraft-7fkrfd @ c03cad9",
  },
  {
    n: 4,
    path: "/version-4",
    title: "Clean-sheet redesign, ten chapters",
    date: "2026-09-27",
    status: "In build — chapters 01–03 (draft PR #264). Not proposed for /; Joe is the approval gate.",
    summary:
      "A clean-sheet homepage, not a recomposition: ten chapters, one environment that transforms across the first three rather than a new illustration per section, and one primary action. Answers the measured failures of the production page — 23.5 viewports, 20 near-identical sections, 279 links with 19 in the hero. Governed by docs/VERSION-4-HOMEPAGE-SOURCE-OF-TRUTH.md.",
    kind: "build",
    source: "claude/homepage-v4",
  },
  {
    n: 5,
    path: "/version-5",
    title: "The practical homepage",
    date: "2026-09-30",
    status: "Merged (PR #292, 2026-10-01) and live as the noindex /version-5 preview. Not proposed for /; Joe decides whether it replaces /.",
    summary:
      "One conventional page, done carefully: what Digerati Experts does for Arizona businesses, for whom, the four published ProActive prices, the written response times, the founder, the questions people ask before they call, and how to reach us. Every fact on the page is read from the same files the rest of the site uses; nothing is invented and nothing scroll-jacks. Built after Joe's 2026-09-30 direction to start over and make something practical, with an acceptance script (scripts/qa/homepage-v5-acceptance.mjs) as the definition of done.",
    kind: "build",
    source: "claude/homepage-v5-practical",
  },
  {
    n: 6,
    path: "/version-6",
    title: "Current-theme homepage redo",
    date: "2026-10-01",
    status: "In build (issue #318). Preview only; does not replace /. Version 5 remains at /version-5.",
    summary:
      "Live homepage, cleaned in the current DE theme (graphite well, paper chapters, magenta Get My Cyber Risk Assessment). Claude section mockups for layout; live-better hero DashboardMockup, compact pronunciation, eight-block data, sourced facts and published prices. Version 7 is a separate reviewed-mockups build; ChatGPT's other-theme board stays held for a later version.",
    kind: "build",
    source: "cursor/homepage-v6-current-theme-20261001",
  },
  {
    n: 7,
    path: "/version-7",
    title: "Every live section, as reviewed",
    date: "2026-10-01",
    status: "In build (draft PR #315). Preview only; Joe decides whether it replaces /.",
    summary:
      "The live homepage, section by section, built from Joe's reviewed section mockups on the current DE system: one head recipe, one card, paper chapters as full-bleed bands, real artifacts only, and every subtle live interaction kept (the industries photo hover, the pronunciation bars, the interactive assessment preview, the FAQ rail, the eight-block deck with Joe's approved phone layout). One assessment form and one newsletter, per Joe's round-2 decisions. The unified bottom bar runs with autohide: it tucks into the Ask DE button while you read and returns the moment you reach for it.",
    kind: "build",
    source: "claude/sleepy-archimedes-mccoav",
  },
  {
    n: 8,
    path: "/version-8",
    title: "Version 7 with Joe's preferences",
    date: "2026-10-03",
    status: "The homepage at / since 2026-10-03 (Joe: \"its approved. do it.\"). /version-8 redirects to /; the previous homepage is kept at /version-0 and Version 7 at /version-7.",
    summary:
      "The main candidate: Version 7 (grey cards, charcoal, Inter, the element kit) with Joe's section-by-section notes applied. Hero kept exactly; the trust strip takes the live homepage's compact row; the Why Arizona cards drop the #f4f4f5 fill; light-band icon tiles fixed to the tinted accent.",
    kind: "build",
    source: "claude/sleepy-archimedes-mccoav",
  },
];

export function versionByNumber(n: number): HomepageVersion | undefined {
  return HOMEPAGE_VERSIONS.find((v) => v.n === n);
}
