import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight, ArrowUpRight } from "lucide-react";

/**
 * The V4 vocabulary. Deliberately small: one action, one chapter label, one
 * chapter frame, one quiet link — and one type scale. The first cut also
 * carried a grid cell and a hairline grid, and four chapters composed from
 * them read as the same chapter four times — Joe's verdict was "generic
 * trash". Each chapter now builds its own form, so the shared vocabulary
 * stops at the frame and the scale.
 *
 * Colour comes from the theme's own DE tokens (tailwind.config.ts `de.*`,
 * values in client/src/index.css): de-bg, de-surface, de-raised, de-paper,
 * de-accent, de-accent-ink. No hex on this page. The scale below is the only
 * place a V4 font size is written; every chapter composes from it. That is
 * acceptance test 16 of the source of truth (one token system) and it is
 * also what keeps the compiled stylesheet inside the bundle budget — the
 * third cut wrote ~120 distinct arbitrary utilities and overran it by six
 * bytes.
 */

/** The V4 type scale. Six sizes, three mono treatments, nothing else. */
export const T = {
  /** The two statements: hero and close. */
  display:
    "font-['Space_Grotesk',sans-serif] text-[clamp(2.4rem,6vw,3.6rem)] font-bold leading-[1.02] tracking-[-0.02em] text-balance",
  /** Chapter headings. */
  h2: "font-['Space_Grotesk',sans-serif] text-[clamp(1.75rem,4vw,2.7rem)] font-bold leading-[1.08] tracking-[-0.015em] text-balance",
  /** Sub-headings, quotations, questions, names. */
  h3: "font-['Space_Grotesk',sans-serif] text-[clamp(1.1rem,1.8vw,1.45rem)] font-bold leading-snug",
  /** A figure set large: ledger verbs, typed numbers. */
  figure:
    "font-['Space_Grotesk',sans-serif] text-[clamp(1.6rem,3.2vw,2.3rem)] font-bold leading-none tracking-[-0.02em]",
  /** The lede under a statement. */
  lede: "text-[clamp(1rem,1.4vw,1.1rem)] leading-relaxed",
  /** Running text. */
  body: "text-[15px] leading-relaxed",
  /** Secondary text. */
  small: "text-[13.5px] leading-relaxed",
  /** Labels, eyebrows, sources. */
  label: "font-mono text-[10.5px] uppercase tracking-[0.18em]",
  /** Counted things: numbers beside their subjects. */
  mono: "font-mono text-[12.5px] tabular-nums",
  /** Legends and captions inside a drawing. */
  micro: "font-mono text-[9.5px] uppercase tracking-[0.16em]",
} as const;

/** Focus ring shared by every interactive element on the page. */
export const RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-de-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-de-bg";

/** The one action the page asks for, wherever it asks. */
export function PrimaryAction({ testId }: { testId: string }) {
  return (
    <Link
      href="/book"
      data-testid={testId}
      className={`group inline-flex items-center gap-2.5 rounded-full bg-de-accent px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-de-magenta-hover ${RING}`}
    >
      Understand Your Environment
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/**
 * A chapter's single forward link — text with an arrow, never a second button.
 * `external` opens another site in a new tab and says so with its arrow.
 */
export function QuietLink({
  href,
  testId,
  paper = false,
  external = false,
  children,
}: {
  href: string;
  testId: string;
  paper?: boolean;
  external?: boolean;
  children: ReactNode;
}) {
  const className = `group inline-flex items-center gap-2 text-[13.5px] font-semibold underline underline-offset-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-de-accent-ink focus-visible:ring-offset-2 ${
    paper
      ? "text-de-bg decoration-black/25 hover:decoration-black focus-visible:ring-offset-de-paper"
      : "text-de-paper decoration-white/25 hover:decoration-white focus-visible:ring-offset-de-bg"
  }`;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" data-testid={testId} className={className}>
        {children}
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    );
  }
  return (
    <Link href={href} data-testid={testId} className={className}>
      {children}
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export function ChapterLabel({
  n,
  paper = false,
  children,
}: {
  n: string;
  paper?: boolean;
  children: ReactNode;
}) {
  return (
    <p className={`mb-5 flex items-center gap-3 ${T.label} ${paper ? "text-black/60" : "text-white/55"}`}>
      <span className={paper ? "text-de-accent" : "text-de-accent-ink"}>{n}</span>
      <span className={`h-px w-8 ${paper ? "bg-black/15" : "bg-white/15"}`} />
      {children}
    </p>
  );
}

/** A chapter of the page. One job, one heading, at most one forward action. */
export function Chapter({
  id,
  n,
  eyebrow,
  heading,
  lede,
  children,
  tone = "graphite",
  testId,
}: {
  id: string;
  n: string;
  eyebrow: string;
  heading: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
  /** Paper is a deliberate contrast for one chapter, never decoration. */
  tone?: "graphite" | "paper";
  testId?: string;
}) {
  const paper = tone === "paper";
  return (
    <section
      aria-labelledby={id}
      data-testid={testId}
      className={paper ? "bg-de-paper text-de-bg" : "border-t border-white/10 bg-de-bg text-de-paper"}
    >
      <div className="mx-auto w-full max-w-[1240px] px-5 py-20 sm:px-8 lg:py-28">
        <ChapterLabel n={n} paper={paper}>
          {eyebrow}
        </ChapterLabel>
        <h2 id={id} className={`max-w-[24ch] ${T.h2}`}>
          {heading}
        </h2>
        {lede && (
          <p className={`mt-5 max-w-[58ch] ${T.body} ${paper ? "text-black/60" : "text-white/60"}`}>
            {lede}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}
