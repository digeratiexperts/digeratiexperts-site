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
      <div
        className="fixed bottom-24 left-3 z-[70] flex items-center gap-2 rounded-full border border-[#D3126A]/60 bg-[#050312]/90 px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[0.12em] text-white shadow-lg shadow-black/40 backdrop-blur"
        data-testid="homepage-version-ribbon"
        role="note"
        aria-label={`Homepage version ${n}, reference copy`}
      >
        <span className="text-[#F04C97]">V{n}</span>
        <span className="text-white/80">{v?.title ?? "Homepage version"}</span>
        <span className="text-white/40">·</span>
        <Link href="/versions" className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">
          all versions
        </Link>
      </div>
    </>
  );
}
