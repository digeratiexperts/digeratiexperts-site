import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, Clock3, KeyRound, ShieldCheck } from "lucide-react";
import { portalFetch, portalGet } from "@/lib/portalApi";
import { SecureFieldCard, postSecureField } from "@/components/desk/SecureFieldCard";
import {
  SECURE_FIELD_REVEAL_COPY,
  secureFieldKindLabel,
  secureFieldSummary,
  type SecureFieldMeta,
} from "@/lib/deskSecureField";

/**
 * DE Desk secure fields in the Client Portal (Intelligence-Hub #1179 slice 2).
 *
 * - `PortalTicketSecureFields`: on the existing ticket page. The client side
 *   sees what they have shared (metadata only) and can share another value.
 *   The DE side (portal admin) sees every field on the ticket, can add one,
 *   and is told reveal happens in the Hub: the portal cannot prove which staff
 *   member is asking, so it offers no reveal at all.
 * - `PortalChatSecureShare`: in the existing portal chat composer area. The
 *   client picks one of their open tickets and shares the value there, so it
 *   never enters the chat transcript.
 */

const secureFieldsUrl = (ticketId: string) => `/api/portal/tickets/${encodeURIComponent(ticketId)}/secure-fields`;

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; fields: SecureFieldMeta[] }
  | { kind: "unavailable"; message: string }
  | { kind: "error" };

export function PortalTicketSecureFields({ ticketId, isDeStaff }: { ticketId: string; isDeStaff: boolean }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const load = useCallback(async () => {
    try {
      const res = await portalFetch(secureFieldsUrl(ticketId));
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data?.secureFields)) {
        setState({ kind: "ready", fields: data.secureFields });
      } else if (res.status === 409) {
        setState({ kind: "unavailable", message: typeof data?.error === "string" ? data.error : "Secure sharing isn't available on this ticket yet." });
      } else {
        setState({ kind: "error" });
      }
    } catch {
      setState({ kind: "error" });
    }
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === "loading") return null;

  if (state.kind === "unavailable") {
    return (
      <p className="flex items-start gap-2 text-xs text-muted-foreground" data-testid="secure-fields-unavailable">
        <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{state.message}</span>
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="ticket-secure-fields">
      {state.kind === "error" && (
        <p className="text-xs text-muted-foreground">Secure fields couldn't be loaded just now. You can still share a value below.</p>
      )}
      {state.kind === "ready" && state.fields.length > 0 && (
        <ul className="space-y-2" aria-label="Secure fields on this ticket">
          {state.fields.map((f) => (
            <li key={f.id} className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-xs">
              {f.status === "active" ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
              ) : (
                <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="min-w-0">
                <span className="block font-medium">{secureFieldSummary(f)}</span>
                <span className="block text-muted-foreground">
                  {secureFieldKindLabel(f.kind)} · shared by {f.submittedBy.name}
                  {isDeStaff ? ` · opened ${f.revealCount} time${f.revealCount === 1 ? "" : "s"}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <SecureFieldCard
        tone="portal"
        testId="ticket-secure-field"
        title={isDeStaff ? "Add a secure field (DE side)" : "Share a password securely"}
        intro={
          isDeStaff
            ? "Store a password or key on this ticket for the DE team. It is recorded as shared from the portal's DE side."
            : "Need to give DE a password, Wi-Fi key or licence key for this ticket? Put it here, not in a reply."
        }
        note={
          isDeStaff ? (
            <span className="inline-flex items-start gap-1.5">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <span>
                {SECURE_FIELD_REVEAL_COPY} The portal can't show values: it can't yet prove which DE staff member is asking.
              </span>
            </span>
          ) : (
            "Only DE engineers can open it, and every time they do is logged."
          )
        }
        submit={(payload) => postSecureField(secureFieldsUrl(ticketId), payload)}
        onStored={() => void load()}
      />
    </div>
  );
}

interface TicketOption {
  id: string;
  ticketNumber?: string;
  subject: string;
  status: string;
}

const CLOSED = new Set(["resolved", "closed"]);

export function PortalChatSecureShare({ onClose }: { onClose: () => void }) {
  const [tickets, setTickets] = useState<TicketOption[] | null>(null);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    let alive = true;
    portalGet<{ tickets?: TicketOption[] }>("/api/portal/tickets")
      .then((data) => {
        if (!alive) return;
        const open = (data?.tickets ?? []).filter((t) => !CLOSED.has(String(t.status).toLowerCase()));
        setTickets(open);
        if (open[0]) setSelected(open[0].id);
      })
      .catch(() => alive && setTickets([]));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3" data-testid="chat-secure-share">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">Share a password securely</p>
        <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={onClose}>
          Close
        </button>
      </div>
      {tickets === null ? (
        <p className="text-xs text-muted-foreground">Loading your tickets…</p>
      ) : tickets.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          A secure field goes on a ticket.{" "}
          <Link href="/portal/tickets/create" className="underline">
            Open a ticket
          </Link>{" "}
          first, then share it there. Please don't paste it in the chat.
        </p>
      ) : (
        <>
          <label className="block text-xs">
            <span className="mb-1 block text-muted-foreground">For ticket</span>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              data-testid="chat-secure-share-ticket"
            >
              {tickets.map((t) => (
                <option key={t.id} value={t.id}>
                  {(t.ticketNumber ? `${t.ticketNumber} · ` : "") + t.subject}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <SecureFieldCard
              key={selected}
              tone="portal"
              testId="chat-secure-field"
              intro="It goes to the ticket you picked, encrypted. Nothing is posted in this chat."
              submit={(payload) => postSecureField(secureFieldsUrl(selected), payload)}
            />
          )}
        </>
      )}
    </div>
  );
}
