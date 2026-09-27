import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

/**
 * The V4 vocabulary. Every chapter composes from these, which is the whole
 * point: the production homepage failed partly because each section brought
 * its own card style, gradient and rhythm, so twenty sections read as twenty
 * decisions rather than one product.
 *
 * Hairlines and space before containers. Not everything is a card.
 */

/** The one action the page asks for, wherever it asks. */
export function PrimaryAction({ testId }: { testId: string }) {
  return (
    <Link
      href="/book"
      data-testid={testId}
      className="group inline-flex items-center gap-2.5 rounded-full bg-[#D3126A] px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#b80f5b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F04C97] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050312]"
    >
      Understand Your Environment
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export function ChapterLabel({ n, children }: { n: string; children: ReactNode }) {
  return (
    <p className="mb-5 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-white/35">
      <span className="text-[#F04C97]">{n}</span>
      <span className="h-px w-8 bg-white/15" />
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
}: {
  id: string;
  n: string;
  eyebrow: string;
  heading: string;
  lede?: string;
  children?: ReactNode;
  /** Paper is a deliberate contrast for one chapter, never decoration. */
  tone?: "graphite" | "paper";
}) {
  const paper = tone === "paper";
  return (
    <section
      aria-labelledby={id}
      className={paper ? "bg-[#F7F5F2] text-[#14121a]" : "bg-[#050312] text-[#F7F5F2]"}
    >
      <div className="mx-auto w-full max-w-[1240px] px-5 py-20 sm:px-8 lg:py-28">
        <p
          className={`mb-5 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] ${
            paper ? "text-black/40" : "text-white/35"
          }`}
        >
          <span className={paper ? "text-[#D3126A]" : "text-[#F04C97]"}>{n}</span>
          <span className={`h-px w-8 ${paper ? "bg-black/15" : "bg-white/15"}`} />
          {eyebrow}
        </p>
        <h2
          id={id}
          className="max-w-[24ch] font-['Space_Grotesk',sans-serif] text-[clamp(1.75rem,4vw,2.7rem)] font-bold leading-[1.08] tracking-[-0.015em] text-balance"
        >
          {heading}
        </h2>
        {lede && (
          <p
            className={`mt-5 max-w-[58ch] text-[15.5px] leading-relaxed ${
              paper ? "text-black/60" : "text-white/60"
            }`}
          >
            {lede}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}

/**
 * A cell of a hard grid. The grid itself carries the structure — hairlines
 * between cells rather than a border around each one, so a row of these reads
 * as one model instead of a handful of separate objects.
 */
export function GridCell({
  label,
  title,
  detail,
  paper = false,
}: {
  label?: string;
  title: string;
  detail?: string;
  paper?: boolean;
}) {
  return (
    <div
      className={`min-w-0 border-t py-5 ${paper ? "border-black/10" : "border-white/10"}`}
    >
      {label && (
        <p
          className={`mb-2 font-mono text-[10px] uppercase tracking-[0.18em] ${
            paper ? "text-black/35" : "text-white/30"
          }`}
        >
          {label}
        </p>
      )}
      <h3
        className={`text-[14.5px] font-semibold leading-snug ${
          paper ? "text-[#14121a]" : "text-[#F7F5F2]"
        }`}
      >
        {title}
      </h3>
      {detail && (
        <p
          className={`mt-1.5 text-[13px] leading-relaxed ${
            paper ? "text-black/55" : "text-white/50"
          }`}
        >
          {detail}
        </p>
      )}
    </div>
  );
}

/**
 * Hairline-ruled grid. Each cell carries its own top rule and the columns are
 * separated by space.
 *
 * `divide-x` was tried first and is wrong here: on a grid whose item count
 * does not fill the last row it draws a vertical rule beside the empty cells,
 * so a seven-item four-column grid renders a dangling line under nothing and
 * the whole section reads as unfinished. Per-cell top rules wrap correctly at
 * every column count and every breakpoint.
 */
export function HairGrid({
  cols = "sm:grid-cols-2 lg:grid-cols-4",
  children,
}: {
  cols?: string;
  /** Kept for call-site symmetry; cells carry their own paper styling. */
  paper?: boolean;
  children: ReactNode;
}) {
  return <div className={`mt-10 grid grid-cols-1 gap-x-8 ${cols}`}>{children}</div>;
}
