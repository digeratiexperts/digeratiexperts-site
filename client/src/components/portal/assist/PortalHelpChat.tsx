import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ArrowUp, CheckCircle2, Loader2, Sparkles, X } from "lucide-react";
import { AskDeGlyph } from "@/components/icons/AskDeGlyph";
import { usePortalSession } from "@/components/portal/shell/portalSession";
import { portalFetch, portalPost } from "@/lib/portalApi";
import { srApi } from "@/lib/serviceRequestsApi";
import { cn } from "@/lib/utils";
import {
  BASKET_STATUS,
  STATUS_LABELS,
  TYPE_LABELS,
  type RequiredChip,
  type ServiceRequestRecord,
  type ServiceRequestType,
} from "@shared/serviceRequests";
import "./portal-help-chat.css";

/**
 * Ask DE in the Client Portal: a launcher bottom-right with a "Need help?"
 * bubble, opening a DE Desk-style panel (graphite shell, magenta actions,
 * restrained violet). Full-screen sheet under 640px. It talks to
 * /api/portal/assist (the advisor service in portal mode) and can offer to
 * fill fields, show the person's own requests, or send the thread to the DE
 * team. Every action waits for a click, and nothing here can press Order Now.
 */

type Page =
  | { kind: "service_request_form"; requestType: ServiceRequestType; title: string }
  | { kind: "service_request_detail"; title: string; requestNumber?: string }
  | { kind: "other"; title: string; pathname?: string };

type FormBridge = {
  values: Record<string, unknown>;
  chips: RequiredChip[];
  /** Applies whitelisted values with a highlight; returns the keys applied. Never submits. */
  fill: (fields: Record<string, unknown>) => string[];
  companyName: string;
};

type Action =
  | { type: "fill_form_fields"; label: string; fields: Record<string, string> }
  | { type: "get_request_status"; label: string; number?: string }
  | { type: "escalate_to_team"; label: string; summary: string };

type Msg = {
  id: string;
  role: "user" | "assistant" | "agent" | "system";
  content: string;
  senderName?: string | null;
  actions?: Action[];
  done?: Record<number, string>;
  requests?: ServiceRequestRecord[];
};

const DISMISS_KEY = "de-portal-help-bubble-dismissed";

const FIELD_LABELS: Record<string, string> = {
  contactPhone: "Contact phone",
  deviceKind: "Laptop or desktop",
  neededFrom: "Needed from",
  loanUntil: "Loan until",
  accessories: "Accessories",
  reason: "Reason",
  additionalNotes: "Additional notes",
  returnReason: "Reason for return",
  preferredReturnDate: "Preferred return date",
  additionalComments: "Additional comments",
  "manualAsset.assetTag": "Asset tag",
  "manualAsset.serialNumber": "Serial number",
  "manualAsset.description": "Computer description",
  activity: "Activity",
  mobileNumber: "Mobile number",
  carrier: "Carrier",
  deviceIdentifier: "Device / IMEI / EID / asset tag",
  effectiveDate: "Effective date",
  details: "What you need",
};

function readDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useTypewriter(text: string, active: boolean): string {
  const [shown, setShown] = useState(active && !prefersReducedMotion() ? "" : text);
  useEffect(() => {
    if (!active || prefersReducedMotion()) {
      setShown(text);
      return;
    }
    setShown("");
    let i = 0;
    const t = window.setInterval(() => {
      i += 2;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(t);
    }, 18);
    return () => window.clearInterval(t);
  }, [text, active]);
  return shown;
}

let idSeq = 0;
const nid = () => `m${Date.now().toString(36)}${(idSeq++).toString(36)}`;

