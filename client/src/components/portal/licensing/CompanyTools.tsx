import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Boxes, CheckCircle2, Cloud, Loader2, Send, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { licenseBoardApi, type KitResult } from "@/lib/licenseBoardApi";

/**
 * The two company-level tools on the License Patch Bay:
 *  - Starter kits: one press sets a company up for its business type.
 *  - JumpCloud: link the company, preview the installs, send on request.
 */

const panel = "rounded-2xl border border-white/10 bg-[#0d0a17] p-4";
const heading = "flex items-center gap-2 font-[Oxanium] text-xs font-semibold uppercase tracking-[0.18em] text-white/80";

export function StarterKitPanel({ clientId, companyName, onApplied }: { clientId: string; companyName: string; onApplied: () => void }) {
  const { toast } = useToast();
  const q = useQuery({ queryKey: ["/api/portal/admin/license-board/kits"], queryFn: licenseBoardApi.kits, staleTime: Infinity });
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [result, setResult] = useState<KitResult | null>(null);

  const apply = async (key: string) => {
    setBusy(key);
    try {
      const r = await licenseBoardApi.applyKit(clientId, key);
      setResult(r);
      setConfirm(null);
      onApplied();
      toast({ title: `${r.kit} applied to ${companyName}`, description: `${r.appsOn} apps turned on, ${r.onEveryMachine} sent to Every machine.` });
    } catch (err) {
      toast({ title: "Could not apply the kit", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={panel} aria-label="Starter kits">
      <h3 className={heading}>
        <Boxes className="h-4 w-4 text-[#C4B5FD]" aria-hidden /> Starter kit
      </h3>
      <p className="mt-1 text-xs text-white/55">
        Sets the company up for its business type: turns on the kit's apps for Every machine and lists the licences to give it.
        Seats are never allocated for you. Applying twice changes nothing.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {(q.data?.kits ?? []).map((kit) => (
          <div key={kit.key} className="flex min-w-0 flex-col justify-between gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{kit.name}</p>
              <p className="mt-0.5 text-xs text-white/55">{kit.blurb}</p>
              <p className="mt-1.5 text-[11px] text-white/45">
                {kit.apps.length} apps · {kit.licenses.length} licences
              </p>
              {kit.note ? (
                <p className="mt-1.5 flex gap-1 text-[11px] text-[#FBBF24]">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /> {kit.note}
                </p>
              ) : null}
            </div>
            {confirm === kit.key ? (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void apply(kit.key)}
                  className="inline-flex min-h-9 flex-1 items-center justify-center gap-1 rounded-md bg-[#D3126A] px-2 text-xs font-semibold text-white hover:bg-[#A30E52] disabled:opacity-50"
                >
                  {busy === kit.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                  Apply to {companyName}
                </button>
                <button type="button" onClick={() => setConfirm(null)} className="min-h-9 rounded-md px-2 text-xs text-white/60 hover:bg-white/10">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirm(kit.key)}
                className="min-h-9 rounded-md border border-[#F04C97]/50 px-2 text-xs font-semibold text-white hover:bg-[#D3126A]/15"
              >
                Use this kit
              </button>
            )}
          </div>
        ))}
      </div>
      {result ? (
        <div className="mt-3 rounded-xl border border-[#34D399]/30 bg-[#34D399]/[0.06] p-3 text-xs text-white/80">
          <p className="font-semibold text-white">{result.kit} applied</p>
          <p className="mt-0.5">
            {result.appsOn} apps turned on · {result.onEveryMachine} on Every machine · {result.addedToPool} new parts in DE's pool
          </p>
          {result.recommended.length ? (
            <p className="mt-1">
              Licences to give: {result.recommended.map((r) => r.product).join(", ")}. Drag them from the company pool, or patch seats
              from DE's pool on the main board.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function JumpCloudPanel({ clientId, refreshKey }: { clientId: string; refreshKey: unknown }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const key = ["/api/portal/admin/license-board/jumpcloud", clientId, refreshKey];
  const q = useQuery({ queryKey: key, queryFn: () => licenseBoardApi.jumpcloud(clientId) });
  const [orgId, setOrgId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const data = q.data;
  const ready = (data?.plan ?? []).filter((s) => s.status === "ready");
  const field = "h-10 w-full rounded-md border border-white/15 bg-black/30 px-3 font-mono text-sm text-white placeholder:font-sans placeholder:text-white/35";

  const save = async () => {
    try {
      await licenseBoardApi.linkJumpCloud(clientId, {
        orgId: (orgId ?? data?.link?.orgId ?? "").trim() || null,
        systemGroupId: (groupId ?? data?.link?.systemGroupId ?? "").trim() || null,
      });
      setOrgId(null);
      setGroupId(null);
      void qc.invalidateQueries({ queryKey: ["/api/portal/admin/license-board/jumpcloud", clientId] });
      toast({ title: "JumpCloud link saved" });
    } catch (err) {
      toast({ title: "Could not save the link", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
    }
  };

  const push = async () => {
    setBusy(true);
    try {
      const r = await licenseBoardApi.pushJumpCloud(clientId);
      setConfirming(false);
      void qc.invalidateQueries({ queryKey: ["/api/portal/admin/license-board/jumpcloud", clientId] });
      toast({
        title: `${r.sent} sent to JumpCloud${r.failed ? `, ${r.failed} not sent` : ""}`,
        description: r.failed ? "See the log for what JumpCloud said." : "Machines install them at their next check-in.",
        variant: r.failed ? "destructive" : undefined,
      });
    } catch (err) {
      toast({ title: "Could not send to JumpCloud", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={panel} aria-label="JumpCloud installs">
      <h3 className={heading}>
        <Cloud className="h-4 w-4 text-[#38BDF8]" aria-hidden /> JumpCloud installs
      </h3>
      {q.isLoading || !data ? (
        <p className="mt-2 text-xs text-white/50">Loading…</p>
      ) : (
        <>
          {!data.configured ? (
            <p className="mt-2 flex gap-1.5 rounded-lg border border-[#FBBF24]/30 bg-[#FBBF24]/[0.06] p-2 text-xs text-[#FDE68A]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              JumpCloud is not connected on this server (JUMPCLOUD_API_KEY). You can link and preview; sending needs the key.
            </p>
          ) : null}
          <p className="mt-2 text-xs text-white/55">
            Fill in the organization id if this client has its own JumpCloud org, the device group id for the group that holds its
            machines, or both. Every machine installs go to that group.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input
              value={orgId ?? data.link?.orgId ?? ""}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="Organization id (optional)"
              aria-label="JumpCloud organization id"
              className={field}
            />
            <input
              value={groupId ?? data.link?.systemGroupId ?? ""}
              onChange={(e) => setGroupId(e.target.value)}
              placeholder="Device group id"
              aria-label="JumpCloud device group id"
              className={field}
            />
            <button
              type="button"
              onClick={() => void save()}
              disabled={orgId === null && groupId === null}
              className="min-h-10 rounded-md border border-white/15 px-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-40"
            >
              Save link
            </button>
          </div>

          <ul className="mt-3 space-y-1.5">
            {data.plan.length === 0 ? (
              <li className="text-xs text-white/45">Nothing to install yet. Patch apps with a Chocolatey id to Every machine or a device.</li>
            ) : (
              data.plan.map((step, i) => (
                <li key={`${step.itemId}:${step.target.label}:${i}`} className="flex items-start gap-2 text-xs">
                  {step.status === "ready" ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#34D399]" aria-hidden />
                  ) : (
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/35" aria-hidden />
                  )}
                  <span className="min-w-0">
                    <span className="text-white">{step.product}</span>
                    {step.chocoPackage ? <span className="ml-1 font-mono text-[#6EE7B7]">{step.chocoPackage}</span> : null}
                    <span className="text-white/55"> → {step.target.label}</span>
                    {step.reason ? <span className="block text-white/45">{step.reason}</span> : null}
                  </span>
                </li>
              ))
            )}
          </ul>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {confirming ? (
              <>
                <span className="text-xs text-white/70">
                  Send {ready.length} install{ready.length === 1 ? "" : "s"} to JumpCloud? Machines install at their next check-in.
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void push()}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-[#0EA5E9] px-3 text-xs font-semibold text-white hover:bg-[#0284C7] disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />}
                  Send now
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="min-h-9 rounded-md px-2 text-xs text-white/60 hover:bg-white/10">
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={!data.configured || ready.length === 0}
                onClick={() => setConfirming(true)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[#38BDF8]/50 px-3 text-xs font-semibold text-white hover:bg-[#38BDF8]/10 disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" aria-hidden /> Send {ready.length} to JumpCloud
              </button>
            )}
          </div>

          {data.pushes.length ? (
            <details className="mt-3 text-xs text-white/60">
              <summary className="cursor-pointer select-none text-white/70">Send log ({data.pushes.length})</summary>
              <ul className="mt-2 space-y-1">
                {data.pushes.map((p) => (
                  <li key={p.id} className={p.ok ? "text-white/70" : "text-[#FDA4AF]"}>
                    {new Date(p.createdAt).toLocaleString()} · {p.product} → {p.targetLabel}: {p.detail}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}
