import { useQuery } from "@tanstack/react-query";
import { Mail, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PortalLayout } from "./PortalLayout";
import { portalGet } from "@/lib/portalApi";
import { DataTable, EmptyState, Panel, Token, type DataColumn } from "@/components/portal/ui";
import { CompanyReadiness } from "@/components/portal/CompanyReadiness";
import type { PortalCompanyProfile } from "@shared/portalCompanyProfile";

export default function PortalCompany() {
  const query = useQuery({ queryKey: ["/api/portal/company"], queryFn: () => portalGet<PortalCompanyProfile>("/api/portal/company"), retry: 1 });
  // A failed refetch does not authorize displaying stale company details.
  const data = query.isError ? undefined : query.data;
  const company = data?.company;
  const columns: DataColumn<PortalCompanyProfile["team"][number]>[] = [
    { key: "name", header: "Name", primary: true, cell: p => <div className="min-w-0"><p className="break-words font-medium">{p.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{p.isItContact ? "Company IT contact" : "Team member"}</p></div> },
    { key: "email", header: "Email", primary: true, cell: p => <a href={`mailto:${p.email}`} className="inline-flex min-w-0 items-center gap-1.5 pt-link hover:underline"><Mail className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="break-all">{p.email}</span></a> },
  ];
  return <PortalLayout title="Company Profile" description="Company information and people with access to your organization's portal.">
    <CompanyReadiness loading={query.isPending} error={query.error} missing={data?.status === "choose_company" || data?.status === "company_unlinked"} unavailable={data?.status === "company_unavailable"} onRetry={query.refetch} />
    {query.isPending ? <Skeleton className="h-48 w-full rounded-xl" /> : company ? <div className="space-y-4">
      <Panel id="company-info" title="Company information" description="Details from your company's portal record">
        <div className="flex flex-wrap items-center gap-3"><p className="break-words font-heading text-xl font-semibold">{company.name}</p>{company.industry && <Token label={company.industry} />}</div>
        <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs font-medium text-muted-foreground">Email</dt><dd className="mt-0.5 break-all">{company.email ? <a className="pt-link hover:underline" href={`mailto:${company.email}`}>{company.email}</a> : "Not provided"}</dd></div>
          <div><dt className="text-xs font-medium text-muted-foreground">Phone</dt><dd className="mt-0.5 pt-num">{company.phone || "Not provided"}</dd></div>
        </dl>
      </Panel>
      <Panel id="team-members" title="Team members" description="Active portal users in this company" flush>
        <DataTable columns={columns} rows={data?.team ?? []} rowKey={p => p.id} rowTestId={p => `contact-row-${p.id}`} caption="Team members"
          empty={<EmptyState compact icon={Users} title="No active portal users found" description="People appear here after portal access is added for this company." />} />
      </Panel>
    </div> : null}
  </PortalLayout>;
}