export function PortalHelpChat({ page, form }: { page: Page; form?: FormBridge }) {
  const { user } = usePortalSession();
  const [open, setOpen] = useState(false);
  const [bubble, setBubble] = useState(() => !readDismissed());
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [agentLive, setAgentLive] = useState(false);
  const [greeted, setGreeted] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const lastSeen = useRef<string | null>(null);
  const seenIds = useRef(new Set<string>());

  const first = (user?.fullName || "").split(" ")[0];
  const greeting =
    page.kind === "service_request_form"
      ? `Hi${first ? ` ${first}` : ""}! I can help you fill out ${page.title}, check on a request, or get you to the team.`
      : `Hi${first ? ` ${first}` : ""}! Ask me about your requests, or I can get you to the team.`;
  const typed = useTypewriter(greeting, open && !greeted);

  const prompts =
    page.kind === "service_request_form"
      ? [
          "Help me fill this out",
          page.requestType === "return_computer"
            ? "What's my return status?"
            : page.requestType === "loaner_computer"
              ? "What's my loaner status?"
              : "What's the status of my request?",
          "Talk to the team",
        ]
      : page.kind === "service_request_detail"
        ? ["What happens next?", "Show my requests", "Talk to the team"]
        : ["Show my requests", "Talk to the team"];

  const dismissBubble = () => {
    setBubble(false);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* not persisted in a private window */
    }
  };

  const close = useCallback(() => {
    setOpen(false);
    setGreeted(true);
    requestAnimationFrame(() => launcherRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [messages, typed]);

  // Pull agent replies (DE Desk) while open: every 5s when an agent is live, 20s otherwise.
  const pull = useCallback(async () => {
    try {
      const qs = lastSeen.current ? `?since=${encodeURIComponent(lastSeen.current)}` : "";
      const res = await portalFetch(`/api/portal/assist/messages${qs}`);
      if (!res.ok) return;
      const body = await res.json();
      setAgentLive(Boolean(body.agentLive));
      const fresh: Msg[] = [];
      for (const m of body.messages ?? []) {
        if (m.createdAt) lastSeen.current = m.createdAt;
        if (seenIds.current.has(m.id)) continue;
        seenIds.current.add(m.id);
        if (m.role === "agent") fresh.push({ id: m.id, role: "agent", content: m.content, senderName: m.senderName });
      }
      if (fresh.length) setMessages((prev) => [...prev, ...fresh]);
    } catch {
      /* offline: next tick */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void pull();
    const t = window.setInterval(() => void pull(), agentLive ? 5000 : 20000);
    return () => window.clearInterval(t);
  }, [open, agentLive, pull]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    setInput("");
    setGreeted(true);
    setMessages((prev) => [...prev, { id: nid(), role: "user", content: message }]);
    setSending(true);
    try {
      const body = await portalPost<{ reply: string; actions: Action[]; agentLive: boolean; agentName: string | null }>(
        "/api/portal/assist/chat",
        {
          message,
          page,
          form: form ? { values: form.values, missing: form.chips.map((c) => c.label) } : null,
        },
      );
      setAgentLive(body.agentLive);
      if (body.agentLive) {
        setMessages((prev) => [
          ...prev,
          { id: nid(), role: "system", content: `${body.agentName || "A DE team member"} is with you now. Your message was delivered.` },
        ]);
      } else {
        setMessages((prev) => [...prev, { id: nid(), role: "assistant", content: body.reply, actions: body.actions }]);
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { id: nid(), role: "system", content: e instanceof Error && e.message ? e.message : "Ask DE is unavailable right now. Try again, or open a ticket." },
      ]);
    } finally {
      setSending(false);
    }
  };

  const markDone = (msgId: string, index: number, note: string, extra: Partial<Msg> = {}) =>
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, ...extra, done: { ...(m.done || {}), [index]: note } } : m)));

  const runAction = async (msg: Msg, index: number, action: Action) => {
    if (action.type === "fill_form_fields") {
      if (!form) return;
      const applied = form.fill(action.fields);
      markDone(msg.id, index, applied.length ? `Filled ${applied.length} field${applied.length === 1 ? "" : "s"}. Review them, then click Order Now when you're ready.` : "Nothing to fill.");
    } else if (action.type === "get_request_status") {
      try {
        const { requests } = await srApi.list();
        const mine = requests.filter((r) => r.status !== BASKET_STATUS && (!action.number || r.number === action.number));
        markDone(msg.id, index, mine.length ? "" : "No requests on file yet.", { requests: mine.slice(0, 5) });
      } catch {
        markDone(msg.id, index, "Your requests couldn't be loaded.");
      }
    } else if (action.type === "escalate_to_team") {
      try {
        const transcript = messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .slice(-8)
          .map((m) => `${m.role === "user" ? "Client" : "Ask DE"}: ${m.content}`)
          .join("\n");
        const res = await portalPost<{ ticket?: { ticketNumber?: string } }>("/api/portal/tickets", {
          subject: `Portal help: ${action.summary}`.slice(0, 200),
          description: `${action.summary}\n\nPage: ${page.title}\n\nRecent chat:\n${transcript}`,
          priority: "medium",
          category: "general",
        });
        markDone(msg.id, index, `Sent to the DE team${res.ticket?.ticketNumber ? ` as ticket ${res.ticket.ticketNumber}` : ""}. They'll reply by email and in Support Tickets.`);
      } catch (e) {
        markDone(msg.id, index, e instanceof Error ? `Couldn't send: ${e.message}` : "Couldn't send. Try Support Tickets.");
      }
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const onForm = page.kind === "service_request_form";

  return (
    <>
      {!open && (
        <div className={cn("fixed right-4 z-40 flex items-end gap-2 sm:right-6", onForm ? "bottom-[6.5rem] lg:bottom-6" : "bottom-6")}>
          {bubble && (
            <div className="phc-bubble relative mb-2 hidden rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground shadow-lg sm:block">
              <button type="button" onClick={() => setOpen(true)} className="text-left leading-snug focus-visible:outline-none">
                Need help?
                <br />
                Chat with me...
              </button>
              <button
                type="button"
                onClick={dismissBubble}
                aria-label="Dismiss help message"
                className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow hover:text-foreground"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          )}
          <button
            ref={launcherRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open Ask DE help chat"
            aria-haspopup="dialog"
            className="phc-launcher inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#0b0915] text-white shadow-[0_8px_24px_rgba(5,3,18,0.35)] ring-2 ring-[#D3126A] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-4 motion-reduce:transition-none motion-reduce:hover:scale-100"
          >
            <AskDeGlyph className="h-8 w-8" />
          </button>
        </div>
      )}

      {open && (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby="phc-title"
          className="phc-panel fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#0b0915] text-[#f5f3f7] sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(600px,calc(100dvh-3rem))] sm:w-[380px] sm:rounded-2xl sm:border sm:border-white/10 sm:shadow-[0_24px_64px_rgba(5,3,18,0.55)]"
        >
          <header className="phc-head relative flex items-center gap-3 border-b border-white/10 px-4 py-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/5 ring-1 ring-[#D3126A]/70">
              <AskDeGlyph className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="phc-title" className="text-sm font-semibold">
                Ask DE
              </h2>
              <p className="text-xs text-white/60">{agentLive ? "A DE team member is in this chat" : "DE Desk · help with this page"}</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close Ask DE"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          <div ref={logRef} role="log" aria-live="polite" aria-relevant="additions" className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            <div className="phc-msg max-w-[88%] rounded-2xl rounded-tl-sm bg-white/[0.06] px-3.5 py-2.5 text-sm leading-relaxed">
              {greeted ? greeting : typed}
              {!greeted && typed.length < greeting.length && <span className="phc-caret" aria-hidden="true" />}
            </div>

            {messages.map((m) => (
              <div key={m.id} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
                {m.role === "system" ? (
                  <p className="w-full text-center text-xs text-white/60">{m.content}</p>
                ) : (
                  <div
                    className={cn(
                      "phc-msg max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      m.role === "user" ? "rounded-tr-sm bg-[#D3126A] text-white" : "rounded-tl-sm bg-white/[0.06]",
                    )}
                  >
                    {m.role === "agent" && <p className="mb-0.5 text-xs font-semibold text-[#f45ea3]">{m.senderName || "DE team"}</p>}
                    {m.content}
                  </div>
                )}
                {m.actions?.map((a, i) =>
                  m.done?.[i] !== undefined ? (
                    <div key={i} className="mt-2 max-w-[88%] space-y-2">
                      {m.done[i] && (
                        <p className="flex items-start gap-1.5 text-xs text-white/75">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
                          {m.done[i]}
                        </p>
                      )}
                      {a.type === "get_request_status" &&
                        m.requests?.map((r) => (
                          <Link
                            key={r.id}
                            href={`/portal/requests/${r.id}`}
                            className="block rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm hover:border-[#D3126A]/60"
                          >
                            <span className="font-semibold">{r.number}</span> · {TYPE_LABELS[r.type]}
                            <span className="block text-xs text-white/65">
                              {STATUS_LABELS[r.status]} · for {r.requestedFor.name}
                            </span>
                          </Link>
                        ))}
                    </div>
                  ) : (
                    <div key={i} className="mt-2 max-w-[88%] rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                      {a.type === "fill_form_fields" && (
                        <dl className="mb-2 space-y-0.5 text-xs">
                          {Object.entries(a.fields).map(([k, v]) => (
                            <div key={k} className="flex gap-1.5">
                              <dt className="shrink-0 text-white/55">{FIELD_LABELS[k] ?? k}:</dt>
                              <dd className="min-w-0 break-words">{v}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                      <button
                        type="button"
                        onClick={() => void runAction(m, i, a)}
                        disabled={a.type === "fill_form_fields" && !form}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-[#D3126A] px-3.5 text-xs font-semibold text-white hover:bg-[#b80f5c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-50"
                      >
                        {a.type === "fill_form_fields" && <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
                        {a.label}
                      </button>
                    </div>
                  ),
                )}
              </div>
            ))}

            {sending && (
              <div className="flex items-center gap-2 text-xs text-white/60" aria-label="Ask DE is typing">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Thinking…
              </div>
            )}
          </div>

          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 px-4 pb-3" aria-label="Suggested questions">
              {prompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => void send(p)}
                  className="phc-prompt rounded-full border border-[#D3126A]/50 px-3 py-1.5 text-xs font-medium text-white/90 hover:border-[#D3126A] hover:bg-[#D3126A]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-white/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <label htmlFor="phc-input" className="sr-only">
              Message Ask DE
            </label>
            <textarea
              id="phc-input"
              ref={inputRef}
              rows={1}
              value={input}
              maxLength={2000}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Ask about this request…"
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              aria-label="Send"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D3126A] text-white hover:bg-[#b80f5c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-40"
            >
              <ArrowUp className="h-5 w-5" aria-hidden="true" />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
