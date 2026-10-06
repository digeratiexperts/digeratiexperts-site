import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Loader2, Upload } from "lucide-react";
import { PortalLayout } from "./PortalLayout";
import { Callout, Panel, Token } from "@/components/portal/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { directoryApi, type Directory, type DirectoryPerson, type DirectoryUnit, type ImportResult } from "@/lib/directoryApi";
import { cn } from "@/lib/utils";
import {
  APPROVABLE_REQUEST_TYPES,
  ID_SCHEMES,
  ORG_STRUCTURES,
  SUPPORT_TIERS,
  type OrgProfile,
  type SupportTier,
} from "@shared/orgDirectory";
import { TYPE_LABELS } from "@shared/serviceRequests";

/**
 * Structure & IDs: who leads each site or department (the person DE copies,
 * goes to when a team member can't be reached, and who approves requests),
 * every person's ID, VIP tier and away dates, a CSV import of company IDs,
 * and the company's ID and approval settings. Everyone sees their own card;
 * the rest is for the company IT contact (and DE admins).
 */

const control =
  "min-h-[36px] rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const button =
  "inline-flex min-h-[36px] items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-40";

const todayIso = () => new Date().toISOString().slice(0, 10);

function SaveState({ state }: { state: string }) {
  if (state === "idle" || state === "saving") return null;
  return (
    <p className={cn("mt-1 text-xs", state === "saved" ? "text-muted-foreground" : "text-destructive")} role="status">
      {state === "saved" ? "Saved" : state}
    </p>
  );
}

async function run(setState: (s: string) => void, fn: () => Promise<unknown>, after: () => void) {
  setState("saving");
  try {
    await fn();
    setState("saved");
    after();
  } catch (e) {
    setState(e instanceof Error ? e.message : "Couldn't save");
  }
}

// ---------- my card ----------

function MyCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["/api/portal/directory/me"], queryFn: directoryApi.me });
  const [away, setAway] = useState("");
  const [state, setState] = useState("idle");
  useEffect(() => setAway(q.data?.me.awayUntil ?? ""), [q.data?.me.awayUntil]);
  if (q.isLoading) return <Skeleton className="h-40 rounded-xl" />;
  if (q.isError || !q.data) return <Callout tone="bad" title="Your profile couldn't be loaded">{q.error instanceof Error ? q.error.message : ""}</Callout>;
  const d = q.data;
  const unitWord = d.structure === "site" ? "Site" : "Department";
  const refresh = () => void qc.invalidateQueries({ queryKey: ["/api/portal/directory/me"] });
  return (
    <Panel id="my-card" title="You" description="Your ID, who leads your team, and whether you're away.">
      <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Your ID</dt>
          <dd className="pt-num mt-0.5 text-base font-semibold">{d.me.personId}</dd>
          {d.me.companyPersonId && d.me.personId !== d.me.dePersonId && <dd className="text-xs text-muted-foreground">DE ID {d.me.dePersonId}</dd>}
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Support</dt>
          <dd className="mt-0.5">{d.me.supportTier === "vip" ? <Token label="VIP · direct support" tone="brand" /> : "Standard"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{unitWord}</dt>
          <dd className="mt-0.5">{d.unit?.name || <span className="text-muted-foreground">Not set</span>}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{unitWord} leader</dt>
          <dd className="mt-0.5">
            {d.leader ? `${d.leader.name}${d.backup ? ` (backup ${d.backup.name})` : ""}` : <span className="text-muted-foreground">Not set</span>}
          </dd>
        </div>
      </dl>
      {d.leads.length > 0 && (
        <p className="mt-4 text-sm">
          <BadgeCheck className="mr-1 inline h-4 w-4 text-[hsl(var(--primary))]" aria-hidden="true" />
          You lead {d.leads.map((l) => `${l.name}${l.role === "backup" ? " (backup)" : ""}`).join(", ")}. Requests that need approval reach you in{" "}
          <Link href="/portal/approvals" className="text-[hsl(var(--primary))] underline">
            Approvals
          </Link>
          .
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
        <div>
          <label htmlFor="my-away" className="block text-sm font-medium">
            Away until
          </label>
          <p className="text-xs text-muted-foreground">
            {d.me.supportTier === "vip" ? "DE still contacts you directly." : "While you're away, DE goes to your leader and approvals skip you."}
          </p>
          <input id="my-away" type="date" min={todayIso()} className={cn(control, "mt-1")} value={away} onChange={(e) => setAway(e.target.value)} />
        </div>
        <button type="button" className={button} disabled={state === "saving" || away === (d.me.awayUntil ?? "")} onClick={() => void run(setState, () => directoryApi.setMyAvailability(away || null), refresh)}>
          {state === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Save
        </button>
        {d.me.awayUntil && (
          <button type="button" className="min-h-[36px] text-xs font-medium text-[hsl(var(--primary))]" onClick={() => void run(setState, () => directoryApi.setMyAvailability(null), refresh)}>
            I'm back
          </button>
        )}
        <SaveState state={state} />
      </div>
    </Panel>
  );
}

// ---------- leaders ----------

function PersonSelect({ id, label, value, people, onChange, exclude }: { id: string; label: string; value: string; people: DirectoryPerson[]; onChange: (v: string) => void; exclude?: string }) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select id={id} className={cn(control, "w-full")} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Not set</option>
        {people
          .filter((p) => p.userId !== exclude)
          .map((p) => (
            <option key={p.userId} value={p.userId}>
              {p.name}
            </option>
          ))}
      </select>
    </>
  );
}

function LeaderRow({ unit, people, onSaved }: { unit: DirectoryUnit; people: DirectoryPerson[]; onSaved: () => void }) {
  const [leader, setLeader] = useState(unit.leaderUserId ?? "");
  const [backup, setBackup] = useState(unit.backupUserId ?? "");
  const [cc, setCc] = useState(unit.ccLeader);
  const [state, setState] = useState("idle");
  const dirty = leader !== (unit.leaderUserId ?? "") || backup !== (unit.backupUserId ?? "") || cc !== unit.ccLeader;
  return (
    <tr className="border-t border-border align-top">
      <th scope="row" className="px-3 py-2 text-left font-medium">
        {unit.name}
        {unit.code && unit.code !== unit.name && <div className="text-xs font-normal text-muted-foreground">{unit.code}</div>}
      </th>
      <td className="px-3 py-2">
        <PersonSelect id={`ldr-${unit.id}`} label={`Leader of ${unit.name}`} value={leader} people={people} onChange={setLeader} />
      </td>
      <td className="px-3 py-2">
        <PersonSelect id={`bkp-${unit.id}`} label={`Backup leader of ${unit.name}`} value={backup} people={people} onChange={setBackup} exclude={leader} />
      </td>
      <td className="px-3 py-2">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cc} onChange={(e) => setCc(e.target.checked)} /> Copy leader
        </label>
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          className={button}
          disabled={!dirty || state === "saving"}
          onClick={() =>
            void run(setState, () => directoryApi.saveLeader({ unitKind: unit.kind, unitId: unit.id, leaderUserId: leader || null, backupUserId: backup || null, ccLeader: cc }), onSaved)
          }
        >
          Save
        </button>
        <SaveState state={state} />
      </td>
    </tr>
  );
}

