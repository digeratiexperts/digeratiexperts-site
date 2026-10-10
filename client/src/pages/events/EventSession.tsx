/**
 * A live DE session page: /events/:slug.
 *
 * SURFACE: marketing core (surface B, design/UI-STYLE-RULES.md) — graphite
 * well, raised panels, white type, magenta as action and punctuation. The
 * date tile, countdown rings and calendar/time-zone row follow the shape of a
 * webinar registration page; the colour and type are DE's, nothing else's.
 *
 * TRUTH (Tier 0): a `planned` session says so beside the date, is noindex, and
 * the form registers interest rather than promising a seat or a join link that
 * does not exist yet. Registrations post to /api/contact, so each one becomes
 * a Zoho CRM lead the weekly pipeline review picks up.
 */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useRoute } from "wouter";
import { ArrowRight, CalendarPlus, CheckCircle2, Clock, Globe2, Users } from "lucide-react";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSEO } from "@/hooks/useSEO";
import { useBooking } from "@/contexts/BookingContext";
import { CTA } from "@/lib/ctaCopy";
import { buildIcs } from "@/lib/ics";
import { CAMPAIGNS } from "@/data/campaigns";
import {
  DE_EVENT_TIME_ZONE,
  countdownTo,
  isIndexable,
  sessionBySlug,
  sessionEnd,
  sessionStart,
  type DeEventSession,
} from "@/data/deEvents";
import NotFound from "@/pages/not-found";

export const TIME_ZONE_CHOICES: { id: string; label: string }[] = [
  { id: "America/Phoenix", label: "Arizona (America/Phoenix)" },
  { id: "America/Los_Angeles", label: "Pacific (America/Los_Angeles)" },
  { id: "America/Denver", label: "Mountain (America/Denver)" },
  { id: "America/Chicago", label: "Central (America/Chicago)" },
  { id: "America/New_York", label: "Eastern (America/New_York)" },
  { id: "UTC", label: "UTC" },
];

function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

function formatTime(date: Date, timeZone: string): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
}

function datePart(date: Date, timeZone: string, part: Intl.DateTimeFormatOptions): string {
  return date.toLocaleDateString("en-US", { ...part, timeZone });
}

