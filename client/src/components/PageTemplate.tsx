import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import { shouldAppendStatementColon } from "@/components/visual/StatementHeading";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero, Breadcrumbs, Container } from "@/components/site/chapters";

interface PageTemplateProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showBackButton?: boolean;
  /** Ignored. Inner heroes stay charcoal so page-family accent can pop. */
  gradientColors?: string;
  /** Ignored since the 2026-10 site chapter pass: an icon tile beside the h1 read as clip-art. */
  icon?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  variant?: "default" | "dark" | "light";
  /** Optional CTA group rendered under the hero subtitle (conversion pages). */
  actions?: React.ReactNode;
  /** Tracked-caps line above the h1. */
  eyebrow?: string;
  /** Right column of the hero at lg (key facts, a document preview). */
  heroAside?: React.ReactNode;
  /**
   * "contained" (default) wraps children in one chapter with prose styles.
   * "chapters" renders children straight into <main> so the page composes its
   * own full-bleed chapters (`Chapter` from components/site/chapters).
   */
  layout?: "contained" | "chapters";
}

function StatementTitle({ text }: { text: string }) {
  return (
    <>
      {text}
      {shouldAppendStatementColon(text) ? (
        <span className="text-de-accent-ink" aria-hidden="true">
          :
        </span>
      ) : null}
    </>
  );
}

export const PageTemplate = ({
  title,
  subtitle,
  children,
  showBackButton = true,
  breadcrumbs,
  variant = "dark",
  actions,
  eyebrow,
  heroAside,
  layout = "contained",
}: PageTemplateProps): JSX.Element => {
  const isLight = variant === "light";

  const contentClass = isLight
    ? "de-paper-chapter de-paper-hairline"
    : "de-dark-chapter de-chapter-hairline";
  const textClass = isLight ? "text-[#1A1228]" : "text-white";
  const proseClass = isLight ? "de-prose-light" : "de-prose-dark";

  const hasCrumbs = !!breadcrumbs && breadcrumbs.length > 0;

  return (
    <div className={`min-h-screen ${isLight && layout === "contained" ? "bg-de-paper" : "bg-de-bg"}`}>
      <MegaMenu />

      {/* One <main> landmark per templated page: hero + content, chrome outside
          (a11y sweep 2026-09-12 — 41 pages had no main landmark). */}
      <main id="page-main">
        <PageHero
          eyebrow={eyebrow}
          title={<StatementTitle text={title} />}
          lede={subtitle}
          breadcrumbs={hasCrumbs ? breadcrumbs : undefined}
          actions={actions ? <div className="w-full">{actions}</div> : undefined}
          aside={heroAside}
          note={
            showBackButton && !hasCrumbs ? (
              <Button
                variant="ghost"
                className="-ml-4 min-h-11 text-white/75 hover:bg-white/[0.06] hover:text-white"
                onClick={() => window.history.back()}
                data-testid="button-back"
              >
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Back
              </Button>
            ) : undefined
          }
        />

        {layout === "chapters" ? (
          children
        ) : (
          <section className={`py-12 md:py-16 lg:py-20 ${contentClass}`}>
            <Container className={`${textClass} ${proseClass}`}>{children}</Container>
          </section>
        )}
      </main>

      <DigeratiEnhancedFooterSection />
    </div>
  );
};

export { Breadcrumbs };
