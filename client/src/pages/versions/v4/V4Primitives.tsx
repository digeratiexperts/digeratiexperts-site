import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

/**
 * The V4 vocabulary. Deliberately small: one action, one chapter label, one
 * chapter frame, one quiet link. The first cut also carried a grid cell and a
 * hairline grid, and four chapters composed from them read as the same
 * chapter four times — Joe's verdict was "generic trash". Each chapter now
 * builds its own form, so the shared vocabulary stops at the frame.
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

/** A chapter's single forward link — text with an arrow, never a second button. */
export function QuietLink({
  href,
  testId,
  paper = false,
  children,
}: {
  href: string;
  testId: string;
  paper?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className={`group inline-flex items-center gap-2 text-[13.5px] font-semibold underline underline-offset-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F04C97] focus-visible:ring-offset-2 ${
        paper
          ? "text-[#14121a] decoration-black/25 hover:decoration-black focus-visible:ring-offset-[#F7F5F2]"
          : "text-[#F7F5F2] decoration-white/25 hover:decoration-white focus-visible:ring-offset-[#050312]"
      }`}
    >
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
    <p
      className={`mb-5 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] ${
        paper ? "text-black/60" : "text-white/55"
      }`}
    >
      <span className={paper ? "text-[#D3126A]" : "text-[#F04C97]"}>{n}</span>
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
      className={
        paper
          ? "bg-[#F7F5F2] text-[#14121a]"
          : "border-t border-white/10 bg-[#050312] text-[#F7F5F2]"
      }
    >
      <div className="mx-auto w-full max-w-[1240px] px-5 py-20 sm:px-8 lg:py-28">
        <ChapterLabel n={n} paper={paper}>
          {eyebrow}
        </ChapterLabel>
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