function downloadIcs(session: DeEventSession) {
  const body = buildIcs(
    [
      {
        uid: `session-${session.slug}@digeratiexperts.com`,
        summary: `Digerati Experts: ${session.title}`,
        description: `${session.summary}\n\nThe join link is emailed to registrants before the session.\n${window.location.origin}/events/${session.slug}`,
        start: session.start.slice(0, 16),
        durationMinutes: session.durationMinutes,
        url: `${window.location.origin}/events/${session.slug}`,
        location: "Online",
      },
    ],
    { calendarName: "Digerati Experts" },
  );
  const url = URL.createObjectURL(new Blob([body], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${session.slug}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** One countdown ring. The arc shows the unit's share of its next unit up. */
function Ring({ value, max, label }: { value: number; max: number; label: string }) {
  const r = 34;
  const circumference = 2 * Math.PI * r;
  const share = Math.min(1, value / max);
  return (
    <div className="flex flex-col items-center" role="group" aria-label={`${value} ${label}`}>
      <div className="relative h-[76px] w-[76px] sm:h-[88px] sm:w-[88px]">
        <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke="#D3126A"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - share)}
            className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-mono text-2xl font-semibold tabular-nums text-white sm:text-[28px]">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-de-muted-soft">{label}</span>
    </div>
  );
}

function RegistrationForm({ session }: { session: DeEventSession }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const planned = session.status === "planned";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setState("sending");
    setError("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") ?? "").trim(),
          email: String(data.get("email") ?? "").trim(),
          phone: String(data.get("phone") ?? "").trim(),
          company: String(data.get("company") ?? "").trim(),
          website_url: String(data.get("website_url") ?? ""),
          service: `Event registration: ${session.slug}`,
          message: `${planned ? "Registered interest in" : "Registered for"} "${session.title}" (${session.start}, ${session.format}). Campaign: /go/${session.campaign}.`,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Registration failed");
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-de-hairline bg-de-raised p-6" role="status">
        <CheckCircle2 className="h-8 w-8 text-[#D3126A]" aria-hidden="true" />
        <h3 className="mt-3 text-xl font-semibold text-white">You're on the list</h3>
        <p className="mt-2 text-sm text-de-muted-soft">
          {planned
            ? "We'll email you when the date is confirmed, with the join link before the session."
            : "We'll email the join link before the session. Add it to your calendar so it doesn't slip."}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-4 border-de-hairline bg-transparent text-white hover:bg-white/10 hover:text-white"
          onClick={() => downloadIcs(session)}
        >
          <CalendarPlus className="mr-2 h-4 w-4" aria-hidden="true" />
          Add to calendar
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-de-hairline bg-de-raised p-6" aria-labelledby="register-heading">
      <h3 id="register-heading" className="text-xl font-semibold text-white">
        {planned ? "Register your interest" : "Save your seat"}
      </h3>
      <p className="mt-1 text-sm text-de-muted-soft">Free. One email with the join link, one reminder.</p>
      <div className="mt-5 grid gap-4">
        {[
          { id: "name", label: "Name", type: "text", autoComplete: "name", required: true },
          { id: "email", label: "Work email", type: "email", autoComplete: "email", required: true },
          { id: "phone", label: "Phone", type: "tel", autoComplete: "tel", required: true },
          { id: "company", label: "Company", type: "text", autoComplete: "organization", required: false },
        ].map((field) => (
          <div key={field.id} className="grid gap-1.5">
            <Label htmlFor={`reg-${field.id}`} className="text-sm text-white">
              {field.label}
              {field.required ? <span className="text-[#D3126A]" aria-hidden="true"> *</span> : null}
            </Label>
            <Input
              id={`reg-${field.id}`}
              name={field.id}
              type={field.type}
              autoComplete={field.autoComplete}
              required={field.required}
              className="h-11 border-de-hairline bg-de-bg text-white placeholder:text-de-muted-soft"
            />
          </div>
        ))}
        {/* Honeypot: real people never see or fill this. */}
        <input type="text" name="website_url" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      </div>
      {state === "error" ? (
        <p className="mt-3 text-sm text-red-300" role="alert">
          {error}. Please try again, or call us.
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        disabled={state === "sending"}
        className="mt-5 w-full bg-[#D3126A] text-white transition duration-200 ease-out hover:bg-[#b50f5a] active:scale-[0.98]"
        data-testid="event-register-submit"
      >
        {state === "sending" ? "Sending…" : planned ? "Register interest" : "Register"}
        <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
      </Button>
    </form>
  );
}

export default function EventSession() {
  const [, params] = useRoute("/events/:slug");
  const session = params ? sessionBySlug(params.slug) : undefined;

  useSEO({
    title: session ? `${session.title} | Live Session` : "Session not found",
    description: session?.summary ?? "",
    canonical: session ? `/events/${session.slug}` : undefined,
    noIndex: !session || !isIndexable(session),
  });

  const [timeZone, setTimeZone] = useState<string>(DE_EVENT_TIME_ZONE);
  const [now, setNow] = useState(() => new Date());
  const { openBooking } = useBooking();

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const zones = useMemo(() => {
    const local = browserTimeZone();
    return local && !TIME_ZONE_CHOICES.some((z) => z.id === local)
      ? [...TIME_ZONE_CHOICES, { id: local, label: `Your time zone (${local})` }]
      : TIME_ZONE_CHOICES;
  }, []);

  if (!session) return <NotFound />;

  const start = sessionStart(session);
  const end = sessionEnd(session);
  const countdown = countdownTo(start, now);
  const over = now.getTime() > end.getTime();
  const campaign = CAMPAIGNS.find((c) => c.slug === session.campaign);

  return (
    <div className="min-h-screen bg-de-bg">
      <MegaMenu />
      <main id="main-content" tabIndex={-1} className="de-nav-clear">
        {/* ------------------------------------------------------------ hero */}
        <section className="relative overflow-hidden py-12 md:py-16 lg:py-20" aria-labelledby="session-title">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(60% 50% at 50% 0%, rgba(91,69,224,0.14), transparent 70%)" }}
          />
          <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-de-muted-soft">
              <Link href="/events" className="hover:text-white">Live sessions</Link>
              <span className="text-[#D3126A]"> / </span>
              {session.format}
            </p>
            <h1
              id="session-title"
              className="mx-auto mt-4 max-w-3xl text-balance text-3xl font-semibold tracking-tight text-white md:text-5xl md:leading-[1.08]"
            >
              {session.title}
            </h1>

            {/* Date tile */}
            <div className="mx-auto mt-8 inline-flex overflow-hidden rounded-xl border border-de-hairline bg-de-raised text-left">
              <div className="flex w-24 flex-col items-center justify-center bg-[#D3126A] px-3 py-3 text-white">
                <span className="font-mono text-3xl font-bold leading-none tabular-nums">
                  {datePart(start, timeZone, { day: "numeric" })}
                </span>
                <span className="mt-1 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.1em]">
                  {datePart(start, timeZone, { month: "short" })} {datePart(start, timeZone, { year: "numeric" })}
                </span>
              </div>
              <div className="px-5 py-3">
                <p className="text-xl font-semibold text-white tabular-nums md:text-2xl">
                  {formatTime(start, timeZone)} – {formatTime(end, timeZone)}
                </p>
                <p className="mt-0.5 text-sm text-de-muted-soft">
                  {datePart(start, timeZone, { weekday: "long" })} · {timeZone}
                  {session.status === "planned" ? (
                    <span className="ml-2 rounded-full border border-[#D3126A]/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white">
                      Planned
                    </span>
                  ) : null}
                </p>
              </div>
            </div>

            {/* Calendar + time zone */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm">
              <button
                type="button"
                onClick={() => downloadIcs(session)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-white underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] focus-visible:ring-offset-2 focus-visible:ring-offset-de-bg"
              >
                <CalendarPlus className="h-5 w-5 text-[#D3126A]" aria-hidden="true" />
                Add to calendar
              </button>
              <label className="inline-flex min-h-[44px] items-center gap-2 text-white">
                <Globe2 className="h-5 w-5 text-[#D3126A]" aria-hidden="true" />
                <span className="sr-only">Change time zone</span>
                <select
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  className="rounded-lg border border-de-hairline bg-de-raised px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]"
                  data-testid="event-timezone"
                >
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Countdown */}
            <div className="mt-10">
              <p className="text-lg text-white">
                {over ? "This session has ended" : countdown.started ? "The session is live now" : "The session starts in"}
              </p>
              {!countdown.started ? (
                <div className="mt-5 flex justify-center gap-3 sm:gap-6" aria-live="off">
                  <Ring value={countdown.days} max={Math.max(30, countdown.days)} label="Days" />
                  <Ring value={countdown.hours} max={24} label="Hours" />
                  <Ring value={countdown.minutes} max={60} label="Min" />
                  <Ring value={countdown.seconds} max={60} label="Sec" />
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------- body + form */}
        <section className="bg-de-surface py-10 md:py-14 lg:py-16" aria-labelledby="session-about">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-de-muted-soft">Why now</p>
              <h2 id="session-about" className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                {session.summary}
              </h2>
              <p className="mt-4 max-w-2xl text-de-muted-soft">{session.hook}</p>

              <h3 className="mt-10 text-lg font-semibold text-white">What you'll leave with</h3>
              <ul className="mt-4 grid gap-3">
                {session.takeaways.map((item) => (
                  <li key={item} className="flex gap-3 text-de-muted-soft">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D3126A]" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <h3 className="mt-10 text-lg font-semibold text-white">Agenda</h3>
              <ol className="mt-4 divide-y divide-white/10 rounded-2xl border border-de-hairline bg-de-raised">
                {session.agenda.map((step, index) => (
                  <li key={step.title} className="flex items-baseline gap-4 px-5 py-3">
                    <span className="font-mono text-sm tabular-nums text-[#D3126A]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 text-white">{step.title}</span>
                    <span className="inline-flex items-center gap-1 font-mono text-xs text-de-muted-soft">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {step.minutes} min
                    </span>
                  </li>
                ))}
              </ol>

              <h3 className="mt-10 flex items-center gap-2 text-lg font-semibold text-white">
                <Users className="h-5 w-5 text-[#D3126A]" aria-hidden="true" />
                Built for
              </h3>
              <ul className="mt-3 grid gap-2 text-de-muted-soft">
                {session.fitFor.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="lg:sticky lg:top-28 lg:self-start">
              {over ? (
                <div className="rounded-2xl border border-de-hairline bg-de-raised p-6">
                  <h3 className="text-xl font-semibold text-white">Missed it?</h3>
                  <p className="mt-2 text-sm text-de-muted-soft">
                    The next step is the same one the session ends on: a focused look at your own environment.
                  </p>
                </div>
              ) : (
                <RegistrationForm session={session} />
              )}
              {campaign ? (
                <div className="mt-4 rounded-2xl border border-de-hairline p-5">
                  <p className="text-sm text-de-muted-soft">Can't wait for the session?</p>
                  <Link
                    href={`/go/${campaign.slug}`}
                    className="mt-1 inline-flex min-h-[44px] items-center gap-2 font-semibold text-white hover:underline"
                  >
                    {campaign.offerName}
                    <ArrowRight className="h-4 w-4 text-[#D3126A]" aria-hidden="true" />
                  </Link>
                  <Button
                    type="button"
                    className="mt-3 w-full bg-[#D3126A] text-white hover:bg-[#b50f5a]"
                    onClick={() => openBooking(`event-${session.slug}`)}
                  >
                    {CTA.primary}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>
      <DigeratiEnhancedFooterSection />
    </div>
  );
}
