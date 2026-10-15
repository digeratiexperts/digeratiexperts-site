import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, Send, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { licenseBoardApi, type JumpCloudView, type KitResult } from "@/lib/licenseBoardApi";

/**
 * The company-level tabs of the License Patch Bay, laid out like an admin
 * console (Entra / Azure): rows and tables, labels above fields, status as
 * small chips instead of banners.
 *  - StarterKitTab: one row per business type, applied on confirm.
 *  - JumpCloudTab: the link, the install plan as a table, Send, the send log.
 */

export const jumpcloudKey = (clientId: string) => ["/api/portal/admin/license-board/jumpcloud", clientId];

export function useJumpCloud(clientId: string) {
  return useQuery({ queryKey: jumpcloudKey(clientId), queryFn: () => licenseBoardApi.jumpcloud(clientId) });
}

/** The JumpCloud chip in the company header. */
export function jumpcloudState(view: JumpCloudView | undefined): { label: string; tone: "good" | "warn" | "muted" } {
  if (!view) return { label: "JumpCloud …", tone: "muted" };
  if (!view.configured) return { label: "JumpCloud not connected", tone: "warn" };
  if (!view.link?.systemGroupId && !view.link?.orgId) return { label: "JumpCloud not linked", tone: "muted" };
  return { label: "JumpCloud linked", tone: "good" };
}

const th = "px-3 py-2 text-left text-xs font-semibold text-white/55";
const td = "px-3 py-2.5 align-top text-sm text-white/85";
const fieldLabel = "mb-1 block text-xs font-semibold text-white/70";
const input = "h-10 w-full rounded-md border border-white/15 bg-black/30 px-3 font-mono text-sm text-white placeholder:text-white/35";

