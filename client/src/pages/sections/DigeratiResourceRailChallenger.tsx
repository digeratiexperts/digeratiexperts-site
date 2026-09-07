import { ArrowRight, BookOpen, ShieldAlert } from "lucide-react";

/**
 * Replaces the large live-threat feed on the challenger homepage with a small
 * handoff to the two existing destinations that own this content.
 * No threat or editorial content is deleted or duplicated here.
 */
export const DigeratiResourceRailChallenger = (): JSX.Element => {
  return (
    <section className="de-dark-well relative py-4 md:py-6" aria-label="Security intelligence and insights">
      <div className="mx-auto max-w-[var(--de-canvas)] px-3 sm:px-4 lg:px-6">
        <div className="grid overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] md:grid-cols-2">
          <a
            href="/resources/security-updates"
            className="group flex min-h-24 items-center gap-4 p-5 transition-colors hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D3126A] md:border-r md:border-white/10"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#D3126A]/30 bg-[#D3126A]/10 text-[#F15A9B]">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-white/50">Live intelligence</span>
              <span className="mt-1 block text-base font-semibold text-white">Security Updates</span>
              <span className="mt-1 block text-sm leading-5 text-white/60">Active exploitation, CISA advisories, Microsoft security updates, and scored SMB relevance.</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-white/40 transition-transform group-hover:translate-x-1 group-hover:text-white" aria-hidden="true" />
          </a>

          <a
            href="/resources/blog"
            className="group flex min-h-24 items-center gap-4 p-5 transition-colors hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D3126A]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/80">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-white/50">Guidance & analysis</span>
              <span className="mt-1 block text-base font-semibold text-white">Digerati Journal</span>
              <span className="mt-1 block text-sm leading-5 text-white/60">Practical security, compliance, cloud, identity, and managed IT guidance for business leaders.</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-white/40 transition-transform group-hover:translate-x-1 group-hover:text-white" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
};
