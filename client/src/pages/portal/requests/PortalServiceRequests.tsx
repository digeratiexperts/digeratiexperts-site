import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ClipboardList, Heart, ShoppingCart } from "lucide-react";
import { PortalLayout } from "../PortalLayout";
import { Callout, EmptyState, Panel } from "@/components/portal/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { LicenseIcon, LoanerComputerIcon, ReturnComputerIcon } from "@/components/portal/requests/icons";
import { RequestStatusToken } from "@/components/portal/requests/RequestStatusToken";
import { isFavoriteRequest } from "@/components/portal/requests/ServiceRequestShell";
import { srApi } from "@/lib/serviceRequestsApi";
import { BASKET_STATUS, TYPE_LABELS, TYPE_ROUTES, type ServiceRequestType } from "@shared/serviceRequests";

const SOFTWARE: Array<{ type: ServiceRequestType; blurb: string; Icon: typeof LoanerComputerIcon }> = [
  {
    type: "license_request",
    blurb: "Microsoft 365, Google Workspace or Zoho licences, and add-ons such as Visio or Project.",
    Icon: LicenseIcon,
  },
];

const CATALOG: Array<{ type: ServiceRequestType; blurb: string; Icon: typeof LoanerComputerIcon }> = [
  {
    type: "loaner_computer",
    blurb: "Borrow a laptop or desktop for a limited time while yours is away or for a short assignment.",
    Icon: LoanerComputerIcon,
  },
  {
    type: "return_computer",
    blurb: "Send a computer back to the IT stockroom or for disposal, for example when someone leaves.",
    Icon: ReturnComputerIcon,
  },
];

/** Service Requests: the catalog (Computers) and My Requests. */
export default function PortalServiceRequests() {
  const list = useQuery({ queryKey: ["/api/portal/service-requests"], queryFn: srApi.list });
  const requests = (list.data?.requests ?? []).filter((r) => r.status !== BASKET_STATUS);
  const basketCount = (list.data?.requests ?? []).filter((r) => r.status === BASKET_STATUS).length;

  return (
    <PortalLayout
      title="Service Requests"
      description="Request equipment and IT services, and follow the requests made by you or for you."
      width="wide"
      actions={
        basketCount > 0 ? (
          <Link
            href="/portal/requests/basket"
            className="inline-flex min-h-[40px] items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold hover:bg-accent"
          >
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            Request basket ({basketCount})
          </Link>
        ) : undefined
      }
    >
      <div className="space-y-8">
        {[
          { id: "computers", title: "Computers", items: CATALOG },
          { id: "software", title: "Software & access", items: SOFTWARE },
        ].map((group) => (
        <section key={group.id} id={group.id} aria-labelledby={`catalog-${group.id}`}>
          <h2 id={`catalog-${group.id}`} className="mb-3 text-base font-semibold">
            {group.title}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {group.items.map(({ type, blurb, Icon }) => (
              <li key={type}>
                <Link
                  href={TYPE_ROUTES[type]}
                  className="group flex h-full gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-[hsl(var(--primary)/0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon className="h-16 w-20 shrink-0 text-foreground/70" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-semibold text-foreground group-hover:text-[hsl(var(--primary))]">
                      {TYPE_LABELS[type]}
                      {isFavoriteRequest(type) && (
                        <Heart className="h-3.5 w-3.5 fill-current text-[hsl(var(--primary))]" aria-label="Favourite" />
                      )}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">{blurb}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        ))}

        <section aria-labelledby="my-requests">
          <h2 id="my-requests" className="mb-3 text-base font-semibold">
            My Requests
          </h2>
          {list.isError && (
            <Callout tone="bad" title="Your requests couldn't be loaded">
              {list.error instanceof Error ? list.error.message : "Unknown error"}
            </Callout>
          )}
          {list.isLoading ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : requests.length === 0 ? (
            <Panel id="requests-empty" flush>
              <EmptyState
                icon={ClipboardList}
                title="No requests yet"
                description="Requests you make, and requests someone makes for you, appear here with their status."
              />
            </Panel>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <table className="w-full text-sm">
                <caption className="sr-only">Requests made by you or for you</caption>
                <thead className="hidden border-b border-border bg-muted/50 text-left text-xs uppercase tracking-[0.06em] text-muted-foreground md:table-header-group">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">Number</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Request</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Requested for</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Submitted</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {requests.map((r) => (
                    <tr key={r.id} className="block px-4 py-3 md:table-row md:p-0" data-testid={`request-row-${r.number}`}>
                      <td className="block md:table-cell md:px-4 md:py-3">
                        <Link href={`/portal/requests/${r.id}`} className="pt-num font-semibold text-[hsl(var(--primary))] hover:underline">
                          {r.number}
                        </Link>
                      </td>
                      <td className="block md:table-cell md:px-4 md:py-3">{TYPE_LABELS[r.type]}</td>
                      <td className="block text-muted-foreground md:table-cell md:px-4 md:py-3 md:text-foreground">
                        <span className="md:hidden">For </span>
                        {r.requestedFor.name}
                      </td>
                      <td className="block text-muted-foreground md:table-cell md:px-4 md:py-3">
                        {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="mt-1 block md:mt-0 md:table-cell md:px-4 md:py-3">
                        <RequestStatusToken status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </PortalLayout>
  );
}
