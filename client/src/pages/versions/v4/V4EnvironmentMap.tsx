import { useEffect, useMemo, useRef, useState } from "react";
import { T } from "./V4Primitives";

/**
 * The visitor's own environment, drawn from numbers they typed.
 *
 * This replaces the abstract constellation the first V4 draft used. That
 * version was a ring of nine unnamed dots — decorative, generic, and the same
 * "abstract lines" idiom that was rejected on Experience v1. Nothing on screen
 * belonged to the person looking at it.
 *
 * Here every mark is theirs: one per person, one per device, grouped into the
 * sites they told us about. The transformation still happens — an unknown
 * environment becomes a counted one — and it is THEIR environment, with
 * their numbers, which is the only version of this idea that earns the space.
 * Chapter 10 draws it once more with one edge around all of it.
 *
 * Motion, deliberately small and only on the visitor's own data: a newly
 * typed number is answered by its marks settling in (240ms, staggered), and
 * the final frame's edge draws itself once the frame is in view. Under
 * prefers-reduced-motion both are simply there.
 *
 * People appear as presence, never as faces, per design/IMAGERY.md.
 * Code-built; no generated imagery; nothing here claims a metric.
 */

export type EnvironmentCounts = {
  users: number;
  devices: number;
  sites: number;
};

const MAX_SITES_DRAWN = 6;
const MAX_MARKS_PER_SITE = 40;

function clampInt(v: string, max: number): number {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

export function parseEnvironment(users: string, devices: string, sites: string): EnvironmentCounts {
  return {
    users: clampInt(users, 9999),
    devices: clampInt(devices, 9999),
    sites: clampInt(sites, 999),
  };
}

/** Two frames later, so the browser has painted the "before" state and the transition has somewhere to start. */
function useSettled(reduced: boolean): boolean {
  const [settled, setSettled] = useState(reduced);
  useEffect(() => {
    if (reduced) {
      setSettled(true);
      return;
    }
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setSettled(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [reduced]);
  return settled;
}

const PERSON = "block h-2.5 w-2.5 rounded-full bg-white/80";
const DEVICE = "block h-2.5 w-2.5 rounded-sm border border-white/30";

/** One person or one device. New marks settle in; marks already on screen stay put. */
function Mark({ kind, index, reduced }: { kind: "person" | "device"; index: number; reduced: boolean }) {
  const settled = useSettled(reduced);
  return (
    <span
      className={kind === "person" ? PERSON : DEVICE}
      style={
        reduced
          ? undefined
          : {
              opacity: settled ? 1 : 0,
              transform: settled ? "scale(1)" : "scale(0.4)",
              transition: "opacity 240ms ease, transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)",
              transitionDelay: `${Math.min(index, 24) * 14}ms`,
            }
      }
    />
  );
}

export function EnvironmentMap({
  environment,
  reduced,
  /** The final frame draws the same environment with one accountable edge around it. */
  framed = false,
}: {
  environment: EnvironmentCounts;
  reduced: boolean;
  framed?: boolean;
}) {
  const { users, devices, sites } = environment;
  const empty = users === 0 && devices === 0 && sites === 0;

  const layout = useMemo(() => {
    const siteCount = Math.max(1, Math.min(sites || 1, MAX_SITES_DRAWN));
    // Spread people and devices across the sites as evenly as the counts allow.
    return Array.from({ length: siteCount }, (_, i) => {
      const share = (total: number) =>
        Math.floor(total / siteCount) + (i < total % siteCount ? 1 : 0);
      return { users: share(users), devices: share(devices) };
    });
  }, [users, devices, sites]);

  const cols = layout.length > 3 ? 3 : layout.length > 1 ? 2 : 1;

  // The frame draws its edge once it is actually on screen — once, and only
  // when framed. Reduced motion: the edge is there from the start.
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(!framed || reduced);
  useEffect(() => {
    if (!framed || reduced || inView) return;
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [framed, reduced, inView]);

  return (
    <div
      ref={rootRef}
      className={framed ? "w-full rounded-2xl border p-3 sm:p-4" : "w-full"}
      style={
        framed
          ? {
              // The accent token, not a literal, so the frame follows the theme.
              borderColor: inView ? "rgb(var(--de-accent-rgb) / 0.5)" : "rgb(var(--de-accent-rgb) / 0)",
              transition: reduced ? undefined : "border-color 700ms ease",
            }
          : undefined
      }
      data-testid="v4-environment"
      data-empty={empty ? "true" : "false"}
      data-sites={sites}
      data-framed={framed ? "true" : "false"}
      data-in={inView ? "true" : "false"}
    >
      <div
        className={`grid gap-3 ${cols === 1 ? "grid-cols-1" : cols === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}
      >
        {layout.map((site, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <span className={`${T.micro} text-white/55`}>
                {sites > MAX_SITES_DRAWN && i === MAX_SITES_DRAWN - 1
                  ? `+${sites - MAX_SITES_DRAWN + 1} sites`
                  : `Site ${i + 1}`}
              </span>
              {/* Each site reads as a place with people and devices in it. */}
              <span className="font-mono text-[9.5px] tabular-nums text-white/55">
                {site.users} · {site.devices}
              </span>
            </div>

            {/* People — presence, never faces. */}
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: Math.min(site.users, MAX_MARKS_PER_SITE) }, (_, k) => (
                <Mark key={`u${k}`} kind="person" index={k} reduced={reduced} />
              ))}
              {site.users > MAX_MARKS_PER_SITE && (
                <span className="ml-1 font-mono text-[9.5px] text-white/55">
                  +{site.users - MAX_MARKS_PER_SITE}
                </span>
              )}
            </div>

            {/* Devices — squares, so the two never read as the same thing. */}
            {site.devices > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {Array.from({ length: Math.min(site.devices, MAX_MARKS_PER_SITE) }, (_, k) => (
                  <Mark key={`d${k}`} kind="device" index={k} reduced={reduced} />
                ))}
                {site.devices > MAX_MARKS_PER_SITE && (
                  <span className="ml-1 font-mono text-[9.5px] text-white/55">
                    +{site.devices - MAX_MARKS_PER_SITE}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={`mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 ${T.micro} text-white/55`}>
        <span className="inline-flex items-center gap-1.5">
          <span className={PERSON} />
          {users === 1 ? "1 person" : `${users} people`}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className={DEVICE} />
          {devices === 1 ? "1 device" : `${devices} devices`}
        </span>
        {/* One site is drawn until a count is typed; the legend says so
            instead of reporting "0 sites" beside a drawn site. */}
        <span>{sites > 0 ? (sites === 1 ? "1 site" : `${sites} sites`) : "sites not set"}</span>
        {framed && (
          <span
            className="text-de-accent-ink"
            style={
              reduced
                ? undefined
                : { opacity: inView ? 1 : 0, transition: "opacity 400ms ease 300ms" }
            }
          >
            · one accountable team
          </span>
        )}
      </div>
    </div>
  );
}
