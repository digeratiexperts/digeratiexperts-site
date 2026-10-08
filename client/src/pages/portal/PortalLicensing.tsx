import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Cable, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { PortalLayout } from "./PortalLayout";
import { Callout, Panel } from "@/components/portal/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { DocTable } from "@/components/portal/kb/DocTable";
import { AssignmentToken, PolicyTables } from "@/components/portal/licensing/LicensePolicyTables";
import { licensingApi, type LicensingPerson } from "@/lib/licensingApi";
import { cn } from "@/lib/utils";
import { usePortalSession } from "@/components/portal/shell/portalSession";
import {
  ACCOUNT_TYPES,
  ASSIGNMENTS,
  ASSIGNMENT_LABELS,
  LICENSE_CATALOG,
  LICENSE_PLATFORMS,
  accountTypeLabel,
  platformLabel,
  type AccountType,
  type AddonRule,
  type BaseRule,
  type LicensePlatform,
  type LicensePolicy,
} from "@shared/licensing";

/**
 * Licences & account types: what licence each account type gets, how, and
 * through which group; the reader's own licences; account types per person
 * for the company IT contact; and the policy editor for DE admins.
 */

const selectClass =
  "min-h-[36px] rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const inputClass = selectClass + " w-full";

function PersonRow({ person, tiers, onSaved }: { person: LicensingPerson; tiers: string[]; onSaved: () => void }) {
  const [accountType, setAccountType] = useState<AccountType>(person.accountType);
  const [tier, setTier] = useState(person.tier ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | string>("idle");
  const dirty = accountType !== person.accountType || (tier || null) !== person.tier;
  const save = async () => {
    setState("saving");
    try {
      await licensingApi.setPerson(person.userId, accountType, tier || null);
      setState("saved");
      onSaved();
    } catch (e) {
      setState(e instanceof Error ? e.message : "Couldn't save");
    }
  };
  return (
    <tr className="border-t border-border align-top">
      <td className="px-3 py-2">
        <div className="font-medium">{person.name}</div>
        <div className="text-xs text-muted-foreground">{person.email}</div>
        {!person.assigned && <div className="text-xs text-muted-foreground">Not set (treated as standard)</div>}
      </td>
      <td className="px-3 py-2">
        <label className="sr-only" htmlFor={`at-${person.userId}`}>
          Account type for {person.name}
        </label>
        <select id={`at-${person.userId}`} className={selectClass} value={accountType} onChange={(e) => setAccountType(e.target.value as AccountType)}>
          {ACCOUNT_TYPES.map((a) => (
            <option key={a.key} value={a.key}>
              {a.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <label className="sr-only" htmlFor={`tier-${person.userId}`}>
          Tier for {person.name}
        </label>
        <select id={`tier-${person.userId}`} className={selectClass} value={tier} onChange={(e) => setTier(e.target.value)} disabled={!tiers.length}>
          <option value="">{tiers.length ? "No tier" : "No tiers defined"}</option>
          {tiers.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 text-sm">
        {person.base.map((b) => (
          <div key={b.platform}>
            {b.license ?? "None"} <span className="text-xs text-muted-foreground">({ASSIGNMENT_LABELS[b.assignment as keyof typeof ASSIGNMENT_LABELS] ?? b.assignment})</span>
          </div>
        ))}
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          disabled={!dirty || state === "saving"}
          onClick={() => void save()}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-40"
        >
          {state === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Save
        </button>
        {state !== "idle" && state !== "saving" && (
          <p className={cn("mt-1 text-xs", state === "saved" ? "text-muted-foreground" : "text-destructive")} role="status">
            {state === "saved" ? "Saved" : state}
          </p>
        )}
      </td>
    </tr>
  );
}

function PolicyEditor({ clientId, initial, onSaved }: { clientId: string; initial: LicensePolicy; onSaved: () => void }) {
  const [p, setP] = useState<LicensePolicy>(initial);
  const [tiersText, setTiersText] = useState(initial.tiers.join(", "));
  const [state, setState] = useState<{ saving: boolean; ok?: boolean; problems?: string[]; error?: string }>({ saving: false });
  useEffect(() => {
    setP(initial);
    setTiersText(initial.tiers.join(", "));
  }, [initial]);

  const declared = p.platforms.map((x) => x.platform);
  const firstPlatform = (declared[0] ?? "microsoft_commercial") as LicensePlatform;
  const licensesFor = (platform: string, kind?: "base" | "addon") =>
    LICENSE_CATALOG.filter((l) => l.platform === platform && (!kind || l.kind === kind));

  const setBase = (i: number, patch: Partial<BaseRule>) => setP((x) => ({ ...x, baseRules: x.baseRules.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const setAddon = (i: number, patch: Partial<AddonRule>) => setP((x) => ({ ...x, addons: x.addons.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));

  const save = async () => {
    setState({ saving: true });
    const policy = { ...p, tiers: tiersText.split(",").map((t) => t.trim()).filter(Boolean) };
    try {
      await licensingApi.savePolicy(clientId, policy);
      setState({ saving: false, ok: true });
      onSaved();
    } catch (e: any) {
      setState({ saving: false, error: e?.message, problems: e?.problems });
    }
  };

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Platforms this company runs</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {LICENSE_PLATFORMS.map((pl) => {
            const on = declared.includes(pl.key);
            const entry = p.platforms.find((x) => x.platform === pl.key);
            return (
              <div key={pl.key} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) =>
                      setP((x) => ({
                        ...x,
                        platforms: e.target.checked ? [...x.platforms, { platform: pl.key, tenantLabel: "" }] : x.platforms.filter((y) => y.platform !== pl.key),
                      }))
                    }
                  />
                  {pl.label}
                </label>
                {on && (
                  <input
                    aria-label={`${pl.label} tenant label`}
                    placeholder="Tenant label (e.g. Commercial)"
                    className={cn(selectClass, "min-w-0 flex-1")}
                    value={entry?.tenantLabel ?? ""}
                    onChange={(e) => setP((x) => ({ ...x, platforms: x.platforms.map((y) => (y.platform === pl.key ? { ...y, tenantLabel: e.target.value } : y)) }))}
                  />
                )}
              </div>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor="pol-tiers" className="mb-1 block text-sm font-semibold">
          Tiers (comma separated, optional)
        </label>
        <input id="pol-tiers" className={inputClass} placeholder="e.g. Band 2 and below, Band 3 and above" value={tiersText} onChange={(e) => setTiersText(e.target.value)} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold">Base licence rules</h4>
          <button
            type="button"
            disabled={!declared.length}
            onClick={() =>
              setP((x) => ({
                ...x,
                baseRules: [...x.baseRules, { platform: firstPlatform, accountType: "standard", tier: null, licenseKey: licensesFor(firstPlatform, "base")[0]?.key ?? "", assignment: "automatic", group: "" }],
              }))
            }
            className="inline-flex items-center gap-1 text-sm font-medium text-[hsl(var(--primary))] disabled:opacity-40"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Add rule
          </button>
        </div>
        <div className="space-y-2">
          {p.baseRules.map((r, i) => (
            <div key={i} className="grid gap-2 rounded-md border border-border p-2 md:grid-cols-[repeat(5,minmax(0,1fr))_minmax(0,1.4fr)_auto]">
              <select aria-label="Platform" className={selectClass} value={r.platform} onChange={(e) => setBase(i, { platform: e.target.value as LicensePlatform, licenseKey: licensesFor(e.target.value, "base")[0]?.key ?? "" })}>
                {declared.map((d) => (
                  <option key={d} value={d}>
                    {platformLabel(d)}
                  </option>
                ))}
              </select>
              <select aria-label="Account type" className={selectClass} value={r.accountType} onChange={(e) => setBase(i, { accountType: e.target.value as AccountType })}>
                {ACCOUNT_TYPES.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
              </select>
              <select aria-label="Tier" className={selectClass} value={r.tier ?? ""} onChange={(e) => setBase(i, { tier: e.target.value || null })}>
                <option value="">Any tier</option>
                {tiersText
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean)
                  .map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
              </select>
              <select aria-label="Licence" className={selectClass} value={r.licenseKey} onChange={(e) => setBase(i, { licenseKey: e.target.value })}>
                {licensesFor(r.platform, "base").map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.name}
                  </option>
                ))}
              </select>
              <select aria-label="Assignment" className={selectClass} value={r.assignment} onChange={(e) => setBase(i, { assignment: e.target.value as BaseRule["assignment"] })}>
                {ASSIGNMENTS.map((a) => (
                  <option key={a} value={a}>
                    {ASSIGNMENT_LABELS[a]}
                  </option>
                ))}
              </select>
              <input aria-label="Group" placeholder="Directory group name" className={selectClass} value={r.group} onChange={(e) => setBase(i, { group: e.target.value })} />
              <button type="button" aria-label="Remove rule" onClick={() => setP((x) => ({ ...x, baseRules: x.baseRules.filter((_, j) => j !== i) }))} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold">Add-on licences people can request</h4>
          <button
            type="button"
            disabled={!declared.length}
            onClick={() =>
              setP((x) => ({
                ...x,
                addons: [...x.addons, { platform: firstPlatform, licenseKey: licensesFor(firstPlatform, "addon")[0]?.key ?? licensesFor(firstPlatform)[0]?.key ?? "", eligibleAccountTypes: ["standard"], group: "", approval: "manager" }],
              }))
            }
            className="inline-flex items-center gap-1 text-sm font-medium text-[hsl(var(--primary))] disabled:opacity-40"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Add add-on
          </button>
        </div>
        <div className="space-y-2">
          {p.addons.map((r, i) => (
            <div key={i} className="space-y-2 rounded-md border border-border p-2">
              <div className="grid gap-2 md:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.4fr)_auto]">
                <select aria-label="Platform" className={selectClass} value={r.platform} onChange={(e) => setAddon(i, { platform: e.target.value as LicensePlatform, licenseKey: licensesFor(e.target.value)[0]?.key ?? "" })}>
                  {declared.map((d) => (
                    <option key={d} value={d}>
                      {platformLabel(d)}
                    </option>
                  ))}
                </select>
                <select aria-label="Licence" className={selectClass} value={r.licenseKey} onChange={(e) => setAddon(i, { licenseKey: e.target.value })}>
                  {licensesFor(r.platform).map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <select aria-label="Approval" className={selectClass} value={r.approval} onChange={(e) => setAddon(i, { approval: e.target.value as AddonRule["approval"] })}>
                  <option value="manager">Manager approves</option>
                  <option value="it_contact">IT contact approves</option>
                  <option value="none">No approval</option>
                </select>
                <input aria-label="Group" placeholder="Directory group name" className={selectClass} value={r.group} onChange={(e) => setAddon(i, { group: e.target.value })} />
                <button type="button" aria-label="Remove add-on" onClick={() => setP((x) => ({ ...x, addons: x.addons.filter((_, j) => j !== i) }))} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
                <legend className="sr-only">Who can request it</legend>
                {ACCOUNT_TYPES.map((a) => (
                  <label key={a.key} className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={r.eligibleAccountTypes.includes(a.key)}
                      onChange={(e) =>
                        setAddon(i, {
                          eligibleAccountTypes: e.target.checked ? [...r.eligibleAccountTypes, a.key] : r.eligibleAccountTypes.filter((x) => x !== a.key),
                        })
                      }
                    />
                    {a.label}
                  </label>
                ))}
              </fieldset>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="pol-notes" className="mb-1 block text-sm font-semibold">
          Notes shown under the tables
        </label>
        <textarea id="pol-notes" className={cn(inputClass, "min-h-[72px] py-2")} value={p.notes} onChange={(e) => setP((x) => ({ ...x, notes: e.target.value }))} />
      </div>

      {state.error && (
        <Callout tone="bad" title={state.error}>
          {state.problems?.length ? (
            <ul className="list-disc pl-5">
              {state.problems.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : null}
        </Callout>
      )}
      {state.ok && <Callout tone="ok" title="Policy saved" />}
      <button type="button" onClick={() => void save()} disabled={state.saving} className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
        {state.saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Save policy
      </button>
    </div>
  );
}

export default function PortalLicensing() {
  const qc = useQueryClient();
  const overview = useQuery({ queryKey: ["/api/portal/licensing"], queryFn: licensingApi.overview });
  const people = useQuery({ queryKey: ["/api/portal/licensing/people"], queryFn: licensingApi.people, enabled: Boolean(overview.data?.canManagePeople) });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["/api/portal/licensing"] });
    void qc.invalidateQueries({ queryKey: ["/api/portal/licensing/people"] });
  };
  const d = overview.data;
  const isDeAdmin = usePortalSession().user?.role === "admin";

  return (
    <PortalLayout
      title="Licenses & Account Types"
      description="Which licence each kind of account gets, how it is assigned, and how to ask for more."
      width="wide"
      actions={
        <div className="flex flex-wrap gap-2">
          {isDeAdmin ? (
            <Link href="/portal/admin/license-board" className="inline-flex min-h-[40px] items-center gap-2 rounded-md border border-[#D3126A]/50 px-4 text-sm font-semibold hover:bg-[#D3126A]/10">
              <Cable className="h-4 w-4" aria-hidden="true" /> License Patch Bay
            </Link>
          ) : null}
          <Link href="/portal/requests/license" className="inline-flex min-h-[40px] items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            <KeyRound className="h-4 w-4" aria-hidden="true" /> Request a licence
          </Link>
        </div>
      }
    >
      {overview.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : overview.isError || !d ? (
        <Callout tone="bad" title="Licensing couldn't be loaded">
          {overview.error instanceof Error ? overview.error.message : ""}
          {isDeAdmin ? (
            <>
              {" "}To give companies seats from DE's pool, use the{" "}
              <Link href="/portal/admin/license-board" className="font-semibold text-[#F04C97] underline-offset-2 hover:underline">
                License Patch Bay
              </Link>
              .
            </>
          ) : null}
        </Callout>
      ) : (
        <div className="space-y-6">
          <Panel id="my-licences" title="Your licences" description={`Account type: ${accountTypeLabel(d.me.accountType)}${d.me.tier ? ` · ${d.me.tier}` : ""}${d.me.assigned ? "" : " (not set by your IT contact yet)"}`}>
            {d.me.licenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No licences are recorded for your account type yet.</p>
            ) : (
              <DocTable
                caption="Your licences"
                head={["Platform", "Licence", "Type", "How you get it"]}
                rows={d.me.licenses.map((l) => [
                  platformLabel(l.platform),
                  l.name,
                  l.kind === "base" ? "Base" : "Add-on",
                  <AssignmentToken key="a" assignment={l.assignment} />,
                ])}
              />
            )}
          </Panel>

          <Panel id="company-policy" title={`${d.company.name} licence policy`} description="You don't request a licence directly: DE adds the account to the right group and the licence is applied.">
            <PolicyTables policy={d.policy} companyName={d.company.name} />
          </Panel>

          {d.canManagePeople && (
            <Panel id="people" title="People and account types" description="Set each person's account type and tier. Their licences follow the policy above.">
              {people.isLoading ? (
                <Skeleton className="h-32" />
              ) : people.isError ? (
                <Callout tone="bad" title="People couldn't be loaded" />
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full min-w-[720px] text-sm">
                    <caption className="sr-only">Account types for people in your company</caption>
                    <thead className="bg-[hsl(var(--sidebar-background))] text-left text-white">
                      <tr>
                        <th scope="col" className="px-3 py-2">Person</th>
                        <th scope="col" className="px-3 py-2">Account type</th>
                        <th scope="col" className="px-3 py-2">Tier</th>
                        <th scope="col" className="px-3 py-2">Base licence</th>
                        <th scope="col" className="px-3 py-2"><span className="sr-only">Save</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {people.data?.people.map((p) => <PersonRow key={p.userId} person={p} tiers={people.data!.tiers} onSaved={refresh} />)}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}

          {d.canEditPolicy && (
            <Panel id="policy-editor" title="Edit licence policy (DE admin)" description={`Applies to ${d.company.name}. Product names only; prices stay in the catalog.`}>
              <PolicyEditor clientId={d.company.id} initial={d.policy} onSaved={refresh} />
            </Panel>
          )}
        </div>
      )}
    </PortalLayout>
  );
}
