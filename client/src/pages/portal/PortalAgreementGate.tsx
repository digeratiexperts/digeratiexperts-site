import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle, CheckCircle2, Clock, ExternalLink, FileText, LogOut, PlayCircle, Sparkles } from "lucide-react";
import type { AgreementGateItem, AgreementGateStatus, WelcomeVideo } from "@shared/portalAgreements";
import { COMPANY, PRIMARY_PHONE } from "@shared/companyContact";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Callout, Field, Token } from "@/components/portal/ui";
import { usePortalTheme } from "@/components/portal/shell/portalTheme";
import { signOutOfPortal, usePortalSession } from "@/components/portal/shell/portalSession";
import { AGREEMENT_GATE_KEY, useAgreementGate, type AgreementGateResponse } from "@/lib/portalAgreementGate";
import { portalPost } from "@/lib/portalApi";
import { DE_LOGO_PRIMARY, DE_LOGO_REVERSE } from "@/lib/brandAssets";
import { useSEO } from "@/hooks/useSEO";
import { cn } from "@/lib/utils";
import "@/styles/portal.css";

/**
 * Onboarding mode: the welcome video, then each agreement this person still
 * has to sign ("Action Required · Agreement N of M"), then one Sign step.
 * No portal navigation here; the rest of the portal sends people back to this
 * page while the gate is enforced (PortalLayout + PORTAL_AGREEMENT_GATE).
 */
export default function PortalAgreementGate() {
  const { ready, user } = usePortalSession();
  const [theme] = usePortalTheme();
  useSEO({ title: "Welcome | Client Portal", description: "Review and sign your Client Portal agreements.", noIndex: true });
  useEffect(() => {
    document.body.classList.add("de-portal-scope");
    document.body.dataset.portalTheme = theme;
    return () => {
      document.body.classList.remove("de-portal-scope");
      delete document.body.dataset.portalTheme;
    };
  }, [theme]);

  const { data, isLoading, error, refetch } = useAgreementGate(ready && !!user);

  return (
    <div className={cn("de-portal min-h-dvh bg-background text-foreground", theme === "dark" && "dark")} data-theme={theme}>
      <header className="sticky top-0 z-20 border-b border-border bg-[hsl(var(--pt-topbar))] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <img src={theme === "dark" ? DE_LOGO_REVERSE : DE_LOGO_PRIMARY} alt="Digerati Experts" className="h-7 w-auto" />
          <span className="hidden text-sm text-muted-foreground sm:inline">Client Portal</span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void signOutOfPortal()} data-testid="gate-sign-out">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 md:pt-10">
        {!ready || isLoading ? (
          <div className="space-y-4" aria-busy="true" aria-live="polite">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="aspect-video w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : error || !data ? (
          <Callout
            tone="bad"
            title="We could not load your agreements"
            action={
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            }
          >
            {error instanceof Error && error.message.includes("not linked")
              ? "Your account is not linked to a company yet. Contact support and we will set it up."
              : "Please try again in a moment."}
          </Callout>
        ) : (
          <Gate data={data} firstName={(user?.fullName || "").split(" ")[0]} />
        )}

        <p className="mt-10 border-t border-border pt-5 text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">Need help?</strong> If you have questions, contact the{" "}
          <a className="pt-link underline-offset-2 hover:underline" href={`mailto:${COMPANY.supportEmail}`}>
            Support Team
          </a>{" "}
          at <a className="pt-link pt-num underline-offset-2 hover:underline" href={PRIMARY_PHONE.telHref}>{PRIMARY_PHONE.display}</a> or your account representative.
        </p>
      </main>
    </div>
  );
}

