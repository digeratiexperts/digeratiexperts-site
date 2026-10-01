import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Calendar, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PortalLayout } from "./PortalLayout";
import { portalGet } from "@/lib/portalApi";
import { Callout, EmptyState, GenericStatus, Panel } from "@/components/portal/ui";

interface Service {
  id: string;
  serviceName: string;
  description: string;
  status: string;
  monthlyPrice: string;
  userCount?: number;
  startDate: string;
}

export default function PortalServices() {
  const { data: services = [], isLoading, isError, error } = useQuery<Service[]>({
    queryKey: ["/api/portal/services"],
    queryFn: () => portalGet<Service[]>("/api/portal/services"),
  });

  return (
    <PortalLayout title="My Services" description="The services and subscriptions DE currently runs for you." width="wide">
      <div className="space-y-4">
        {isError && (
          <Callout tone="bad" title="Services couldn't be loaded">
            {error instanceof Error ? error.message : "Unknown error"}
          </Callout>
        )}

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-live="polite">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : services.length > 0 ? (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Your services">
            {services.map((service) => (
              <li key={service.id} className="min-w-0" data-testid={`service-card-${service.id}`}>
                <Panel
                  as="article"
                  id={`service-${service.id}`}
                  title={service.serviceName}
                  description={service.description}
                  actions={<GenericStatus status={service.status} />}
                  className="h-full"
                >
                  <dl className="grid grid-cols-2 gap-4">
                    {service.monthlyPrice && (
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Monthly price</dt>
                        <dd className="pt-num mt-1 text-lg font-semibold" data-testid={`price-${service.id}`}>
                          ${parseFloat(service.monthlyPrice).toFixed(2)}
                        </dd>
                      </div>
                    )}
                    {service.userCount ? (
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Users</dt>
                        <dd className="pt-num mt-1 text-lg font-semibold" data-testid={`users-${service.id}`}>
                          {service.userCount}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  <p className="mt-4 flex items-center gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      Started <span className="pt-num">{new Date(service.startDate).toLocaleDateString()}</span>
                    </span>
                  </p>
                </Panel>
              </li>
            ))}
          </ul>
        ) : (
          <Panel id="services-empty" flush>
            <EmptyState
              icon={Package}
              title="No active services on file"
              description="When your Zoho Billing subscriptions are linked, they will appear here. Contact your DE account team if something is missing."
              action={
                <Button asChild variant="outline" size="sm" className="border-border bg-card hover:bg-accent">
                  <Link href="/portal/tickets/create">Contact your account team</Link>
                </Button>
              }
            />
          </Panel>
        )}
      </div>
    </PortalLayout>
  );
}
