import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, Send, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { licenseBoardApi, type VendorPanel } from "@/lib/licenseBoardApi";
import { MICROSOFT_CLOUDS, type MicrosoftCloud, type PushStep, type PushVendor } from "@shared/vendorPush";

/**
 * The company's "Microsoft & Google" tab on the License Patch Bay: link the
 * client's Microsoft tenant and Google admin, see which person-held licences
 * would be assigned in each console, fix a missing SKU code, and send on
 * request. Every send and the vendor's answer is logged.
 */

export const vendorsKey = (clientId: string) => ["/api/portal/admin/license-board/vendors", clientId];

const th = "px-3 py-2 text-left text-xs font-semibold text-white/55";
const td = "px-3 py-2.5 align-top text-sm text-white/85";
const fieldLabel = "mb-1 block text-xs font-semibold text-white/70";
const input = "h-10 w-full rounded-md border border-white/15 bg-black/30 px-3 text-sm text-white placeholder:text-white/35";
const button = "inline-flex min-h-9 items-center gap-1.5 rounded-md border border-white/15 px-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-40";

const COPY: Record<PushVendor, { title: string; notConnected: string; skuHint: string }> = {
  microsoft: {
    title: "Microsoft 365",
    notConnected:
      "Microsoft Graph isn't connected on this server yet (MS_GRAPH_CLIENT_ID / MS_GRAPH_CLIENT_SECRET, or the _GOV_ pair for GCC High). You can link and preview; Send needs the app.",
    skuHint: "Part number, e.g. SPB",
  },
  google: {
    title: "Google Workspace",
    notConnected:
      "Google licensing isn't connected on this server yet (GOOGLE_LICENSING_SERVICE_ACCOUNT). You can link and preview; Send needs the service account.",
    skuHint: "product/sku, e.g. Google-Apps/1010020027",
  },
};

export function VendorPushTab({ clientId }: { clientId: string }) {
  const q = useQuery({ queryKey: vendorsKey(clientId), queryFn: () => licenseBoardApi.vendors(clientId) });
  if (q.isLoading || !q.data) return <p className="text-sm text-white/50">Loading…</p>;
  return (
    <div className="space-y-8">
      <p className="text-sm text-white/60">
        Licences patched to people here can be assigned in the client's own console. Nothing is sent until you press Send, and
        unpatching a seat here does not remove it in the console.
      </p>
      <VendorSection clientId={clientId} vendor="microsoft" panel={q.data.microsoft} />
      <VendorSection clientId={clientId} vendor="google" panel={q.data.google} />
    </div>
  );
}