function Leaders({ d, onSaved }: { d: Directory; onSaved: () => void }) {
  const word = d.profile.structure === "site" ? "Site" : "Department";
  return (
    <Panel
      id="org-leaders"
      title={`${word} leaders`}
      description={`One leader per ${word.toLowerCase()}, with an optional backup. The leader is copied on requests for their team, is who DE goes to when a team member can't be reached (never for VIPs), and approves requests that need it.`}
      flush
    >
      {d.units.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          {d.profile.structure === "site" ? (
            <>No sites yet. DE adds your sites (LIDs); ask your account team.</>
          ) : (
            <>
              No departments yet. Add them on{" "}
              <Link href="/portal/people" className="text-[hsl(var(--primary))] underline">
                People & Org
              </Link>
              .
            </>
          )}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">{word} leaders</caption>
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-[0.06em] text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">{word}</th>
                <th scope="col" className="px-3 py-2 font-medium">Leader</th>
                <th scope="col" className="px-3 py-2 font-medium">Backup</th>
                <th scope="col" className="px-3 py-2 font-medium">Copies</th>
                <th scope="col" className="px-3 py-2 font-medium"><span className="sr-only">Save</span></th>
              </tr>
            </thead>
            <tbody>
              {d.units.map((u) => (
                <LeaderRow key={`${u.kind}:${u.id}:${u.leaderUserId}:${u.backupUserId}:${u.ccLeader}`} unit={u} people={d.people} onSaved={onSaved} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ---------- people ----------

function PersonRow({ person, d, onSaved }: { person: DirectoryPerson; d: Directory; onSaved: () => void }) {
  const [companyId, setCompanyId] = useState(person.companyPersonId ?? "");
  const [siteId, setSiteId] = useState(person.siteId ?? "");
  const [tier, setTier] = useState<SupportTier>(person.supportTier);
  const [away, setAway] = useState(person.awayUntil ?? "");
  const [state, setState] = useState("idle");
  const dirty = companyId !== (person.companyPersonId ?? "") || siteId !== (person.siteId ?? "") || tier !== person.supportTier || away !== (person.awayUntil ?? "");
  const dept = d.departments.find((x) => x.id === person.departmentId);
  return (
    <tr className="border-t border-border align-top">
      <td className="px-3 py-2">
        <div className="font-medium">
          {person.name} {person.isItContact && <Token label="IT contact" tone="info" />}
        </div>
        <div className="text-xs text-muted-foreground">{person.email}</div>
      </td>
      <td className="px-3 py-2">
        <div className="pt-num font-medium">{person.personId}</div>
        <div className="pt-num text-xs text-muted-foreground">DE {person.dePersonId}</div>
      </td>
      <td className="px-3 py-2">
        <label htmlFor={`cid-${person.userId}`} className="sr-only">
          {d.profile.companyIdLabel} for {person.name}
        </label>
        <input
          id={`cid-${person.userId}`}
          className={cn(control, "w-32")}
          value={companyId}
          placeholder={d.profile.companyIdPattern || "—"}
          onChange={(e) => setCompanyId(e.target.value)}
        />
      </td>
      <td className="px-3 py-2">
        {d.profile.structure === "site" ? (
          <>
            <label htmlFor={`site-${person.userId}`} className="sr-only">
              Site for {person.name}
            </label>
            <select id={`site-${person.userId}`} className={control} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">Not set</option>
              {d.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          <span className="text-sm">{dept?.name ?? <span className="text-muted-foreground">Not set</span>}</span>
        )}
      </td>
      <td className="px-3 py-2">
        <label htmlFor={`tier-${person.userId}`} className="sr-only">
          Support tier for {person.name}
        </label>
        <select id={`tier-${person.userId}`} className={control} value={tier} onChange={(e) => setTier(e.target.value as SupportTier)}>
          {SUPPORT_TIERS.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <label htmlFor={`away-${person.userId}`} className="sr-only">
          Away until, for {person.name}
        </label>
        <input id={`away-${person.userId}`} type="date" className={control} value={away} onChange={(e) => setAway(e.target.value)} />
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          className={button}
          disabled={!dirty || state === "saving"}
          onClick={() =>
            void run(
              setState,
              () =>
                directoryApi.savePerson(person.userId, {
                  companyPersonId: companyId.trim() || null,
                  ...(d.profile.structure === "site" ? { siteId: siteId || null } : {}),
                  supportTier: tier,
                  awayUntil: away || null,
                }),
              onSaved,
            )
          }
        >
          Save
        </button>
        <SaveState state={state} />
      </td>
    </tr>
  );
}

function People({ d, onSaved }: { d: Directory; onSaved: () => void }) {
  const [filter, setFilter] = useState("");
  const list = d.people.filter((p) => !filter || `${p.name} ${p.email} ${p.personId} ${p.dePersonId}`.toLowerCase().includes(filter.toLowerCase()));
  return (
    <Panel
      id="org-people"
      title="People & IDs"
      description={`Every person keeps a permanent DE ID. ${d.profile.idScheme === "company" ? `Your company's ${d.profile.companyIdLabel} is shown where set.` : "Add your company's IDs to show them instead (Settings)."} VIPs get direct support only.`}
      actions={
        <>
          <label htmlFor="org-filter" className="sr-only">
            Filter people
          </label>
          <input id="org-filter" className={control} placeholder="Filter" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </>
      }
      flush
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <caption className="sr-only">People, IDs and support tier</caption>
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-[0.06em] text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Person</th>
              <th scope="col" className="px-3 py-2 font-medium">ID</th>
              <th scope="col" className="px-3 py-2 font-medium">{d.profile.companyIdLabel}</th>
              <th scope="col" className="px-3 py-2 font-medium">{d.profile.structure === "site" ? "Site" : "Department"}</th>
              <th scope="col" className="px-3 py-2 font-medium">Support</th>
              <th scope="col" className="px-3 py-2 font-medium">Away until</th>
              <th scope="col" className="px-3 py-2 font-medium"><span className="sr-only">Save</span></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <PersonRow key={`${p.userId}:${p.companyPersonId}:${p.siteId}:${p.supportTier}:${p.awayUntil}`} person={p} d={d} onSaved={onSaved} />
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ---------- import ----------

function ImportPeople({ d, onSaved }: { d: Directory; onSaved: () => void }) {
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [state, setState] = useState<"idle" | "busy" | string>("idle");
  const unitWord = d.profile.structure === "site" ? "Site" : "Department";
  const go = async (apply: boolean) => {
    setState("busy");
    try {
      const r = await directoryApi.importCsv(csv, apply);
      setResult(r);
      setState("idle");
      if (apply && r.applied) onSaved();
    } catch (e) {
      setState(e instanceof Error ? e.message : "Import failed");
    }
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setCsv(await f.text());
    setResult(null);
  };
  return (
    <Panel
      id="org-import"
      title="Import your company's IDs"
      description={`Match people by email and bring in your ${d.profile.companyIdLabel}s, ${unitWord.toLowerCase()}s and VIPs. Preview first; nothing changes until you apply, and a file with any problem is not applied.`}
    >
      <p className="text-sm text-muted-foreground">
        Columns (first row): <code className="rounded bg-muted px-1">Email</code>, <code className="rounded bg-muted px-1">Employee ID</code>,{" "}
        <code className="rounded bg-muted px-1">{unitWord}</code>, <code className="rounded bg-muted px-1">VIP</code> (yes / no),{" "}
        <code className="rounded bg-muted px-1">Away until</code>. Only Email is required. People without a portal account are listed so you can invite them first.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="inline-flex min-h-[36px] cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-accent">
          <Upload className="h-4 w-4" aria-hidden="true" /> Choose CSV
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
        <span className="text-xs text-muted-foreground">or paste below</span>
      </div>
      <label htmlFor="org-csv" className="sr-only">
        CSV
      </label>
      <textarea
        id="org-csv"
        className={cn(control, "mt-2 min-h-[140px] w-full font-mono text-xs")}
        placeholder={`Email,Employee ID,${unitWord},VIP\nann@example.com,E00123,HQ,no`}
        value={csv}
        onChange={(e) => {
          setCsv(e.target.value);
          setResult(null);
        }}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={button} disabled={!csv.trim() || state === "busy"} onClick={() => void go(false)}>
          {state === "busy" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Preview
        </button>
        <button type="button" className={button} disabled={!result?.canApply || state === "busy"} onClick={() => void go(true)}>
          Apply {result?.rows.length ? `${result.rows.length} rows` : ""}
        </button>
      </div>
      {state !== "idle" && state !== "busy" && <Callout tone="bad" title={state} />}
      {result && (
        <div className="mt-4 space-y-3">
          {result.errors.map((e) => (
            <Callout key={e} tone="bad" title={e} />
          ))}
          {result.applied > 0 && <Callout tone="ok" title={`Updated ${result.applied} people`} />}
          {result.rows.length > 0 && (
            <div className="max-h-[360px] overflow-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <caption className="sr-only">Import preview</caption>
                <thead className="sticky top-0 bg-muted text-left">
                  <tr>
                    <th scope="col" className="px-2 py-1.5">Line</th>
                    <th scope="col" className="px-2 py-1.5">Email</th>
                    <th scope="col" className="px-2 py-1.5">Person</th>
                    <th scope="col" className="px-2 py-1.5">{d.profile.companyIdLabel}</th>
                    <th scope="col" className="px-2 py-1.5">VIP</th>
                    <th scope="col" className="px-2 py-1.5">Problems</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.line} className={cn("border-t border-border", r.errors.length && "bg-[hsl(var(--destructive)/0.06)]")}>
                      <td className="px-2 py-1.5">{r.line}</td>
                      <td className="px-2 py-1.5">{r.email}</td>
                      <td className="px-2 py-1.5">{r.name ?? "—"}</td>
                      <td className="px-2 py-1.5">{r.companyPersonId ?? "—"}</td>
                      <td className="px-2 py-1.5">{r.supportTier === "vip" ? "Yes" : r.supportTier ? "No" : "—"}</td>
                      <td className="px-2 py-1.5 text-destructive">{r.errors.join("; ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {result.rowErrors > 0 && <p className="text-sm text-destructive">{result.rowErrors} rows need fixing before the file can be applied.</p>}
        </div>
      )}
    </Panel>
  );
}

// ---------- settings ----------

function Settings({ d, onSaved }: { d: Directory; onSaved: () => void }) {
  const [p, setP] = useState<OrgProfile>(d.profile);
  const [state, setState] = useState("idle");
  useEffect(() => setP(d.profile), [d.profile]);
  const set = (patch: Partial<OrgProfile>) => setP((x) => ({ ...x, ...patch }));
  const dirty = useMemo(() => JSON.stringify(p) !== JSON.stringify(d.profile), [p, d.profile]);
  return (
    <Panel id="org-settings" title="Settings" description="How your company is organised, which ID to show, and which requests need a leader's approval.">
      <div className="grid gap-6 lg:grid-cols-2">
        <fieldset>
          <legend className="text-sm font-semibold">Organised</legend>
          {ORG_STRUCTURES.map((s) => (
            <label key={s.key} className="mt-2 flex gap-2 text-sm">
              <input type="radio" name="org-structure" checked={p.structure === s.key} onChange={() => set({ structure: s.key })} />
              <span>
                <span className="font-medium">{s.label}</span>
                <span className="block text-xs text-muted-foreground">{s.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend className="text-sm font-semibold">ID shown for each person</legend>
          {ID_SCHEMES.map((s) => (
            <label key={s.key} className="mt-2 flex gap-2 text-sm">
              <input type="radio" name="org-ids" checked={p.idScheme === s.key} onChange={() => set({ idScheme: s.key })} />
              <span>
                <span className="font-medium">{s.label}</span>
                <span className="block text-xs text-muted-foreground">{s.hint}</span>
              </span>
            </label>
          ))}
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="org-prefix" className="block text-xs font-medium">
                DE ID prefix
              </label>
              <input id="org-prefix" className={cn(control, "mt-1 w-full uppercase")} maxLength={6} value={p.idPrefix} onChange={(e) => set({ idPrefix: e.target.value.toUpperCase() })} />
              <p className="mt-1 text-[11px] text-muted-foreground">New IDs only; existing IDs never change.</p>
            </div>
            <div>
              <label htmlFor="org-cid-label" className="block text-xs font-medium">
                Your ID is called
              </label>
              <input id="org-cid-label" className={cn(control, "mt-1 w-full")} value={p.companyIdLabel} onChange={(e) => set({ companyIdLabel: e.target.value })} />
            </div>
            <div>
              <label htmlFor="org-cid-pattern" className="block text-xs font-medium">
                Naming rule
              </label>
              <input id="org-cid-pattern" className={cn(control, "mt-1 w-full font-mono")} placeholder="E#####" value={p.companyIdPattern} onChange={(e) => set({ companyIdPattern: e.target.value })} />
              <p className="mt-1 text-[11px] text-muted-foreground"># digit · A capital letter · * letter or digit</p>
            </div>
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-semibold">Approvals</legend>
          <p className="text-xs text-muted-foreground">Licence requests follow your licence policy. Choose the other requests that need a leader's approval first.</p>
          {APPROVABLE_REQUEST_TYPES.map((t) => (
            <label key={t} className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={p.approvalRequiredFor.includes(t)}
                onChange={(e) => set({ approvalRequiredFor: e.target.checked ? [...p.approvalRequiredFor, t] : p.approvalRequiredFor.filter((x) => x !== t) })}
              />
              {TYPE_LABELS[t]}
            </label>
          ))}
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={p.vipSkipsApproval} onChange={(e) => set({ vipSkipsApproval: e.target.checked })} />
            VIP requests don't need approval
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            Who approves: the {p.structure === "site" ? "site" : "department"} leader, then the backup, then the person's manager, then your IT contact. Anyone away is skipped.
          </p>
        </fieldset>
      </div>
      <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
        <button type="button" className={button} disabled={!dirty || state === "saving"} onClick={() => void run(setState, () => directoryApi.saveProfile(p), onSaved)}>
          {state === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Save settings
        </button>
        <SaveState state={state} />
      </div>
    </Panel>
  );
}

// ---------- page ----------

const TABS = [
  { id: "leaders", label: "Leaders" },
  { id: "people", label: "People & IDs" },
  { id: "import", label: "Import" },
  { id: "settings", label: "Settings" },
] as const;

export default function PortalOrganization() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["/api/portal/directory/me"], queryFn: directoryApi.me });
  const dir = useQuery({ queryKey: ["/api/portal/directory"], queryFn: directoryApi.directory, enabled: Boolean(me.data?.canManage) });
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("leaders");
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["/api/portal/directory"] });
    void qc.invalidateQueries({ queryKey: ["/api/portal/directory/me"] });
  };

  return (
    <PortalLayout title="Structure & IDs" description="Site or department leaders, VIPs, people IDs and approvals." width="wide">
      <div className="space-y-6">
        <MyCard />
        {me.data?.canManage && (
          <section aria-label="Manage your company">
            <div role="tablist" aria-label="Manage" className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  id={`org-tab-${t.id}`}
                  role="tab"
                  type="button"
                  aria-selected={tab === t.id}
                  aria-controls={`org-panel-${t.id}`}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "-mb-px min-h-[40px] shrink-0 border-b-2 px-3 text-sm font-medium",
                    tab === t.id ? "border-[hsl(var(--primary))] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div id={`org-panel-${tab}`} role="tabpanel" aria-labelledby={`org-tab-${tab}`}>
              {dir.isLoading ? (
                <Skeleton className="h-64 rounded-xl" />
              ) : dir.isError || !dir.data ? (
                <Callout tone="bad" title="The directory couldn't be loaded">{dir.error instanceof Error ? dir.error.message : ""}</Callout>
              ) : tab === "leaders" ? (
                <Leaders d={dir.data} onSaved={refresh} />
              ) : tab === "people" ? (
                <People d={dir.data} onSaved={refresh} />
              ) : tab === "import" ? (
                <ImportPeople d={dir.data} onSaved={refresh} />
              ) : (
                <Settings d={dir.data} onSaved={refresh} />
              )}
            </div>
          </section>
        )}
      </div>
    </PortalLayout>
  );
}
