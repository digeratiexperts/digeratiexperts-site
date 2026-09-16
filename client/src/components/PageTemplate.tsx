import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import { StatementHeading } from "@/components/visual/StatementHeading";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { revealInitial, revealInView, revealTransition } from "@/lib/animations";

interface PageTemplateProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showBackButton?: boolean;
  /** Ignored. Inner heroes stay charcoal so page-family accent can pop. */
  gradientColors?: string;
  icon?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  variant?: "default" | "dark" | "light";
  /** Optional CTA group rendered under the hero subtitle (conversion pages). */
  actions?: React.ReactNode;
}

export const PageTemplate = ({
  title,
  subtitle,
  children,
  showBackButton = true,
  icon,
  breadcrumbs,
  variant = "dark",
  actions,
}: PageTemplateProps): JSX.Element => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const isLight = variant === "light";

  const pageClass = isLight ? "bg-de-paper" : "bg-de-bg";
  const heroClass = isLight
    ? "de-paper-chapter de-field-grain-paper"
    : "de-dark-well de-field-grain de-field-lit";
  const contentClass = isLight
    ? "de-paper-chapter de-paper-hairline"
    : "de-dark-chapter de-chapter-hairline";
  const textClass = isLight ? "text-[#1A1228]" : "text-white";
  const proseClass = isLight ? "de-prose-light" : "de-prose-dark";
  const crumbMuted = isLight ? "text-black/55 hover:text-[#1A1228]" : "text-white/70 hover:text-white";

  return (
    <div className={`min-h-screen ${pageClass}`}>
      <MegaMenu />

      {/* One <main> landmark per templated page: hero + content, chrome outside
          (a11y sweep 2026-09-12 — 41 pages had no main landmark). */}
      <main id="page-main">
      <section className={`relative overflow-hidden ${heroClass}`}>
        <div className="relative z-10 mx-auto max-w-7xl px-4 pt-[calc(var(--de-nav-offset)+1rem)] pb-12 sm:px-6 md:pt-[calc(var(--de-nav-offset)+1.5rem)] md:pb-16 lg:px-8">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <motion.nav
              className={`mb-6 flex flex-wrap items-center gap-2 text-sm ${isLight ? "text-black/55" : "text-white/70"}`}
              aria-label="Breadcrumb"
              initial={prefersReducedMotion ? false : revealInitial}
              animate={prefersReducedMotion ? undefined : revealInView}
              transition={revealTransition}
            >
              <Link href="/" className={`${crumbMuted} rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-de-accent`}>
                Home
              </Link>
              {breadcrumbs.map((crumb, index) => (
                <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className={`${crumbMuted} rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-de-accent`}
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={isLight ? "text-[#1A1228]" : "text-white"}>{crumb.label}</span>
                  )}
                </span>
              ))}
            </motion.nav>
          )}

          {showBackButton && !breadcrumbs && (
            <motion.div
              initial={prefersReducedMotion ? false : revealInitial}
              animate={prefersReducedMotion ? undefined : revealInView}
              transition={revealTransition}
            >
              <Button
                variant="ghost"
                className={`mb-6 -ml-4 min-h-11 ${
                  isLight
                    ? "text-black/70 hover:bg-black/[0.04] hover:text-[#1A1228]"
                    : "text-white/80 hover:bg-white/[0.06] hover:text-white"
                }`}
                onClick={() => window.history.back()}
                data-testid="button-back"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </motion.div>
          )}

          <div className="flex items-start gap-5">
            {icon && (
              <motion.div
                className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-de-hairline bg-de-raised text-de-accent-ink md:flex"
                initial={prefersReducedMotion ? false : revealInitial}
                animate={prefersReducedMotion ? undefined : revealInView}
                transition={revealTransition}
              >
                {icon}
              </motion.div>
            )}

            <div className="min-w-0 flex-1">
              <motion.div
                initial={prefersReducedMotion ? false : revealInitial}
                animate={prefersReducedMotion ? undefined : revealInView}
                transition={revealTransition}
              >
                <StatementHeading
                  as="h1"
                  className={`text-4xl leading-tight md:text-5xl lg:text-6xl ${isLight ? "text-[#1A1228]" : "text-white"}`}
                >
                  {title}
                </StatementHeading>
              </motion.div>

              {subtitle && (
                <motion.p
                  className={`mt-4 max-w-3xl text-lg leading-relaxed md:text-xl ${
                    isLight ? "text-black/65" : "text-white/80"
                  }`}
                  initial={prefersReducedMotion ? false : revealInitial}
                  animate={prefersReducedMotion ? undefined : revealInView}
                  transition={{ ...revealTransition, delay: prefersReducedMotion ? 0 : 0.045 }}
                >
                  {subtitle}
                </motion.p>
              )}

              {actions && (
                <motion.div
                  className="mt-8"
                  initial={prefersReducedMotion ? false : revealInitial}
                  animate={prefersReducedMotion ? undefined : revealInView}
                  transition={{ ...revealTransition, delay: prefersReducedMotion ? 0 : 0.09 }}
                >
                  {actions}
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className={`py-12 md:py-16 lg:py-20 ${contentClass}`}>
        <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${textClass} ${proseClass}`}>
          {children}
        </div>
      </section>
      </main>

      <DigeratiEnhancedFooterSection />
    </div>
  );
};