export function StarterKitTab({ clientId, companyName, onApplied }: { clientId: string; companyName: string; onApplied: () => void }) {
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
      toast({ title: `${r.kit} applied to ${companyName}`, description: `${r.appsOn} apps on, ${r.onEveryMachine} sent to Every machine.` });
    } catch (err) {
      toast({ title: "Could not apply the kit", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-white/60">
        Pick the business type. The kit turns its apps on for Every machine and lists the licences {companyName} should get. Seat
        counts stay your call: nothing is allocated, and applying a kit again changes nothing.
      </p>
      {result ? (
        <div className="flex gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-white/85">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-white">{result.kit} applied</p>
            <p>
              {result.appsOn} apps on · {result.onEveryMachine} on Every machine · {result.addedToPool} new parts in DE's pool
            </p>
            {result.recommended.length ? <p className="mt-1">Licences to give: {result.recommended.map((r) => r.product).join(", ")}.</p> : null}
          </div>
        </div>
      ) : null}
      <ul className="divide-y divide-white/10 rounded-md border border-white/10">
        {(q.data?.kits ?? []).map((kit) => (
          <li key={kit.key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">{kit.name}</p>
              <p className="mt-0.5 text-sm text-white/60">{kit.blurb}</p>
              <p className="mt-1 text-xs text-white/45">
                {kit.apps.length} apps · {kit.licenses.length} licences
              </p>
              {kit.note ? (
                <p className="mt-2 flex gap-1.5 text-xs text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {kit.note}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {confirm === kit.key ? (
                <>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void apply(kit.key)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-[#D3126A] px-3 text-sm font-semibold text-white hover:bg-[#A30E52] disabled:opacity-50"
                  >
                    {busy === kit.key ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                    Apply to {companyName}
                  </button>
                  <button type="button" onClick={() => setConfirm(null)} className="min-h-9 rounded-md px-3 text-sm text-white/65 hover:bg-white/10">
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirm(kit.key)}
                  className="min-h-9 rounded-md border border-white/15 px-3 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Apply
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepStatus({ step }: { step: JumpCloudView["plan"][number] }) {
  return step.status === "ready" ? (
    <span className="inline-flex items-center gap-1 text-emerald-400">
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Ready
    </span>
  ) : (
    <span className="inline-flex items-start gap-1 text-white/55">
      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {step.reason ?? "Skipped"}
    </span>
  );
}

export function JumpCloudTab({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const q = useJumpCloud(clientId);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const data = q.data;
  const ready = (data?.plan ?? []).filter((s) => s.status === "ready");
  const refresh = () => void qc.invalidateQueries({ queryKey: jumpcloudKey(clientId) });

  const save = async () => {
    try {
      await licenseBoardApi.linkJumpCloud(clientId, {
        orgId: (orgId ?? data?.link?.orgId ?? "").trim() || null,
        systemGroupId: (groupId ?? data?.link?.systemGroupId ?? "").trim() || null,
      });
      setOrgId(null);
      setGroupId(null);
      refresh();
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
      refresh();
      toast({
        title: `${r.sent} sent to JumpCloud${r.failed ? `, ${r.failed} not sent` : ""}`,
        description: r.failed ? "The send log shows what JumpCloud said." : "Machines install them at their next check-in.",
        variant: r.failed ? "destructive" : undefined,
      });
    } catch (err) {
      toast({ title: "Could not send to JumpCloud", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (q.isLoading || !data) return <p className="text-sm text-white/50">Loading…</p>;

  return (
    <div className="space-y-6">
      {!data.configured ? (
        <p className="flex gap-2 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          JumpCloud isn't connected on this server yet (JUMPCLOUD_API_KEY). You can link and preview; Send needs the key.
        </p>
      ) : null}

      <section aria-labelledby="jc-link">
        <h3 id="jc-link" className="text-sm font-semibold text-white">
          Link
        </h3>
        <p className="mt-0.5 text-sm text-white/55">Where this company's machines live in JumpCloud. Every machine installs go to the device group.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block min-w-0">
            <span className={fieldLabel}>Organization ID (optional)</span>
            <input value={orgId ?? data.link?.orgId ?? ""} onChange={(e) => setOrgId(e.target.value)} placeholder="Only if it has its own org" className={input} />
          </label>
          <label className="block min-w-0">
            <span className={fieldLabel}>Device group ID</span>
            <input value={groupId ?? data.link?.systemGroupId ?? ""} onChange={(e) => setGroupId(e.target.value)} placeholder="Group holding its machines" className={input} />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={orgId === null && groupId === null}
          className="mt-3 min-h-9 rounded-md border border-white/15 px-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-40"
        >
          Save link
        </button>
      </section>

      <section aria-labelledby="jc-plan">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="jc-plan" className="text-sm font-semibold text-white">
            Installs <span className="font-normal text-white/50">· {ready.length} ready of {data.plan.length}</span>
          </h3>
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-white/70">Send {ready.length} now?</span>
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
              disabled={!data.configured || ready.length === 0}
              onClick={() => setConfirming(true)}
              title={!data.configured ? "Needs JUMPCLOUD_API_KEY on the server" : ready.length === 0 ? "Nothing ready to send" : undefined}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-white/15 px-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-40"
            >
              <Send className="h-4 w-4" aria-hidden /> Send to JumpCloud
            </button>
          )}
        </div>
        {data.plan.length === 0 ? (
          <p className="mt-2 text-sm text-white/50">Nothing to install yet. Patch apps that have a Chocolatey ID to Every machine or a device.</p>
        ) : (
          <>
            {/* Phones: one row per install. */}
            <ul className="mt-2 divide-y divide-white/10 rounded-md border border-white/10 sm:hidden">
              {data.plan.map((step, i) => (
                <li key={`${step.itemId}:${step.target.label}:${i}`} className="px-3 py-2.5 text-sm">
                  <p className="font-semibold text-white">{step.product}</p>
                  <p className="text-white/60">
                    {step.chocoPackage ? <span className="font-mono">{step.chocoPackage}</span> : "No package"} → {step.target.label}
                  </p>
                  <StepStatus step={step} />
                </li>
              ))}
            </ul>
            <div className="mt-2 hidden overflow-x-auto rounded-md border border-white/10 sm:block">
              <table className="w-full">
                <thead className="border-b border-white/10 bg-white/[0.03]">
                  <tr>
                    <th className={th}>App</th>
                    <th className={th}>Package</th>
                    <th className={th}>Target</th>
                    <th className={th}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {data.plan.map((step, i) => (
                    <tr key={`${step.itemId}:${step.target.label}:${i}`}>
                      <td className={td}>{step.product}</td>
                      <td className={`${td} font-mono text-white/70`}>{step.chocoPackage ?? "—"}</td>
                      <td className={td}>{step.target.label}</td>
                      <td className={td}>
                        <StepStatus step={step} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {data.pushes.length ? (
        <section aria-labelledby="jc-log">
          <h3 id="jc-log" className="text-sm font-semibold text-white">
            Send log
          </h3>
          <ul className="mt-2 divide-y divide-white/10 rounded-md border border-white/10 text-sm">
            {data.pushes.map((p) => (
              <li key={p.id} className={`px-3 py-2 ${p.ok ? "text-white/75" : "text-rose-300"}`}>
                <span className="text-white/45">{new Date(p.createdAt).toLocaleString()}</span> · {p.product} → {p.targetLabel}: {p.detail}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
