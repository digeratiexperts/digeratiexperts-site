import { useId, useState, type MouseEvent, type ReactNode } from "react";
import { ArrowRight, ChevronDown, ChevronRight, Phone, type LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { FAQJsonLd } from "@/components/JsonLd";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { IconWell } from "@/components/visual/IconWell";
import {
  HomeChapter,
  HomeChapterHeader,
  HomeContainer,
  Eyebrow,
  buttonPrimary,
  buttonSecondary,
  cardDark,
  cardPaper,
  indexClass,
  ledeClass,
  titleClass,
  textLinkClass,
  type ChapterTone,
} from "@/components/home/HomeChapter";

/**
 * Site chapter grammar (Tier 2, design/UI-STYLE-RULES.md §5–6).
 *
 * The homepage's chapter primitives (HomeChapter / HomeContainer /
 * HomeChapterHeader and their recipes) promoted for every marketing page, plus
 * the section archetypes interior pages kept re-building by hand: the interior
 * hero, the paper trust strip, the numbered problems list, the feature grid,
 * the process rail, the FAQ and the closing next-step band.
 *
 * Rhythm rules these encode: chapters are full-bleed fields (well / surface /
 * paper) separated by a hairline, never a rounded island around every section;
 * paper is the relief valve where reading happens; every heading shares the
 * hero's left edge; one primary CTA per band, magenta, never three.
 */

export {
  HomeChapter as Chapter,
  HomeContainer as Container,
  HomeChapterHeader as ChapterHeader,
  Eyebrow,
  buttonPrimary,
  buttonSecondary,
  cardDark,
  cardPaper,
  indexClass,
  ledeClass,
  titleClass,
  textLinkClass,
};
export type { ChapterTone };

/** Heading ink per tone. */
export function inkClass(tone: ChapterTone) {
  return tone === "paper" ? "text-[#1A1228]" : "text-white";
}

/** Body ink per tone (meets AA on its own field). */
export function bodyClass(tone: ChapterTone) {
  return tone === "paper" ? "text-[#3A3448]" : "text-white/70";
}

function cardFor(tone: ChapterTone) {
  return tone === "paper" ? cardPaper : cardDark;
}

/* ------------------------------------------------------------------ */
/* Interior hero                                                       */
/* ------------------------------------------------------------------ */

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items, tone = "well" }: { items: Crumb[]; tone?: ChapterTone }) {
  const muted =
    tone === "paper" ? "text-black/60 hover:text-[#1A1228]" : "text-white/65 hover:text-white";
  return (
    <nav aria-label="Breadcrumb" className="mb-8">
      <ol className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm", muted)}>
        <li>
          <Link
            href="/"
            className="inline-flex min-h-8 items-center rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]"
          >
            Home
          </Link>
        </li>
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex items-center gap-2">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
            {c.href ? (
              <Link
                href={c.href}
                className="inline-flex min-h-8 items-center rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]"
              >
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className={tone === "paper" ? "text-[#1A1228]" : "text-white"}>
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

type PageHeroProps = {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  breadcrumbs?: Crumb[];
  /** CTA row — use HeroActions or buttonPrimary/buttonSecondary links. */
  actions?: ReactNode;
  /** Right column at lg (fact panel, key numbers, a document). Hidden on small screens unless `asideOnMobile`. */
  aside?: ReactNode;
  asideOnMobile?: boolean;
  /** Small quiet line under the actions (positioning, reassurance). */
  note?: ReactNode;
  className?: string;
};

/**
 * Interior hero: atmospheric well, left-aligned on the hero canvas, eyebrow →
 * oversized headline → one-sentence lede → primary + outline secondary.
 * The homepage keeps its own flagship hero; this is its quieter sibling.
 */
export function PageHero({
  eyebrow,
  title,
  lede,
  breadcrumbs,
  actions,
  aside,
  asideOnMobile = false,
  note,
  className,
}: PageHeroProps) {
  return (
    <section
      className={cn(
        "de-dark-well de-field-grain de-field-lit relative overflow-hidden text-white",
        className,
      )}
    >
      <HomeContainer className="relative z-10 pb-14 pt-[calc(var(--de-nav-offset)+1.25rem)] md:pb-20 md:pt-[calc(var(--de-nav-offset)+2rem)]">
        {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
        <div className={cn(aside && "grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-14")}>
          <div className={cn(aside && "lg:col-span-7")}>
            {eyebrow && (
              <Eyebrow tone="well" className="mb-5">
                {eyebrow}
              </Eyebrow>
            )}
            <h1 className="max-w-[20ch] font-heading text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.03em] text-white sm:text-5xl lg:text-6xl">
              {title}
            </h1>
            {lede && (
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/75 md:text-xl">{lede}</p>
            )}
            {actions && <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{actions}</div>}
            {note && <p className="mt-6 max-w-xl text-sm leading-relaxed text-white/55">{note}</p>}
          </div>
          {aside && (
            <div className={cn("lg:col-span-5", !asideOnMobile && "hidden lg:block")}>{aside}</div>
          )}
        </div>
      </HomeContainer>
    </section>
  );
}

export type ActionLink = { label: string; href: string; testId?: string; onClick?: (e: MouseEvent<HTMLAnchorElement>) => void };

function ActionAnchor({ action, className, icon }: { action: ActionLink; className: string; icon?: ReactNode }) {
  const external = /^(https?:|tel:|mailto:|#)/.test(action.href);
  const body = (
    <>
      {action.label}
      {icon}
    </>
  );
  if (external) {
    return (
      <a href={action.href} className={className} data-testid={action.testId} onClick={action.onClick}>
        {body}
      </a>
    );
  }
  return (
    <Link href={action.href} className={className} data-testid={action.testId} onClick={action.onClick}>
      {body}
    </Link>
  );
}

/** Primary (magenta) + optional outline secondary, as links. */
export function HeroActions({
  primary,
  secondary,
  tone = "well",
}: {
  primary: ActionLink;
  secondary?: ActionLink;
  tone?: ChapterTone;
}) {
  return (
    <>
      <ActionAnchor
        action={primary}
        className={buttonPrimary(tone)}
        icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
      />
      {secondary && <ActionAnchor action={secondary} className={buttonSecondary(tone)} />}
    </>
  );
}

/** Quiet key-facts panel for the hero aside: label / value rows on a raised card. */
export function HeroFacts({
  title,
  rows,
  footnote,
}: {
  title?: string;
  rows: { label: string; value: ReactNode }[];
  footnote?: ReactNode;
}) {
  return (
    <div className={cn(cardDark, "p-6 md:p-7")}>
      {title && (
        <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-white/55">{title}</p>
      )}
      <dl className="divide-y divide-[var(--de-hairline)]">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-4 py-3.5 first:pt-0 last:pb-0">
            <dt className="text-sm text-white/55">{r.label}</dt>
            <dd className="text-sm font-medium leading-snug text-white">{r.value}</dd>
          </div>
        ))}
      </dl>
      {footnote && <p className="mt-5 text-xs leading-relaxed text-white/50">{footnote}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trust strip                                                         */
/* ------------------------------------------------------------------ */

export type Fact = { icon?: LucideIcon; title: string; text?: string };

/**
 * Paper trust strip attached under a hero: up to four equal hairline cells.
 * No shadows, no chips. Replaces rows of ProofChips and stat tiles that say
 * "HIPAA / Focus".
 */
export function FactStrip({ facts, label }: { facts: Fact[]; label?: string }) {
  return (
    <section className="de-paper-chapter border-b border-[var(--de-paper-hairline)] text-[#1A1228]" aria-label={label ?? "At a glance"}>
      <HomeContainer>
        <ul
          className={cn(
            "grid divide-y divide-[var(--de-paper-hairline)] sm:divide-y-0",
            facts.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : facts.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
          )}
        >
          {facts.map((f, i) => (
            <li
              key={f.title}
              className={cn(
                "flex items-start gap-4 py-6 sm:px-6 sm:py-8",
                i === 0 && "sm:pl-0",
                "sm:border-l sm:border-[var(--de-paper-hairline)] sm:first:border-l-0",
                facts.length >= 4 && "lg:[&:nth-child(3)]:border-l sm:[&:nth-child(3)]:border-l-0 lg:[&:nth-child(3)]:border-l-[var(--de-paper-hairline)] sm:[&:nth-child(3)]:pl-0 lg:[&:nth-child(3)]:pl-6",
              )}
            >
              {f.icon && <f.icon className="mt-0.5 h-5 w-5 shrink-0 text-de-magenta-paper-ink" aria-hidden="true" />}
              <div>
                <p className="font-heading text-base font-semibold leading-snug">{f.title}</p>
                {f.text && <p className="mt-1 text-sm leading-relaxed text-[#3A3448]">{f.text}</p>}
              </div>
            </li>
          ))}
        </ul>
      </HomeContainer>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Numbered list (problems / questions / principles)                   */
/* ------------------------------------------------------------------ */

export type IndexedItem = { title: string; text?: ReactNode };

/**
 * Numbered 2- or 3-column list with hairline seams — the problems-grid
 * archetype. Reads as a considered list, not a wall of boxes.
 */
export function IndexedList({
  items,
  tone,
  columns = 3,
  start = 1,
}: {
  items: IndexedItem[];
  tone: ChapterTone;
  columns?: 2 | 3;
  start?: number;
}) {
  const seam = tone === "paper" ? "border-[var(--de-paper-hairline)]" : "border-[var(--de-hairline)]";
  return (
    <ol className={cn("grid gap-x-10 border-t", seam, columns === 3 ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2")}>
      {items.map((item, i) => (
        <li key={item.title} className={cn("border-b py-5 md:py-7", seam)}>
          <span className={indexClass(tone)}>{String(i + start).padStart(2, "0")}</span>
          <h3 className={cn("mt-3 font-heading text-lg font-semibold leading-snug md:text-xl", inkClass(tone))}>
            {item.title}
          </h3>
          {item.text && <p className={cn("mt-2 text-base leading-relaxed", bodyClass(tone))}>{item.text}</p>}
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Feature grid                                                        */
/* ------------------------------------------------------------------ */

export type FeatureItem = {
  icon?: LucideIcon;
  title: string;
  text?: ReactNode;
  /** Small tag after the title, e.g. "Business+". */
  tag?: string;
  href?: string;
  linkLabel?: string;
};

/** Cards with an IconWell, on either field. Columns collapse to one on phones. */
export function FeatureGrid({
  items,
  tone,
  columns = 3,
}: {
  items: FeatureItem[];
  tone: ChapterTone;
  columns?: 2 | 3 | 4;
}) {
  const cols =
    columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : columns === 2 ? "md:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <ul className={cn("grid gap-4 md:gap-5", cols)}>
      {items.map((f) => {
        const inner = (
          <>
            {f.icon && <IconWell icon={f.icon} surface={tone === "paper" ? "light" : "dark"} className="mb-5" />}
            <h3 className={cn("font-heading text-lg font-semibold leading-snug", inkClass(tone))}>
              {f.title}
              {f.tag && (
                <span
                  className={cn(
                    "ml-2 align-middle font-mono text-xs font-semibold uppercase tracking-[0.12em]",
                    tone === "paper" ? "text-de-magenta-paper-ink" : "text-de-magenta-ink",
                  )}
                >
                  {f.tag}
                </span>
              )}
            </h3>
            {f.text && <p className={cn("mt-2 text-[0.95rem] leading-relaxed", bodyClass(tone))}>{f.text}</p>}
            {f.href && (
              <span className={cn(textLinkClass(tone), "mt-3 text-sm")}>
                {f.linkLabel ?? "Learn more"}
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            )}
          </>
        );
        return (
          <li key={f.title} className="flex">
            {f.href ? (
              <Link
                href={f.href}
                className={cn(
                  cardFor(tone),
                  "de-interactive-card group flex w-full flex-col p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] focus-visible:ring-offset-2",
                  tone === "paper" ? "focus-visible:ring-offset-[var(--de-paper)]" : "focus-visible:ring-offset-[var(--de-bg)]",
                )}
              >
                {inner}
              </Link>
            ) : (
              <div className={cn(cardFor(tone), "flex w-full flex-col p-6")}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Check list                                                          */
/* ------------------------------------------------------------------ */

/** Two-column list of short outcomes with magenta ticks — for benefits, "what you get". */
export function CheckList({ items, tone, columns = 2 }: { items: ReactNode[]; tone: ChapterTone; columns?: 1 | 2 }) {
  return (
    <ul className={cn("grid gap-x-10 gap-y-4", columns === 2 && "md:grid-cols-2")}>
      {items.map((item, i) => (
        <li key={i} className={cn("flex items-start gap-3 text-base leading-relaxed", bodyClass(tone))}>
          <span
            aria-hidden="true"
            className={cn(
              "mt-[0.6rem] h-1.5 w-3 shrink-0 rounded-full",
              tone === "paper" ? "bg-[#A30E52]" : "bg-[#D3126A]",
            )}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Process rail                                                        */
/* ------------------------------------------------------------------ */

export type Step = { title: string; text?: ReactNode; meta?: string };

/** 3–4 numbered steps on equal columns joined by a hairline rail. */
export function StepRail({ steps, tone }: { steps: Step[]; tone: ChapterTone }) {
  const rail = tone === "paper" ? "bg-[var(--de-paper-hairline)]" : "bg-[var(--de-hairline)]";
  return (
    <ol className={cn("relative grid gap-8 md:gap-6", steps.length >= 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3")}>
      <span aria-hidden="true" className={cn("absolute left-0 right-0 top-5 hidden h-px lg:block", rail)} />
      {steps.map((s, i) => (
        <li key={s.title} className="relative">
          <span
            className={cn(
              "relative z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border font-mono text-sm font-semibold",
              tone === "paper"
                ? "border-[var(--de-paper-hairline)] bg-white text-de-magenta-paper-ink"
                : "border-[var(--de-hairline)] bg-de-raised text-de-magenta-ink",
            )}
          >
            {String(i + 1).padStart(2, "0")}
          </span>
          {s.meta && (
            <p className={cn("mt-5 font-mono text-xs font-semibold uppercase tracking-[0.16em]", tone === "paper" ? "text-black/55" : "text-white/50")}>
              {s.meta}
            </p>
          )}
          <h3 className={cn(s.meta ? "mt-1.5" : "mt-5", "font-heading text-lg font-semibold leading-snug", inkClass(tone))}>
            {s.title}
          </h3>
          {s.text && <p className={cn("mt-2 text-[0.95rem] leading-relaxed", bodyClass(tone))}>{s.text}</p>}
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

export type FaqItem = { question: string; answer: string };

/**
 * FAQ chapter on paper: title column left, accordion right. Emits FAQ JSON-LD
 * unless `jsonLd={false}` (when the page already emits it).
 */
export function FaqChapter({
  faqs,
  title = "Frequently asked questions",
  eyebrow = "Common questions",
  lede,
  jsonLd = true,
  seam = true,
}: {
  faqs: FaqItem[];
  title?: string;
  eyebrow?: string;
  lede?: ReactNode;
  jsonLd?: boolean;
  seam?: boolean;
}) {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();
  return (
    <HomeChapter tone="paper" seam={seam}>
      {jsonLd && <FAQJsonLd faqs={faqs} />}
      <HomeContainer>
        <div className="grid items-start gap-8 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-4">
            <Eyebrow tone="paper" className="mb-4">
              {eyebrow}
            </Eyebrow>
            <h2 className={cn(titleClass, "max-w-[18ch] text-[#1A1228]")}>{title}</h2>
            {lede && <p className={cn(ledeClass("paper"), "mt-5 max-w-md")}>{lede}</p>}
          </div>
          <div className="lg:col-span-8">
            <ul className="space-y-3">
              {faqs.map((f, i) => {
                const isOpen = open === i;
                const qid = `${base}-q${i}`;
                const aid = `${base}-a${i}`;
                return (
                  <li key={f.question} className={cn("de-paper-faq-item rounded-xl", isOpen && "is-open")}>
                    <h3>
                      <button
                        type="button"
                        id={qid}
                        aria-expanded={isOpen}
                        aria-controls={aid}
                        onClick={() => setOpen(isOpen ? null : i)}
                        className="group flex min-h-11 w-full items-center justify-between gap-4 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ec4899] md:px-6 md:py-5"
                      >
                        <span className="text-base font-semibold text-[#1A1228] md:text-lg">{f.question}</span>
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D3126A]/10 transition-transform duration-200 group-hover:bg-[#D3126A]/15 motion-reduce:transition-none",
                            isOpen && "rotate-180",
                          )}
                        >
                          <ChevronDown className="h-5 w-5 text-[#A30E52]" />
                        </span>
                      </button>
                    </h3>
                    <div id={aid} role="region" aria-labelledby={qid} hidden={!isOpen}>
                      <div className="px-5 pb-5 md:px-6 md:pb-6">
                        <p className="border-t border-[var(--de-paper-hairline)] pt-4 text-base leading-relaxed text-[#3A3448]">
                          {f.answer}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </HomeContainer>
    </HomeChapter>
  );
}

/* ------------------------------------------------------------------ */
/* Closing CTA                                                         */
/* ------------------------------------------------------------------ */

/**
 * Next-step band: one headline, one sentence, the primary action and the phone
 * as the quiet secondary. The page ends calm — no gradients, no blobs.
 */
export function ClosingCta({
  title,
  lede,
  primary = { label: "Get My Cyber Risk Assessment", href: "/book" },
  secondary,
  showPhone = true,
  tone = "surface",
  eyebrow = "Next step",
  phoneTestId = "button-call-now",
}: {
  title: string;
  lede?: ReactNode;
  primary?: ActionLink;
  /** Replaces the phone button when given. */
  secondary?: ActionLink;
  showPhone?: boolean;
  tone?: ChapterTone;
  eyebrow?: string;
  phoneTestId?: string;
}) {
  return (
    <HomeChapter tone={tone}>
      <HomeContainer>
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-14">
          <div className="lg:col-span-7">
            <Eyebrow tone={tone} className="mb-4">
              {eyebrow}
            </Eyebrow>
            <h2 className={cn(titleClass, "max-w-[22ch] md:text-[2.75rem]", inkClass(tone))}>{title}</h2>
            {lede && <p className={cn(ledeClass(tone), "mt-5 max-w-xl")}>{lede}</p>}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:col-span-5 lg:justify-end">
            <ActionAnchor
              action={primary}
              className={buttonPrimary(tone)}
              icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
            />
            {secondary ? (
              <ActionAnchor action={secondary} className={buttonSecondary(tone)} />
            ) : (
              showPhone && (
                <a href={PRIMARY_PHONE.telHref} className={buttonSecondary(tone)} data-testid={phoneTestId}>
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  <span className="whitespace-nowrap">{PRIMARY_PHONE.display}</span>
                </a>
              )
            )}
          </div>
        </div>
      </HomeContainer>
    </HomeChapter>
  );
}

/* ------------------------------------------------------------------ */
/* Split: copy + aside                                                 */
/* ------------------------------------------------------------------ */

/** Header + copy left, any evidence/aside right. Stacks on phones. */
export function SplitChapterBody({
  children,
  aside,
  reverse = false,
}: {
  children: ReactNode;
  aside: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-14">
      <div className={cn("lg:col-span-6", reverse && "lg:order-2")}>{children}</div>
      <div className={cn("lg:col-span-6", reverse && "lg:order-1")}>{aside}</div>
    </div>
  );
}

/** Long-form reading measure for prose on either field. */
export function Prose({ tone, children, className }: { tone: ChapterTone; children: ReactNode; className?: string }) {
  return (
    <div className={cn("max-w-[68ch]", tone === "paper" ? "de-prose-light" : "de-prose-dark", className)}>{children}</div>
  );
}