function VendorSection({ clientId, vendor, panel }: { clientId: string; vendor: PushVendor; panel: VendorPanel }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const copy = COPY[vendor];
  const link = panel.link;
  const [tenant, setTenant] = useState<string | null>(null);
  const [cloud, setCloud] = useState<MicrosoftCloud | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const ready = panel.steps.filter((s) => s.status === "ready");
  const refresh = () => void qc.invalidateQueries({ queryKey: vendorsKey(clientId) });
  const fail = (title: string, err: unknown) =>
    toast({ title, description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });

  const save = async () => {
    try {
      await licenseBoardApi.linkVendor(
        clientId,
        vendor,
        vendor === "microsoft"
          ? {
              tenant: (tenant ?? (link?.vendor === "microsoft" ? link.tenant : "")).trim(),
              cloud: cloud ?? (link?.vendor === "microsoft" ? link.cloud : "commercial"),
            }
          : { adminEmail: (adminEmail ?? (link?.vendor === "google" ? link.adminEmail : "")).trim() },
      );
      setTenant(null);
      setCloud(null);
      setAdminEmail(null);
      refresh();
      toast({ title: `${copy.title} link saved` });
    } catch (err) {
      fail("Could not save the link", err);
    }
  };

  const push = async () => {
    setBusy(true);
    try {
      const r = await licenseBoardApi.pushVendor(clientId, vendor);
      setConfirming(false);
      refresh();
      toast({
        title: `${r.sent} assigned in ${copy.title}${r.failed ? `, ${r.failed} not assigned` : ""}`,
        description: r.failed ? "The send log shows what the console said." : undefined,
        variant: r.failed ? "destructive" : undefined,
      });
    } catch (err) {
      fail(`Could not send to ${copy.title}`, err);
    } finally {
      setBusy(false);
    }
  };

  const dirty = tenant !== null || cloud !== null || adminEmail !== null;

  return (
    <section aria-labelledby={`vendor-${vendor}`} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
        <h3 id={`vendor-${vendor}`} className="text-base font-semibold text-white">
          {copy.title}
        </h3>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs ${
            !panel.configured
              ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
              : link
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-white/15 bg-white/5 text-white/70"
          }`}
        >
          {!panel.configured ? "Not connected on server" : link ? "Linked" : "Not linked"}
        </span>
      </div>
      {!panel.configured ? (
        <p className="flex gap-2 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {copy.notConnected}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {vendor === "microsoft" ? (
          <>
            <label className="block min-w-0">
              <span className={fieldLabel}>Tenant ID or domain</span>
              <input
                value={tenant ?? (link?.vendor === "microsoft" ? link.tenant : "")}
                onChange={(e) => setTenant(e.target.value)}
                placeholder="contoso.onmicrosoft.com"
                className={`${input} font-mono`}
              />
            </label>
            <label className="block min-w-0">
              <span className={fieldLabel}>Cloud</span>
              <select
                value={cloud ?? (link?.vendor === "microsoft" ? link.cloud : "commercial")}
                onChange={(e) => setCloud(e.target.value as MicrosoftCloud)}
                className={input}
              >
                {MICROSOFT_CLOUDS.map((c) => (
                  <option key={c.key} value={c.key} className="bg-[#100c1a]">
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <label className="block min-w-0 sm:col-span-2">
            <span className={fieldLabel}>Client's Google super admin email</span>
            <input
              type="email"
              value={adminEmail ?? (link?.vendor === "google" ? link.adminEmail : "")}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@client.com"
              className={input}
            />
          </label>
        )}
      </div>
      <button type="button" onClick={() => void save()} disabled={!dirty} className={button}>
        Save link
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">
          Licences to assign <span className="font-normal text-white/50">· {ready.length} ready of {panel.steps.length}</span>
        </p>
        {confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-white/70">Assign {ready.length} now?</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void push()}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-[#D3126A] px-3 text-sm font-semibold text-white hover:bg-[#A30E52] disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              Send
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="min-h-9 rounded-md px-3 text-sm text-white/65 hover:bg-white/10">
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!panel.configured || ready.length === 0}
            onClick={() => setConfirming(true)}
            className={button}
          >
            <Send className="h-4 w-4" aria-hidden /> Send to {copy.title}
          </button>
        )}
      </div>
      {panel.parkedInDepartments ? (
        <p className="text-xs text-white/50">
          {panel.parkedInDepartments} {panel.parkedInDepartments === 1 ? "seat is" : "seats are"} still parked in departments. Patch them
          to people to assign them.
        </p>
      ) : null}
      {panel.steps.length === 0 ? (
        <p className="text-sm text-white/50">No {copy.title} licences are patched to people yet.</p>
      ) : (
        <StepList steps={panel.steps} skuHint={copy.skuHint} onChanged={refresh} />
      )}

      {panel.pushes.length ? (
        <details className="text-sm">
          <summary className="cursor-pointer select-none text-white/70">Send log ({panel.pushes.length})</summary>
          <ul className="mt-2 divide-y divide-white/10 rounded-md border border-white/10">
            {panel.pushes.map((p) => (
              <li key={p.id} className={`px-3 py-2 ${p.ok ? "text-white/75" : "text-rose-300"}`}>
                <span className="text-white/45">{new Date(p.createdAt).toLocaleString()}</span> · {p.product} ({p.sku}) → {p.userEmail}:{" "}
                {p.detail}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function StepList({ steps, skuHint, onChanged }: { steps: PushStep[]; skuHint: string; onChanged: () => void }) {
  return (
    <>
      <ul className="divide-y divide-white/10 rounded-md border border-white/10 sm:hidden">
        {steps.map((s, i) => (
          <li key={`${s.itemId}:${s.email}:${i}`} className="space-y-1 px-3 py-2.5 text-sm">
            <p className="font-semibold text-white">{s.product}</p>
            <p className="break-all text-white/60">
              {s.person} · {s.email || "no email"}
            </p>
            <Status step={s} skuHint={skuHint} onChanged={onChanged} />
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-md border border-white/10 sm:block">
        <table className="w-full">
          <thead className="border-b border-white/10 bg-white/[0.03]">
            <tr>
              <th className={th}>Licence</th>
              <th className={th}>SKU</th>
              <th className={th}>Person</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {steps.map((s, i) => (
              <tr key={`${s.itemId}:${s.email}:${i}`}>
                <td className={td}>{s.product}</td>
                <td className={`${td} font-mono text-white/70`}>{s.sku ?? "—"}</td>
                <td className={td}>
                  {s.person}
                  <span className="block text-xs text-white/50">{s.email || "no email"}</span>
                </td>
                <td className={td}>
                  <Status step={s} skuHint={skuHint} onChanged={onChanged} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Ready / skipped with its reason; a missing or bad SKU can be fixed right here (it applies to the licence everywhere). */
function Status({ step, skuHint, onChanged }: { step: PushStep; skuHint: string; onChanged: () => void }) {
  const { toast } = useToast();
  const [sku, setSku] = useState(step.sku ?? "");
  const skuProblem = step.status === "skip" && /SKU|product\/SKU/.test(step.reason ?? "");
  if (step.status === "ready") {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Ready
      </span>
    );
  }
  return (
    <div className="space-y-1.5">
      <span className="inline-flex items-start gap-1 text-white/55">
        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {step.reason}
      </span>
      {skuProblem ? (
        <form
          className="flex flex-wrap gap-1.5"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await licenseBoardApi.setSku(step.itemId, sku.trim());
              onChanged();
            } catch (err) {
              toast({ title: "Could not save the SKU", description: err instanceof Error ? err.message : "", variant: "destructive" });
            }
          }}
        >
          <input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder={skuHint}
            aria-label={`SKU for ${step.product}`}
            className="h-8 min-w-0 flex-1 rounded border border-white/15 bg-black/30 px-2 font-mono text-xs text-white placeholder:text-white/35"
          />
          <button type="submit" disabled={!sku.trim()} className="min-h-8 rounded border border-white/15 px-2 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-40">
            Save SKU
          </button>
        </form>
      ) : null}
    </div>
  );
}
