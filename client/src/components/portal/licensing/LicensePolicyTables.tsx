import { useQuery } from "@tanstack/react-query";
import { Token } from "@/components/portal/ui";
import { DocTable } from "@/components/portal/kb/DocTable";
import { licensingApi } from "@/lib/licensingApi";
import {
  ACCOUNT_TYPES,
  ASSIGNMENT_LABELS,
  accountTypeLabel,
  catalogLicense,
  platformLabel,
  type Assignment,
  type LicensePolicy,
} from "@shared/licensing";

export function AssignmentToken({ assignment }: { assignment: Assignment }) {
  const tone = assignment === "automatic" ? "ok" : assignment === "request" ? "info" : "neutral";
  return <Token label={ASSIGNMENT_LABELS[assignment]} tone={tone} />;
}

const APPROVAL_LABEL = { none: "No approval", manager: "Manager approves", it_contact: "IT contact approves" } as const;

/** The company's licence policy as reference tables, one set per platform. */
export function PolicyTables({ policy, companyName }: { policy: LicensePolicy; companyName: string }) {
  if (!policy.platforms.length) {
    return (
      <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        DE hasn't recorded {companyName ? `${companyName}'s` : "your company's"} licence policy yet. Ask your account team.
      </p>
    );
  }
  const order = (t: string) => ACCOUNT_TYPES.findIndex((a) => a.key === t);
  return (
    <div className="space-y-6">
      {policy.platforms.map(({ platform, tenantLabel }) => {
        const base = policy.baseRules.filter((r) => r.platform === platform).sort((a, b) => order(a.accountType) - order(b.accountType));
        const addons = policy.addons.filter((r) => r.platform === platform);
        return (
          <section key={platform} aria-labelledby={`pol-${platform}`}>
            <h3 id={`pol-${platform}`} className="text-base font-semibold text-foreground">
              {platformLabel(platform)}
              {tenantLabel ? ` · ${tenantLabel}` : ""}: licence groups
            </h3>
            <DocTable
              caption={`${platformLabel(platform)} base licences by account type`}
              head={["Account type", "Tier", "Licence", "How it is assigned", "Group"]}
              rows={base.map((r) => [
                accountTypeLabel(r.accountType),
                r.tier ?? "Any",
                catalogLicense(r.licenseKey)?.name ?? "—",
                <AssignmentToken key="a" assignment={r.assignment} />,
                r.group ? <code className="break-all text-xs">{r.group}</code> : "—",
              ])}
            />
            {addons.length > 0 && (
              <DocTable
                caption={`${platformLabel(platform)} add-on licences`}
                head={["Add-on licence", "Who can request it", "Approval", "Group"]}
                rows={addons.map((r) => [
                  catalogLicense(r.licenseKey)?.name ?? r.licenseKey,
                  r.eligibleAccountTypes.map(accountTypeLabel).join(", "),
                  APPROVAL_LABEL[r.approval],
                  r.group ? <code className="break-all text-xs">{r.group}</code> : "—",
                ])}
              />
            )}
          </section>
        );
      })}
      {policy.notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{policy.notes}</p>}
    </div>
  );
}

/** Live block for knowledge articles: `{{license-policy}}` renders the reader's own company policy. */
export function LivePolicyBlock() {
  const q = useQuery({ queryKey: ["/api/portal/licensing"], queryFn: licensingApi.overview, staleTime: 60_000 });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading your company's licence policy…</p>;
  if (q.isError || !q.data) return <p className="text-sm text-muted-foreground">Your company's licence policy couldn't be loaded.</p>;
  return <PolicyTables policy={q.data.policy} companyName={q.data.company.name} />;
}
