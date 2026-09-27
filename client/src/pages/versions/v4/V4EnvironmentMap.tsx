import { useMemo } from "react";

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

/** Lay marks in a tidy block, so a site reads as a place rather than a spray. */
function marksFor(count: number, cols: number) {
  const drawn = Math.min(count, MAX_MARKS_PER_SITE);
  return Array.from({ length: drawn }, (_, i) => ({
    col: i % cols,
    row: Math.floor(i / cols),
  }));
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

  return (
    <div
      className={framed ? "w-full rounded-2xl border border-[#D3126A]/50 p-3 sm:p-4" : "w-full"}
      data-testid="v4-environment"
      data-empty={empty ? "true" : "false"}
      data-sites={sites}
      data-framed={framed ? "true" : "false"}
    >
      <div
        className={`grid gap-3 ${cols === 1 ? "grid-cols-1" : cols === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}
      >
        {layout.map((site, i) => (
          <div
            key={i}
            className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
            style={
              reduced
                ? undefined
                : { transition: "border-color 220ms ease, background-color 220ms ease" }
            }
          >
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-white/35">
                {sites > MAX_SITES_DRAWN && i === MAX_SITES_DRAWN - 1
                  ? `+${sites - MAX_SITES_DRAWN + 1} sites`
                  : `Site ${i + 1}`}
              </span>
              {/* Each site reads as a place with people and devices in it. */}
              <span className="font-mono text-[9.5px] tabular-nums text-white/35">
                {site.users} · {site.devices}
              </span>
            </div>

            {/* People — presence, never faces. */}
            <div className="flex flex-wrap gap-[3px]">
              {marksFor(site.users, 10).map((_, k) => (
                <span
                  key={`u${k}`}
                  className="block h-[10px] w-[10px] rounded-full bg-[#F7F5F2]/80"
                />
              ))}
              {site.users > MAX_MARKS_PER_SITE && (
                <span className="ml-1 font-mono text-[9px] text-white/40">
                  +{site.users - MAX_MARKS_PER_SITE}
                </span>
              )}
            </div>

            {/* Devices — squares, so the two never read as the same thing. */}
            {site.devices > 0 && (
              <div className="mt-2 flex flex-wrap gap-[3px]">
                {marksFor(site.devices, 10).map((_, k) => (
                  <span
                    key={`d${k}`}
                    className="block h-[10px] w-[10px] rounded-[1.5px] border border-white/30"
                  />
                ))}
                {site.devices > MAX_MARKS_PER_SITE && (
                  <span className="ml-1 font-mono text-[9px] text-white/40">
                    +{site.devices - MAX_MARKS_PER_SITE}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
        <span className="inline-flex items-center gap-1.5">
          <span className="block h-[10px] w-[10px] rounded-full bg-[#F7F5F2]/80" />
          {users === 1 ? "1 person" : `${users} people`}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="block h-[10px] w-[10px] rounded-[1.5px] border border-white/30" />
          {devices === 1 ? "1 device" : `${devices} devices`}
        </span>
        <span>{sites === 1 ? "1 site" : `${sites} sites`}</span>
        {framed && <span className="text-[#F04C97]">· one accountable team</span>}
      </div>
    </div>
  );
}