function Gate({ data, firstName }: { data: AgreementGateResponse; firstName: string }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AgreementGateStatus>(data.status);
  useEffect(() => setStatus(data.status), [data.status]);

  const company = data.company?.name || "your company";
  const pending = status.items.filter((i) => i.state !== "signed");
  const signable = pending.filter((i) => i.canSign);
  const signed = status.items.filter((i) => i.state === "signed");
  const waiting = pending.filter((i) => i.state === "awaiting_company");

  const [justSigned, setJustSigned] = useState(false);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] pt-link">Onboarding</p>
        <h1 className="mt-1 font-heading text-2xl font-semibold leading-tight md:text-3xl">
          {firstName ? `Welcome, ${firstName}.` : "Welcome to your Client Portal."}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {status.complete
            ? `You are all set${data.company ? ` at ${company}` : ""}. Watch the welcome, then take a quick tour of the portal.`
            : "Before you start, watch a short welcome and review the agreements below. It takes about five minutes."}
        </p>
      </div>

      {data.exempt && (
        <Callout tone="info" title="Preview">
          DE staff do not sign client agreements. This is what {data.company ? company : "a client"} sees
          {data.mode === "enforce" ? "." : ". The gate is not enforced yet (PORTAL_AGREEMENT_GATE is not set to enforce)."}
        </Callout>
      )}

      <WelcomeVideos videos={data.videos} preferCompany={status.isCompanySigner} />

      {justSigned && status.complete ? (
        <AllSet onTour={() => setLocation("/portal/dashboard?tour=1")} onSkip={() => setLocation("/portal/dashboard")} />
      ) : (
        <>
          {pending.length > 0 && (
            <section aria-labelledby="gate-actions" className="space-y-4">
              <h2 id="gate-actions" className="sr-only">
                Agreements to review
              </h2>
              {pending.map((item, i) => (
                <AgreementCard key={item.key} item={item} index={i + 1} total={pending.length} company={company} />
              ))}
            </section>
          )}

          {signable.length > 0 && !data.exempt && (
            <SignForm
              items={signable}
              defaultName={data.signer.name}
              company={company}
              isCompanySigner={status.isCompanySigner}
              onSigned={(next) => {
                setStatus(next);
                setJustSigned(true);
                queryClient.setQueryData<AgreementGateResponse>(AGREEMENT_GATE_KEY, (old) => (old ? { ...old, status: next } : old));
              }}
            />
          )}

          {signable.length === 0 && waiting.length > 0 && (
            <Callout tone="warn" title={`Waiting on ${company}`}>
              You have signed everything that is yours to sign. The portal opens as soon as an org admin or your company IT contact signs the company
              agreement. We have nothing more to ask of you for now.
            </Callout>
          )}

          {status.complete && !justSigned && (
            <AllSet onTour={() => setLocation("/portal/dashboard?tour=1")} onSkip={() => setLocation("/portal/dashboard")} />
          )}
        </>
      )}

      {signed.length > 0 && (
        <section aria-labelledby="gate-signed" className="rounded-xl border border-border bg-card">
          <h2 id="gate-signed" className="border-b border-border px-4 py-3 text-sm font-semibold md:px-5">
            Signed
          </h2>
          <ul className="divide-y divide-border">
            {signed.map((s) => (
              <li key={s.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm md:px-5">
                <CheckCircle2 className="h-4 w-4 shrink-0 pt-ink pt-tone-ok" aria-hidden="true" />
                <a href={s.pdf} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 font-medium hover:underline">
                  {s.title}
                </a>
                <span className="text-xs text-muted-foreground">
                  {s.scope === "company" ? "For the company" : "Personal"} · v{s.version}
                  {s.signature && (
                    <>
                      {" "}· {s.signature.signerName}, <span className="pt-num">{new Date(s.signature.signedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}</span>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function WelcomeVideos({ videos, preferCompany }: { videos: AgreementGateResponse["videos"]; preferCompany: boolean }) {
  const [tab, setTab] = useState<"company" | "user">(preferCompany ? "company" : "user");
  const tabsId = useId();
  const current: WelcomeVideo = videos[tab];
  const options: { key: "company" | "user"; label: string }[] = [
    { key: "company", label: "For your company" },
    { key: "user", label: "For you" },
  ];
  return (
    <section aria-labelledby={`${tabsId}-h`} className="overflow-hidden rounded-xl border border-border bg-card" data-testid="gate-welcome-video">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-5">
        <h2 id={`${tabsId}-h`} className="font-heading text-[15px] font-semibold">
          A welcome from Joe
        </h2>
        <div role="tablist" aria-label="Welcome video" className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              role="tab"
              id={`${tabsId}-${o.key}`}
              aria-selected={tab === o.key}
              aria-controls={`${tabsId}-panel`}
              onClick={() => setTab(o.key)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tab === o.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${tab}`}>
        <div className="relative aspect-video w-full bg-[hsl(var(--background))]">
          {current.url && current.kind === "embed" ? (
            <iframe
              key={current.url}
              src={current.url}
              title={current.title}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              loading="lazy"
            />
          ) : current.url && current.kind === "file" ? (
            <video key={current.url} src={current.url} controls preload="metadata" className="absolute inset-0 h-full w-full" aria-label={current.title} />
          ) : (
            <div className="pt-login-glow absolute inset-0 grid place-items-center p-6 text-center">
              <div>
                <PlayCircle className="mx-auto h-12 w-12 pt-link opacity-80" aria-hidden="true" />
                <p className="mt-3 font-heading text-lg font-semibold">{current.title}</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                  Joe's welcome video {tab === "company" ? "for your company" : "for you"} is on its way. Until then, everything you need is in the agreements below.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

const STATE_COPY = (item: AgreementGateItem, company: string) => {
  switch (item.state) {
    case "updated":
      return `Our ${item.title} has been updated. To continue using the portal, you must review and sign the agreement below.`;
    case "awaiting_company":
      return `An org admin or your company IT contact signs this once for everyone at ${company}. You do not need to do anything; you can still read it.`;
    default:
      return item.scope === "company"
        ? `Review and sign the ${item.title} for ${company}. You sign once, on behalf of everyone at ${company}.`
        : `Review and sign the ${item.title}. To continue using the portal, you must review and sign the agreement below.`;
  }
};

function AgreementCard({ item, index, total, company }: { item: AgreementGateItem; index: number; total: number; company: string }) {
  const reduce = useReducedMotion();
  const waiting = item.state === "awaiting_company";
  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: reduce ? 0 : index * 0.05 }}
      className={cn("rounded-xl border bg-card p-4 md:p-5", waiting ? "border-border" : "pt-hover-brand border-[rgb(var(--pt-brand)/0.35)]")}
      aria-labelledby={`agreement-${item.key}`}
      data-testid={`gate-agreement-${item.key}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {waiting ? (
          <Token label="Waiting on your company" tone="neutral" />
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold pt-link">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            Action Required
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          Agreement <span className="pt-num">{index}</span> of <span className="pt-num">{total}</span>
        </span>
        <Token label={item.scope === "company" ? "Company" : "Personal"} tone={item.scope === "company" ? "brand" : "info"} className="ml-auto" />
      </div>
      <h3 id={`agreement-${item.key}`} className="mt-3 font-heading text-lg font-semibold leading-snug">
        {item.title}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{STATE_COPY(item, company)}</p>
      <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
      <a
        href={item.pdf}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium pt-link underline-offset-2 hover:underline"
        data-testid={`gate-pdf-${item.key}`}
      >
        <FileText className="h-4 w-4" aria-hidden="true" />
        View {item.title} (PDF)
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
      <p className="mt-2 text-xs text-muted-foreground">
        Version <span className="pt-num">{item.version}</span> · Last modified{" "}
        <span className="pt-num">{new Date(`${item.lastModified}T12:00:00Z`).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" })}</span>
      </p>
    </motion.article>
  );
}

function SignForm({
  items,
  defaultName,
  company,
  isCompanySigner,
  onSigned,
}: {
  items: AgreementGateItem[];
  defaultName: string;
  company: string;
  isCompanySigner: boolean;
  onSigned: (status: AgreementGateStatus) => void;
}) {
  const [name, setName] = useState("");
  const [accept, setAccept] = useState(false);
  const [touched, setTouched] = useState(false);
  const hasCompany = items.some((i) => i.scope === "company");
  const nameOk = name.trim().length >= 2;

  const sign = useMutation({
    mutationFn: () =>
      portalPost<{ success: boolean; status: AgreementGateStatus }>("/api/portal/agreements/sign", {
        keys: items.map((i) => i.key),
        signerName: name,
        accept,
      }),
    onSuccess: (res) => onSigned(res.status),
  });

  const label = useMemo(
    () =>
      hasCompany && isCompanySigner
        ? `I have read the agreements above and agree to them. For the company agreement, I confirm I am authorized to sign on behalf of ${company}.`
        : "I have read the agreements above and agree to them.",
    [hasCompany, isCompanySigner, company],
  );

  return (
    <form
      className="rounded-xl border border-border bg-card p-4 md:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (nameOk && accept) sign.mutate();
      }}
      aria-labelledby="gate-sign-h"
      data-testid="gate-sign-form"
    >
      <h2 id="gate-sign-h" className="font-heading text-[15px] font-semibold">
        Sign {items.length === 1 ? "the agreement" : `${items.length} agreements`}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Typing your name below is your electronic signature. We record your name, the time and the exact version you signed, and you can download a copy any time.
      </p>
      <div className="mt-4 grid gap-4">
        <Field
          label="Type your full name"
          htmlFor="gate-signer-name"
          required
          hint={defaultName ? `As it appears on your account: ${defaultName}` : undefined}
          error={touched && !nameOk ? "Type your full name to sign." : undefined}
        >
          <Input
            id="gate-signer-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className="font-heading text-base"
            data-testid="gate-signer-name"
          />
        </Field>
        <div className="flex items-start gap-3">
          <Checkbox id="gate-accept" checked={accept} onCheckedChange={(v) => setAccept(v === true)} className="mt-0.5" data-testid="gate-accept" aria-describedby={touched && !accept ? "gate-accept-err" : undefined} />
          <label htmlFor="gate-accept" className="text-sm leading-relaxed">
            {label}
          </label>
        </div>
        {touched && !accept && (
          <p id="gate-accept-err" className="pt-ink pt-tone-bad text-xs" role="alert">
            Tick the box to confirm you agree.
          </p>
        )}
        {sign.error && (
          <Callout tone="bad" title="Not signed">
            {sign.error instanceof Error ? sign.error.message : "Please try again."}
          </Callout>
        )}
        <div>
          <Button type="submit" size="lg" disabled={sign.isPending} className="w-full sm:w-auto" data-testid="gate-sign">
            {sign.isPending ? "Signing…" : "Sign Agreements"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function AllSet({ onTour, onSkip }: { onTour: () => void; onSkip: () => void }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [reduce]);
  return (
    <motion.section
      ref={ref}
      initial={reduce ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-[rgb(var(--pt-ok)/0.4)] bg-card p-5 text-center md:p-8"
      aria-labelledby="gate-done"
      data-testid="gate-all-set"
      role="status"
    >
      <CheckCircle2 className="mx-auto h-10 w-10 pt-ink pt-tone-ok" aria-hidden="true" />
      <h2 id="gate-done" className="mt-3 font-heading text-xl font-semibold">
        You're all set
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Take a one-minute tour: we'll point out where to get help, track your requests and keep your account secure. You can replay it any time from your account menu.
      </p>
      <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
        <Button size="lg" onClick={onTour} data-testid="gate-start-tour">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Take the portal tour
        </Button>
        <Button size="lg" variant="outline" onClick={onSkip} data-testid="gate-skip-tour">
          <Clock className="h-4 w-4" aria-hidden="true" />
          Skip for now
        </Button>
      </div>
    </motion.section>
  );
}
