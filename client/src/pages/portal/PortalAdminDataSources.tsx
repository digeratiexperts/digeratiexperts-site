import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Building2, Check, Copy, RefreshCw } from "lucide-react";
import { PortalLayout } from "./PortalLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { portalGet, portalPost } from "@/lib/portalApi";
import { isDeAdmin, readPortalUser } from "@/lib/portalRoles";
import { cn } from "@/lib/utils";
import { Callout, DataTable, EmptyState, Panel, StatTile, Token, type DataColumn } from "@/components/portal/ui";

/**
 * DE admin only: what the VPN, phone and shipping pages read from, which
 * environment variables each provider needs (set or missing, never a value),
 * which companies are linked, and a per-company live check.
 * Server: server/portalDataSources.ts.
 */

type Area = "vpn" | "phone" | "shipping";

type EnvVarCheck = { name: string; purpose: string; set: boolean };

type ProviderChecklist = {
  provider: string;
  label: string;
  status: "built" | "notBuilt" | "reserved";
  active: boolean;
  needsClientMap: boolean;
  scopeHint: string | null;
  note: string | null;
  groups: Array<{
    id: string;
    label: string;
    rule: "all" | "any" | "optional";
    reserved: boolean;
    satisfied: boolean;
    options: Array<{ vars: EnvVarCheck[]; complete: boolean }>;
  }>;
  perCompanyEnv: { pattern: string; purpose: string; mapped: number; set: number } | null;
  ready: boolean;
};

type AreaReport = {
  area: Area;
  label: string;
  providerEnv: string;
  providerEnvSet: boolean;
  providerValueUnrecognized: boolean;
  status: { mode: "sample" | "hidden" | "live"; provider: string | null };
  allowedValues: string[];
  clientMapEnv: string;
  clientMapSet: boolean;
  mapError: boolean;
  mappedCompanies: number;
  providers: ProviderChecklist[];
};

type Coverage = {
  mapped: boolean;
  noMapNeeded: boolean;
  records: number | null;
  tokenSet: boolean | null;
  tokenEnvName: string | null;
};

type CompanyRow = { id: string; name: string; type: "msp" | "client"; areas: Partial<Record<Area, Coverage>> };

type Report = {
  success: boolean;
  areas: AreaReport[];
  companies: CompanyRow[];
  qaLogin: { emailEnv: string; passwordEnv: string; emailSet: boolean; passwordSet: boolean };
  envExample: string;
};

type CheckAnswer = { result: "ok" | "notMapped" | "notLive" | "notBuilt" | "error"; summary: string };

const RESULT_TOKEN: Record<CheckAnswer["result"], { label: string; tone: "ok" | "warn" | "bad" | "neutral" }> = {
  ok: { label: "Works", tone: "ok" },
  notMapped: { label: "Not mapped", tone: "warn" },
  notLive: { label: "Not live", tone: "neutral" },
  notBuilt: { label: "Not built", tone: "warn" },
  error: { label: "Failed", tone: "bad" },
};

const STATUS_TOKEN: Record<ProviderChecklist["status"], { label: string; tone: "ok" | "warn" | "neutral" }> = {
  built: { label: "Built", tone: "ok" },
  notBuilt: { label: "Not built", tone: "warn" },
  reserved: { label: "Reserved", tone: "neutral" },
};

