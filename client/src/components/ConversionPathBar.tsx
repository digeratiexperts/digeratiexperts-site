import type { ReactNode } from "react";
import { ArrowRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";

type ConversionPathBarProps = {
  kicker?: string;
  headline: string;
  body: string;
  perks?: string[];
  primaryHref?: string;
  primaryLabel?: string;
  primaryTestId?: string;
  showPhone?: boolean;
  /** Extra action rendered after the primary button (e.g. page-specific mailto). */
  extraAction?: ReactNode;
};

/**
 * Magenta conversion-path bar used on inner marketing pages.
 * Primary CTA stays on /book unless the page purpose is a report/mailto.
 */
export function ConversionPathBar({
  kicker = "CYBER RISK ASSESSMENT & SUPPORT",
  headline,
  body,
  perks,
  primaryHref = "/book",
  primaryLabel = CTA.primary,
  primaryTestId = "button-conversion-assessment",
  showPhone = true,
  extraAction,
}: ConversionPathBarProps): JSX.Element {
  return (
    <div className="rounded-2xl border border-[#D3126A]/40 bg-[#D3126A] px-6 py-8 text-center md:px-12 md:py-10 shadow-[0_20px_50px_-15px_rgba(211,18,106,0.35)]">
      {kicker ? (
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-white font-mono">
          {kicker}
        </p>
      ) : null}
      <h2 className="mb-3 font-heading text-2xl font-bold text-white md:text-3xl lg:text-4xl tracking-tight">{headline}</h2>
      <p className="mx-auto mb-6 max-w-2xl text-base text-white md:text-lg">{body}</p>

      {perks && perks.length > 0 ? (
        <div className="mx-auto mb-7 max-w-xl grid grid-cols-1 gap-2 rounded-xl bg-black/20 p-3 sm:grid-cols-2 text-left">
          {perks.map((item) => (
            <div key={item} className="flex items-baseline gap-2 text-xs font-semibold text-white">
              <span className="mt-[0.55em] h-px w-2.5 shrink-0 bg-white" aria-hidden="true" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col justify-center gap-4 sm:flex-row">
        <Button asChild size="lg" className="h-12 bg-white px-8 font-semibold text-[#D3126A] hover:bg-white/95 shadow-md">
          <a href={primaryHref} data-testid={primaryTestId}>
            {primaryLabel}
            <ArrowRight className="ml-1 h-5 w-5" aria-hidden="true" />
          </a>
        </Button>
        {showPhone ? (
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 border-white/70 bg-transparent px-8 font-semibold text-white hover:bg-white/10 hover:text-white"
          >
            <a href={PRIMARY_PHONE.telHref} data-testid="button-conversion-call">
              <Phone className="mr-1 h-5 w-5" aria-hidden="true" />
              Call {PRIMARY_PHONE.display}
            </a>
          </Button>
        ) : null}
        {extraAction}
      </div>
    </div>
  );
}
