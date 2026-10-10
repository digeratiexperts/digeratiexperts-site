/**
 * /events — the public calendar of live DE sessions.
 *
 * Public sessions only (client/src/data/deEvents.ts). The full operating
 * calendar, with client-only and internal events, is internal and lives in
 * docs/marketing/ — it is never rendered here.
 */

import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { PageTemplate } from "@/components/PageTemplate";
import { useSEO } from "@/hooks/useSEO";
import { CAMPAIGNS } from "@/data/campaigns";
import {
  DE_EVENT_TIME_ZONE,
  isIndexable,
  sessionEnd,
  sessionStart,
  upcomingSessions,
  type DeEventSession,
} from "@/data/deEvents";

const tz = { timeZone: DE_EVENT_TIME_ZONE } as const;

function monthKey(session: DeEventSession): string {
  return sessionStart(session).toLocaleDateString("en-US", { month: "long", year: "numeric", ...tz });
}

function SessionCard({ session }: { session: DeEventSession }) {
  const start = sessionStart(session);
  const campaign = CAMPAIGNS.find((c) => c.slug === session.campaign);
  return (
    <li>
      <Link
        href={`/events/${session.slug}`}
        className="group flex gap-4 rounded-2xl border border-de-hairline bg-de-raised p-4 transition duration-200 ease-out hover:border-[#D3126A]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] sm:p-5"
      >
        <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-xl bg-[#D3126A] text-white">
          <span className="font-mono text-2xl font-bold leading-none tabular-nums">
            {start.toLocaleDateString("en-US", { day: "numeric", ...tz })}
          </span>
          <span className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em]">
            {start.toLocaleDateString("en-US", { month: "short", ...tz })}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-de-muted-soft">
            {session.format} ·{" "}
            {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", ...tz })}–
            {sessionEnd(session).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", ...tz })} Arizona
            {session.status === "planned" ? <span className="text-white"> · Planned</span> : null}
          </p>
          <h3 className="mt-1.5 text-lg font-semibold leading-snug text-white">{session.title}</h3>
          <p className="mt-1 text-sm text-de-muted-soft">{session.summary}</p>
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
            Details and registration
            <ArrowRight className="h-4 w-4 text-[#D3126A] transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
            {campaign ? <span className="ml-2 font-normal text-de-muted-soft">· {campaign.offerName}</span> : null}
          </p>
        </div>
      </Link>
    </li>
  );
}

export default function EventsIndex() {
  const sessions = upcomingSessions();
  useSEO({
    title: "Live Sessions and Webinars | Digerati Experts",
    description:
      "Free live sessions from Digerati Experts on cyber insurance readiness, invoice fraud, ransomware recovery and co-managed IT. All times Arizona.",
    canonical: "/events",
    // Indexed only once at least one session is confirmed (Tier 0: no
    // search listing for an event that is still a plan).
    noIndex: !sessions.some(isIndexable),
  });

  const byMonth = new Map<string, DeEventSession[]>();
  for (const session of sessions) {
    const key = monthKey(session);
    byMonth.set(key, [...(byMonth.get(key) ?? []), session]);
  }

  return (
    <PageTemplate
      title="Live sessions"
      subtitle="One working hour a month on the problem that season brings: insurance renewals in the fall, invoice fraud at the holidays, restores in the new year. Free, live, and Arizona time."
      variant="dark"
      breadcrumbs={[{ label: "Live sessions" }]}
    >
      <section className="bg-de-bg py-10 md:py-14 lg:py-16" aria-labelledby="events-upcoming">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 id="events-upcoming" className="sr-only">
            Upcoming sessions
          </h2>
          {sessions.length === 0 ? (
            <p className="text-de-muted-soft">
              No sessions are scheduled right now. <Link href="/contact" className="text-white underline">Ask us</Link> about
              the next one.
            </p>
          ) : (
            [...byMonth.entries()].map(([month, list]) => (
              <div key={month} className="mb-10 last:mb-0">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-de-muted-soft">
                  {month}
                  <span className="text-[#D3126A]">.</span>
                </p>
                <ul className="mt-4 grid gap-3">
                  {list.map((session) => (
                    <SessionCard key={session.slug} session={session} />
                  ))}
                </ul>
              </div>
            ))
          )}
          <p className="mt-10 text-sm text-de-muted-soft">
            Dates marked <span className="text-white">Planned</span> are being confirmed. Register interest and we'll email
            you the confirmed date and join link.
          </p>
        </div>
      </section>
    </PageTemplate>
  );
}
