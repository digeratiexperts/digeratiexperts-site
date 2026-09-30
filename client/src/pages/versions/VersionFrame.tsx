import type { ReactNode } from "react";
import { Link } from "wouter";
import { useSEO } from "@/hooks/useSEO";
import { versionByNumber } from "./registry";

/**
 * Wraps a frozen homepage snapshot: marks the page noindex with the canonical
 * pointing at the real homepage, and pins a small ribbon so whoever is
 * looking knows which version this is. useSEO here runs after the
 * snapshot's own useSEO (parent effects run after children), so the noindex
 * wins.
 */
export function VersionFrame({ n, children }: { n: number; children: ReactNode }): JSX.Element {
  const v = versionByNumber(n);
  useSEO({
    title: `Homepage version ${n}${v ? `: ${v.title}` : ""} (reference)`,
    description: v?.summary,
    canonical: "/",
    noIndex: true,
  });
  return (
    <>
      {children}
      {/*
        Review scaffolding, not part of any version's design. Collapsed, it is an
        11px tab flush with the viewport edge, narrower than the smallest text
        margin on any version page (12px: v1, v3 and the site footer at 390), so no
        line of copy scrolls beneath it. A 39px chip at left-3 covered the first
        letters of every line below 1280px.
        It reveals the title and the index link on hover or keyboard focus. No
        transition: the version pages are checked under prefers-reduced-motion.
      */}
      <div
        className="group fixed bottom-24 left-0 z-[70] flex items-center gap-2 rounded-r-md border border-l-0 border-[#D3126A]/60 bg-[#050312]/90 py-1.5 font-mono text-[11px] font-semibold tracking-[0.12em] text-white shadow-lg shadow-black/40 backdrop-blur focus-within:pr-3 hover:pr-3"
        data-testid="homepage-version-ribbon"
        role="note"
        aria-label={`Homepage version ${n}, reference copy`}
      >
        <span className="text-[10px] leading-none text-[#F04C97] [writing-mode:vertical-rl]">V{n}</span>
        <span className="hidden text-white/80 group-focus-within:inline group-hover:inline">
          {v?.title ?? "Homepage version"}
        </span>
        <span className="hidden text-white/40 group-focus-within:inline group-hover:inline">·</span>
        {/* sr-only rather than hidden: display:none would drop it out of the tab order. */}
        <Link
          href="/versions"
          className="sr-only text-white underline decoration-white/30 underline-offset-4 group-hover:not-sr-only focus:not-sr-only hover:decoration-white"
        >
          all versions
        </Link>
      </div>
    </>
  );
}
