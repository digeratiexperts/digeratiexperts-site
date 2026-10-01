import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

/**
 * Homepage chapter grammar (Tier 2, design/UI-STYLE-RULES.md §2, §5, §6).
 *
 * Every homepage section is composed from the same three pieces so the page
 * reads as one site instead of a stack of islands:
 *
 *   - HomeChapter: a full-bleed field (well / surface / paper) with a hairline
 *     seam and one padding rhythm. No rounded islands, no per-section boxes.
 *   - HomeContainer: the one canvas + gutter every chapter shares with the
 *     hero, so every heading sits on the same left edge.
 *   - HomeChapterHeader: eyebrow → title → lede (+ optional link), split
 *     across two columns at lg the way the approved reference lays them out.
 *
 * Cards and buttons come from the class recipes below so a section never
 * mints its own gradient, radius or shadow.
 */

export type ChapterTone = "well" | "surface" | "paper";

const toneField: Record<ChapterTone, string> = {
  well: "de-dark-well text-white",
  surface: "de-dark-chapter text-white",
  paper: "de-paper-chapter text-[#1A1228]",
};

const toneSeam: Record<ChapterTone, string> = {
  well: "border-t border-[var(--de-hairline)]",
  surface: "border-t border-[var(--de-hairline)]",
  paper: "border-t border-[var(--de-paper-hairline)]",
};

/** Section padding — one rhythm for the whole page. */
export const chapterPadding = "py-14 md:py-16 lg:py-20";

/** The hero's canvas and gutters, reused by every chapter. */
export const containerClass =
  "mx-auto w-full max-w-[var(--de-canvas)] px-5 sm:px-8 lg:px-10 xl:px-12";

type HomeChapterProps<T extends ElementType> = {
  as?: T;
  tone: ChapterTone;
  /** Hairline seam on the top edge. Off when the chapter follows a hero or a strip that already draws it. */
  seam?: boolean;
  /** Tighter padding for strips and closing bands. */
  compact?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

export function HomeChapter<T extends ElementType = "section">({
  as,
  tone,
  seam = true,
  compact = false,
  className,
  children,
  ...rest
}: HomeChapterProps<T>) {
  const Tag = (as ?? "section") as ElementType;
  return (
    <Tag
      className={cn(
        "relative",
        toneField[tone],
        seam && toneSeam[tone],
        compact ? "py-10 md:py-12" : chapterPadding,
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function HomeContainer({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn(containerClass, className)}>{children}</div>;
}

type HeaderLink = {
  label: string;
  href: string;
  testId?: string;
  /** Plain anchor (hash jump or external) instead of the router link. */
  plain?: boolean;
};

type HomeChapterHeaderProps = {
  tone: ChapterTone;
  eyebrow: string;
  title: ReactNode;
  /** Accessible name when the title contains decorated spans. */
  titleId?: string;
  as?: "h2" | "h3";
  lede?: ReactNode;
  link?: HeaderLink;
  /** "split" (default) puts the lede on the right at lg; "stack" keeps it under the title. */
  layout?: "split" | "stack";
  className?: string;
};

export function Eyebrow({
  tone,
  children,
  className,
}: {
  tone: ChapterTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em]",
        tone === "paper" ? "text-de-magenta-paper-ink" : "text-de-magenta-ink",
        className,
      )}
    >
      <span className="h-px w-6 shrink-0 bg-current" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export const titleClass =
  "font-heading text-3xl font-semibold leading-[1.1] tracking-[-0.02em] md:text-4xl";

export function ledeClass(tone: ChapterTone) {
  return cn(
    "text-base leading-relaxed md:text-lg",
    tone === "paper" ? "text-[#3A3448]" : "text-white/65",
  );
}

export function textLinkClass(tone: ChapterTone) {
  return cn(
    "group inline-flex min-h-11 items-center gap-1.5 text-base font-semibold transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] focus-visible:ring-offset-2",
    tone === "paper"
      ? "text-de-magenta-paper-ink hover:text-[#D3126A] focus-visible:ring-offset-[var(--de-paper)]"
      : "text-de-magenta-ink hover:text-[#f0187a] focus-visible:ring-offset-[var(--de-bg)]",
  );
}

export function HeaderLinkEl({ link, tone }: { link: HeaderLink; tone: ChapterTone }) {
  const body = (
    <>
      {link.label}
      <ArrowRight
        className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </>
  );
  if (link.plain) {
    return (
      <a href={link.href} className={textLinkClass(tone)} data-testid={link.testId}>
        {body}
      </a>
    );
  }
  return (
    <Link href={link.href} className={textLinkClass(tone)} data-testid={link.testId}>
      {body}
    </Link>
  );
}

export function HomeChapterHeader({
  tone,
  eyebrow,
  title,
  titleId,
  as: Tag = "h2",
  lede,
  link,
  layout = "split",
  className,
}: HomeChapterHeaderProps) {
  const split = layout === "split" && (lede || link);
  return (
    <div
      className={cn(
        "mb-10 md:mb-12",
        split && "grid gap-5 lg:grid-cols-12 lg:items-end lg:gap-10",
        className,
      )}
    >
      <div className={cn(split && "lg:col-span-7")}>
        <Eyebrow tone={tone} className="mb-4">
          {eyebrow}
        </Eyebrow>
        <Tag id={titleId} className={cn(titleClass, "max-w-[24ch]")}>
          {title}
        </Tag>
      </div>
      {(lede || link) && (
        <div className={cn(split ? "lg:col-span-5 lg:pb-1" : "mt-4", "max-w-xl")}>
          {lede && <p className={ledeClass(tone)}>{lede}</p>}
          {link && (
            <div className={cn(lede && "mt-2")}>
              <HeaderLinkEl link={link} tone={tone} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Recipes                                                             */
/* ------------------------------------------------------------------ */

/** Raised graphite card on any dark field. */
export const cardDark =
  "rounded-xl border border-de-hairline bg-de-raised";

/** Interactive variant: lifts on hover, magenta hairline, no scale. */
export const cardDarkInteractive = cn(
  cardDark,
  "de-interactive-card group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-bg)]",
);

/** White card on paper. */
export const cardPaper = "rounded-xl border border-[var(--de-paper-hairline)] bg-white";

const buttonBase =
  "inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg px-6 text-base font-semibold transition-[background-color,border-color,color,transform] duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] focus-visible:ring-offset-2 motion-reduce:active:scale-100";

/** Magenta primary — the one loud action on the page. */
export function buttonPrimary(tone: ChapterTone) {
  return cn(
    buttonBase,
    "bg-[#D3126A] text-white hover:bg-[#e01874]",
    tone === "paper"
      ? "focus-visible:ring-offset-[var(--de-paper)]"
      : "focus-visible:ring-offset-[var(--de-bg)]",
  );
}

/** Quiet outline secondary. */
export function buttonSecondary(tone: ChapterTone) {
  return cn(
    buttonBase,
    tone === "paper"
      ? "border border-[var(--de-paper-hairline)] bg-white text-[#1A1228] hover:border-[#D3126A] hover:text-de-magenta-paper-ink focus-visible:ring-offset-[var(--de-paper)]"
      : "border border-white/20 bg-transparent text-white hover:border-white/40 hover:bg-white/5 focus-visible:ring-offset-[var(--de-bg)]",
  );
}

/** Small numbered index (01, 02 …) — Oxanium-class metadata, never body copy. */
export function indexClass(tone: ChapterTone) {
  return cn(
    "font-mono text-sm font-semibold tracking-[0.16em]",
    tone === "paper" ? "text-de-magenta-paper-ink" : "text-de-magenta-ink",
  );
}
