import { useQuery } from "@tanstack/react-query";
import { Building2, ExternalLink, Mail, Phone, RefreshCcw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PortalLayout } from "./PortalLayout";
import { portalGet } from "@/lib/portalApi";
import { Callout, DataTable, EmptyState, Panel, Token, type DataColumn } from "@/components/portal/ui";

interface CRMContact {
  id: string;
  Full_Name: string;
  First_Name: string;
  Last_Name: string;
  Email: string;
  Phone: string;
  Mobile: string;
  Title: string;
  Department: string;
  zohoLink?: string;
}

interface CRMAccount {
  id: string;
  Account_Name: string;
  Phone: string;
  Website: string;
  Industry: string;
  Billing_Street: string;
  Billing_City: string;
  Billing_State: string;
  Billing_Code: string;
  Description: string;
  Created_Time: string;
  zohoLink?: string;
}

interface CompanyData {
  account: CRMAccount | null;
  contacts: CRMContact[];
  zohoConnected: boolean;
}

export default function PortalCompany() {
  const { data, isLoading, error, refetch } = useQuery<CompanyData>({
    queryKey: ["/api/portal/company"],
    queryFn: () => portalGet<CompanyData>("/api/portal/company"),
    retry: 1,
  });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getAddress = (account: CRMAccount) => {
    const parts = [
      account.Billing_Street,
      account.Billing_City,
      account.Billing_State,
      account.Billing_Code,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "Not provided";
  };

  const account = data?.account ?? null;

  const contactColumns: DataColumn<CRMContact>[] = [
    {
      key: "name",
      header: "Name",
      primary: true,
      cell: (c) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{c.Full_Name || `${c.First_Name} ${c.Last_Name}`}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.Title || c.Department || "Team Member"}</p>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      primary: true,
      cell: (c) =>
        c.Email ? (
          <a href={`mailto:${c.Email}`} className="inline-flex items-center gap-1.5 pt-link hover:underline" data-testid={`link-email-${c.id}`}>
            <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{c.Email}</span>
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "phone",
      header: "Phone",
      primary: true,
      className: "w-44 whitespace-nowrap",
      cell: (c) =>
        c.Phone || c.Mobile ? (
          <a href={`tel:${c.Phone || c.Mobile}`} className="inline-flex items-center gap-1.5 pt-num pt-link hover:underline" data-testid={`link-phone-${c.id}`}>
            <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
            {c.Phone || c.Mobile}
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "zoho",
      header: <span className="sr-only">Zoho</span>,
      align: "right",
      className: "w-14",
      cell: (c) =>
        c.zohoLink ? (
          <a
            href={c.zohoLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            title="View in Zoho"
            aria-label={`View ${c.Full_Name || c.First_Name} in Zoho`}
            data-testid={`link-zoho-${c.id}`}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        ) : null,
    },
  ];

  const details: { label: string; value: React.ReactNode }[] = account
    ? [
        ...(account.Phone ? [{ label: "Phone", value: <span className="pt-num">{account.Phone}</span> }] : []),
        ...(account.Website
          ? [
              {
                label: "Website",
                value: (
                  <a
                    href={account.Website.startsWith("http") ? account.Website : `https://${account.Website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 pt-link hover:underline"
                    data-testid="link-company-website"
                  >
                    {account.Website}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                ),
              },
            ]
          : []),
        { label: "Address", value: getAddress(account) },
        { label: "Customer since", value: <span className="pt-num">{formatDate(account.Created_Time)}</span> },
      ]
    : [];

  return (
    <PortalLayout title="Company Profile" description="Your organization details and team, as held in our CRM.">
      <div className="space-y-4">
        {error && (
          <Callout
            tone="bad"
            title="Failed to load company data"
            action={
              <Button variant="outline" size="sm" className="border-border bg-card hover:bg-accent" onClick={() => refetch()} data-testid="button-retry-company">
                <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                Retry
              </Button>
            }
          >
            Please try again.
          </Callout>
        )}

        {!data?.zohoConnected && !isLoading && (
          <Callout tone="warn" title="CRM not connected yet">
            CRM integration is being configured. Company data may be limited.
          </Callout>
        )}

        <Panel
          id="company-info"
          title="Company information"
          description="Your organization details from our CRM"
          actions={
            account?.zohoLink ? (
              <Button asChild variant="outline" size="sm" className="border-border bg-card hover:bg-accent">
                <a href={account.zohoLink} target="_blank" rel="noopener noreferrer" data-testid="button-edit-in-zoho">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Edit in Zoho
                </a>
              </Button>
            ) : undefined
          }
        >
          {isLoading ? (
            <div className="space-y-3" aria-busy="true" aria-live="polite">
              <Skeleton className="h-7 w-64" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-56" />
            </div>
          ) : account ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-heading text-xl font-semibold leading-tight">{account.Account_Name}</p>
                {account.Industry && <Token label={account.Industry} />}
              </div>

              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                {details.map((d) => (
                  <div key={d.label}>
                    <dt className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{d.label}</dt>
                    <dd className="mt-0.5 font-medium">{d.value}</dd>
                  </div>
                ))}
              </dl>

              {account.Description && (
                <div className="border-t border-border pt-4">
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Description</p>
                  <p className="mt-1 text-sm leading-relaxed">{account.Description}</p>
                </div>
              )}
            </div>
          ) : (
            <EmptyState compact icon={Building2} title="No company information found" description="Contact support to link your account." />
          )}
        </Panel>

        <Panel
          id="team-members"
          title="Team members"
          description={isLoading ? "People at your organization with portal access" : `${data?.contacts?.length ?? 0} ${(data?.contacts?.length ?? 0) === 1 ? "person" : "people"} at your organization with portal access`}
          flush
        >
          <DataTable<CRMContact>
            columns={contactColumns}
            rows={data?.contacts ?? []}
            rowKey={(c) => c.id}
            rowTestId={(c) => `contact-row-${c.id}`}
            loading={isLoading}
            loadingRows={3}
            caption="Team members"
            empty={<EmptyState compact icon={Users} title="No team members found" description="Contacts linked to your account in the CRM appear here." />}
          />
        </Panel>
      </div>
    </PortalLayout>
  );
}
