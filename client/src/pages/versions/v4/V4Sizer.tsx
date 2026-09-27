import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import {
  readSolutionDraft,
  writeSolutionDraft,
  patchEnvironment,
  SOLUTION_DRAFT_EVENT,
} from "@/lib/solutionDraft";
import { V4Estate, parseEstate } from "./V4Estate";

/**
 * The hero's working part: three numbers in, the visitor's estate out.
 *
 * It writes to the SAME solution draft the store reads
 * (client/src/lib/solutionDraft.ts, key "de-solution-draft-v2"), so someone
 * who types their numbers here arrives at /store with the profile already
 * filled. That is "reuse shared infrastructure only when it is actually
 * correct": the store's own headline is "Set your users, devices, and sites
 * once," and this is that once.
 *
 * No contract, no sales call, no vendor catalog — the store's own promise,
 * now made on the first screen of the site instead of three clicks in.
 */

type Field = "userCount" | "workstationCount" | "siteCount";

const FIELDS: Array<{ key: Field; label: string; hint: string; max: number }> = [
  { key: "userCount", label: "People", hint: "who log in", max: 9999 },
  { key: "workstationCount", label: "Computers", hint: "laptops and desktops", max: 9999 },
  { key: "siteCount", label: "Sites", hint: "offices, clinics, plants", max: 999 },
];

function digitsOnly(v: string, max: number): string {
  const cleaned = v.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
  if (cleaned === "") return "";
  return String(Math.min(Number.parseInt(cleaned, 10), max));
}

export function V4Sizer({ reduced }: { reduced: boolean }) {
  const [values, setValues] = useState<Record<Field, string>>({
    userCount: "",
    workstationCount: "",
    siteCount: "",
  });

  // A returning visitor sees the numbers they already gave the store.
  useEffect(() => {
    try {
      const d = readSolutionDraft();
      setValues({
        userCount: d.environment.userCount || "",
        workstationCount: d.environment.workstationCount || "",
        siteCount: d.environment.siteCount || "",
      });
    } catch {
      // No storage, no saved draft — start empty.
    }
  }, []);

  const set = (key: Field, raw: string) => {
    const field = FIELDS.find((f) => f.key === key)!;
    const next = { ...values, [key]: digitsOnly(raw, field.max) };
    setValues(next);
    try {
      const draft = readSolutionDraft();
      writeSolutionDraft(patchEnvironment(draft, { [key]: next[key] }));
      window.dispatchEvent(new CustomEvent(SOLUTION_DRAFT_EVENT));
    } catch {
      // Storage unavailable (private mode, blocked). The hero still works;
      // the store simply will not be pre-filled.
    }
  };

  const estate = useMemo(
    () => parseEstate(values.userCount, values.workstationCount, values.siteCount),
    [values],
  );
  const started = estate.users > 0 || estate.devices > 0 || estate.sites > 0;

  return (
    <div className="w-full" data-testid="v4-sizer" data-started={started ? "true" : "false"}>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="block min-w-0">
            <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
              {f.label}
            </span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={values[f.key]}
              placeholder="0"
              onChange={(e) => set(f.key, e.target.value)}
              aria-label={`${f.label}, ${f.hint}`}
              data-testid={`v4-sizer-${f.key}`}
              className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-3 font-['Space_Grotesk',sans-serif] text-[clamp(1.4rem,3vw,2rem)] font-bold tabular-nums text-[#F7F5F2] outline-none placeholder:text-white/20 focus-visible:border-[#F04C97] focus-visible:ring-2 focus-visible:ring-[#F04C97]/40"
            />
            <span className="mt-1 block text-[11px] text-white/35">{f.hint}</span>
          </label>
        ))}
      </div>

      <div className="mt-6 min-h-[132px]">
        {started ? (
          <V4Estate estate={estate} reduced={reduced} />
        ) : (
          <p className="max-w-[44ch] text-[13.5px] leading-relaxed text-white/45">
            Three numbers is all it takes. They stay on this device, and this step asks
            for no contact details.
          </p>
        )}
      </div>

      {started && (
        <Link
          href="/store"
          data-testid="v4-cta-store"
          className="group mt-5 inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-[13.5px] font-semibold text-[#F7F5F2] transition-colors hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F04C97] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050312]"
        >
          See what fits this environment
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