/** An env var or value in a code token that copies itself. */
function CopyCode({ value, testId }: { value: string; testId?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
      className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-md border border-border bg-secondary px-2 py-1 text-left font-mono text-xs text-foreground hover:bg-accent md:min-h-8"
      aria-label={copied ? `Copied ${value}` : `Copy ${value}`}
      data-testid={testId}
    >
      <span className="min-w-0 break-all">{value}</span>
      {copied ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
    </button>
  );
}

function SetToken({ set }: { set: boolean }) {
  return <Token label={set ? "Set" : "Missing"} tone={set ? "ok" : "warn"} dot />;
}

function showingLabel(area: AreaReport): string {
  if (area.status.mode === "sample") return "Showing: sample data";
  if (area.status.mode === "hidden") return "Showing: hidden";
  const p = area.providers.find((x) => x.active);
  return `Showing: live from ${p?.label ?? area.status.provider}`;
}

function Checklist({ provider, area }: { provider: ProviderChecklist; area: Area }) {
  const empty = provider.groups.length === 0 && !provider.perCompanyEnv;
  return (
    <div className="space-y-4" data-testid={`data-sources-checklist-${area}-${provider.provider}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{provider.label}</p>
        <Token label={STATUS_TOKEN[provider.status].label} tone={STATUS_TOKEN[provider.status].tone} />
        {provider.status === "built" && !empty && (
          <Token label={provider.ready ? "Variables complete" : "Variables missing"} tone={provider.ready ? "ok" : "warn"} />
        )}
      </div>
      {provider.note && <p className="text-sm text-muted-foreground">{provider.note}</p>}
      {provider.needsClientMap && provider.scopeHint && (
        <p className="text-sm text-muted-foreground">Client map value: {provider.scopeHint}.</p>
      )}
      {provider.groups.map((g) => (
        <div key={g.id} className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium [overflow-wrap:anywhere]">{g.label}</p>
            {g.reserved && <Token label="Reserved" tone="neutral" />}
          </div>
          {g.options.map((opt, i) => (
            <div key={i} className="space-y-2">
              {i > 0 && <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">or</p>}
              <ul className="space-y-2">
                {opt.vars.map((v) => (
                  <li key={v.name} className="flex flex-wrap items-center gap-2">
                    {g.reserved ? <Token label="Not read yet" tone="neutral" /> : <SetToken set={v.set} />}
                    <CopyCode value={v.name} testId={`data-sources-copy-${v.name}`} />
                    <span className="min-w-0 basis-full text-xs text-muted-foreground sm:basis-auto">{v.purpose}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
      {provider.perCompanyEnv && (
        <div className="space-y-2">
          <p className="text-sm font-medium">One variable per company</p>
          <div className="flex flex-wrap items-center gap-2">
            <Token
              label={`${provider.perCompanyEnv.set} of ${provider.perCompanyEnv.mapped} set`}
              tone={provider.perCompanyEnv.mapped > 0 && provider.perCompanyEnv.set === provider.perCompanyEnv.mapped ? "ok" : "warn"}
            />
            <CopyCode value={provider.perCompanyEnv.pattern} />
            <span className="min-w-0 basis-full text-xs text-muted-foreground sm:basis-auto">{provider.perCompanyEnv.purpose}</span>
          </div>
        </div>
      )}
      {empty && <p className="text-sm text-muted-foreground">No variables beyond the provider switch.</p>}
    </div>
  );
}

function CoverageCell({ area, cov }: { area: AreaReport; cov: Coverage | undefined }) {
  if (!cov) return <span className="text-muted-foreground">—</span>;
  if (cov.noMapNeeded) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <Token label="No map needed" tone="neutral" />
        {cov.records !== null && (
          <span className="pt-num text-xs text-muted-foreground">
            {cov.records} {cov.records === 1 ? "record" : "records"}
          </span>
        )}
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {area.mapError ? (
        <Token label="Map unreadable" tone="bad" />
      ) : (
        <Token label={cov.mapped ? "Mapped" : "Not mapped"} tone={cov.mapped ? "ok" : "warn"} />
      )}
      {area.area === "phone" && cov.mapped && (
        <Token label={cov.tokenSet ? "Token set" : "Token missing"} tone={cov.tokenSet ? "ok" : "warn"} />
      )}
      {area.area === "phone" && cov.tokenEnvName && (
        <span className="break-all font-mono text-xs text-muted-foreground">{cov.tokenEnvName}</span>
      )}
    </span>
  );
}

function AreaSection({
  area,
  companies,
  results,
  pending,
  onCheck,
}: {
  area: AreaReport;
  companies: CompanyRow[];
  results: Record<string, CheckAnswer | { failed: string }>;
  pending: string | null;
  onCheck: (area: Area, clientId: string) => void;
}) {
  const live = area.status.mode === "live";
  const active = area.providers.find((p) => p.active) ?? null;
  const others = area.providers.filter((p) => !p.active);
  const showMapColumn = live || area.clientMapSet;

  const columns: DataColumn<CompanyRow>[] = [
    {
      key: "company",
      header: "Company",
      primary: true,
      cell: (c) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{c.name}</p>
          <p className="break-all font-mono text-xs text-muted-foreground">{c.id}</p>
        </div>
      ),
    },
    {
      key: "link",
      header: "Linked",
      primary: true,
      cell: (c) => <CoverageCell area={area} cov={c.areas[area.area]} />,
    },
    {
      key: "check",
      header: "Live check",
      primary: true,
      align: "right",
      className: "md:w-64",
      cell: (c) => {
        const key = `${area.area}:${c.id}`;
        const r = results[key];
        return (
          <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
            {r && "failed" in r && (
              <span className="text-xs pt-ink pt-tone-bad" data-testid={`data-sources-check-result-${area.area}-${c.id}`}>
                {r.failed}
              </span>
            )}
            {r && "result" in r && (
              <span className="inline-flex flex-wrap items-center gap-2" data-testid={`data-sources-check-result-${area.area}-${c.id}`}>
                <Token label={RESULT_TOKEN[r.result].label} tone={RESULT_TOKEN[r.result].tone} />
                <span className="pt-num text-xs text-muted-foreground">{r.summary}</span>
              </span>
            )}
            {live ? (
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 border-border bg-card hover:bg-accent md:min-h-9"
                disabled={pending === key}
                onClick={() => onCheck(area.area, c.id)}
                aria-label={`Check ${area.label} for ${c.name}`}
                data-testid={`data-sources-check-${area.area}-${c.id}`}
              >
                {pending === key ? "Checking" : "Check"}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">Page not live</span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <section className="space-y-4" aria-labelledby={`data-sources-${area.area}-title`} data-testid={`data-sources-area-${area.area}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id={`data-sources-${area.area}-title`} className="font-heading text-lg font-semibold">
          {area.label}
        </h2>
        <Token
          label={showingLabel(area)}
          tone={area.status.mode === "live" ? "ok" : area.status.mode === "hidden" ? "neutral" : "info"}
          dot
          className="max-w-full whitespace-normal"
        />
      </div>

      {area.providerValueUnrecognized && (
        <Callout tone="warn" title={`${area.providerEnv} has a value the portal does not accept`}>
          The page falls back to sample data. Use one of the allowed values below.
        </Callout>
      )}
      {area.mapError && (
        <Callout tone="bad" title={`${area.clientMapEnv} is not a valid JSON object`}>
          Live pages answer "not available" for every company until it is fixed. Expected shape: {'{"<clientId>":"<value>"}'}.
        </Callout>
      )}

      <Panel title="Settings" description="Variable names only. Values are never shown here.">
        <div className="space-y-5">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Provider switch</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <SetToken set={area.providerEnvSet} />
                <CopyCode value={area.providerEnv} testId={`data-sources-copy-${area.providerEnv}`} />
              </dd>
            </div>
            <div className="min-w-0 space-y-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Client map</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <SetToken set={area.clientMapSet} />
                <CopyCode value={area.clientMapEnv} testId={`data-sources-copy-${area.clientMapEnv}`} />
                <span className="pt-num text-xs text-muted-foreground">
                  {area.mappedCompanies} {area.mappedCompanies === 1 ? "company" : "companies"} mapped
                </span>
              </dd>
            </div>
            <div className="min-w-0 space-y-2 sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Allowed values</dt>
              <dd className="flex flex-wrap gap-2">
                {area.allowedValues.map((v) => (
                  <CopyCode key={v} value={v} />
                ))}
              </dd>
            </div>
          </dl>

          <div className="border-t border-border pt-5">
            {active ? (
              <Checklist provider={active} area={area.area} />
            ) : (
              <p className="text-sm text-muted-foreground">
                No provider is switched on. Each provider's variables are listed below.
              </p>
            )}
          </div>

          {others.length > 0 && (
            <details className="group border-t border-border pt-4" open={!active} data-testid={`data-sources-other-providers-${area.area}`}>
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
                {active ? `Other providers (${others.length})` : `Providers (${others.length})`}
              </summary>
              <div className="mt-3 space-y-6">
                {others.map((p) => (
                  <Checklist key={p.provider} provider={p} area={area.area} />
                ))}
              </div>
            </details>
          )}
        </div>
      </Panel>

      <Panel
        flush
        title="Companies"
        description={
          live
            ? "Check runs the live page's data load for one company and reports counts only."
            : "Checks are available once the page is live."
        }
      >
        <DataTable
          columns={showMapColumn ? columns : columns.filter((c) => c.key !== "link")}
          rows={companies}
          rowKey={(c) => c.id}
          rowTestId={(c) => `data-sources-row-${area.area}-${c.id}`}
          caption={`${area.label} coverage per company`}
          empty={<EmptyState icon={Building2} compact title="No companies yet" description="Companies added under Companies appear here." />}
        />
      </Panel>
    </section>
  );
}

export function PortalAdminDataSources() {
  const user = readPortalUser();
  const allowed = isDeAdmin(user);
  const [, setLocation] = useLocation();
  const [results, setResults] = useState<Record<string, CheckAnswer | { failed: string }>>({});
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed) setLocation("/portal/dashboard");
  }, [allowed, setLocation]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<Report>({
    queryKey: ["/api/portal/admin/data-sources"],
    queryFn: () => portalGet<Report>("/api/portal/admin/data-sources"),
    enabled: allowed,
  });

  const runCheck = async (area: Area, clientId: string) => {
    const key = `${area}:${clientId}`;
    setPending(key);
    try {
      const answer = await portalPost<CheckAnswer & { success: boolean }>("/api/portal/admin/data-sources/check", { area, clientId });
      setResults((prev) => ({ ...prev, [key]: { result: answer.result, summary: answer.summary } }));
    } catch (e) {
      const message = e instanceof Error && e.message ? e.message : "Check failed.";
      setResults((prev) => ({ ...prev, [key]: { failed: message.length > 120 ? "Check failed." : message } }));
    } finally {
      setPending(null);
    }
  };

  if (!allowed) return null;

  const tileFor = (a: AreaReport) => {
    const active = a.providers.find((p) => p.active);
    if (a.status.mode === "sample") return { value: "Sample data", hint: "No provider set", tone: "info" as const };
    if (a.status.mode === "hidden") return { value: "Hidden", hint: "Removed from the nav", tone: "neutral" as const };
    if (active && active.status !== "built") {
      return { value: active.label, hint: "Not built yet; page says data isn't available", tone: "warn" as const };
    }
    return {
      value: active?.label ?? a.status.provider ?? "Live",
      hint: a.mapError ? "Client map unreadable" : active?.ready ? "Variables complete" : "Variables missing",
      tone: a.mapError || !active?.ready ? ("warn" as const) : ("ok" as const),
    };
  };

  const qa = data?.qaLogin;
  const qaReady = !!qa && qa.emailSet && qa.passwordSet;

  return (
    <PortalLayout
      title="Data Sources"
      description="What the VPN, phone and shipping pages read from, which variables each provider needs, and which companies are linked."
      width="wide"
      titleTestId="data-sources-title"
      actions={
        <Button
          variant="outline"
          className="min-h-11 border-border bg-card hover:bg-accent md:min-h-9"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="data-sources-refresh"
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} aria-hidden="true" />
          Refresh
        </Button>
      }
    >
      <div className="space-y-8">
        {isError && (
          <Callout tone="bad" title="Could not load the data source settings" testId="data-sources-error">
            Try Refresh. If it keeps failing, check the portal server log.
          </Callout>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {isLoading || !data
            ? Array.from({ length: 4 }).map((_, i) => <StatTile key={i} label="" value="" loading />)
            : [
                ...data.areas.map((a) => {
                  const t = tileFor(a);
                  return <StatTile key={a.area} label={a.label} value={t.value} hint={t.hint} tone={t.tone} testId={`data-sources-tile-${a.area}`} />;
                }),
                <StatTile
                  key="qa"
                  label="Test login"
                  value={qaReady ? "Set" : "Not set"}
                  hint={qaReady ? "Both variables set" : "Email or password missing"}
                  tone={qaReady ? "ok" : "warn"}
                  testId="data-sources-tile-qa"
                />,
              ]}
        </div>

        <Callout tone="info" title="How to switch" testId="data-sources-how-to-switch">
          Set the variables in the portal's environment on the server, using{" "}
          <code className="break-all font-mono text-xs">{data?.envExample ?? "deploy/vps/env.production.example"}</code> as the
          template, then restart the portal. Leave the provider switch empty to keep sample data; set it to{" "}
          <code className="font-mono text-xs">hidden</code> to remove a page. Come back here and press Check for one company.
        </Callout>

        {isLoading && (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {data?.areas.map((a) => (
          <AreaSection
            key={a.area}
            area={a}
            companies={data.companies}
            results={results}
            pending={pending}
            onCheck={runCheck}
          />
        ))}

        {qa && (
          <Panel
            title="Test login"
            description="The QA account used for production checks. It is not a client company."
            id="data-sources-qa"
          >
            <ul className="space-y-3" data-testid="data-sources-qa-panel">
              <li className="flex flex-wrap items-center gap-2">
                <SetToken set={qa.emailSet} />
                <CopyCode value={qa.emailEnv} testId={`data-sources-copy-${qa.emailEnv}`} />
                <span className="text-xs text-muted-foreground">Sign-in email</span>
              </li>
              <li className="flex flex-wrap items-center gap-2">
                <SetToken set={qa.passwordSet} />
                <CopyCode value={qa.passwordEnv} testId={`data-sources-copy-${qa.passwordEnv}`} />
                <span className="text-xs text-muted-foreground">Password</span>
              </li>
            </ul>
          </Panel>
        )}
      </div>
    </PortalLayout>
  );
}
