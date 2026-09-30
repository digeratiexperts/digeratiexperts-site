import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PortalLayout } from "./PortalLayout";
import { AlertCircle, CheckCircle2, Clock, Ticket, Package, FileText, TrendingUp, ArrowRight, ExternalLink, DoorOpen } from "lucide-react";
import { Link } from "wouter";
import { portalGet } from "@/lib/portalApi";
import { readPortalUser } from "@/lib/portalRoles";

/** Light Quick Actions: navy type on white, magenta fill so hover white type has contrast. */
const quickActionClass =
  "w-full border-[#D3126A]/40 bg-white text-[#1A1228] hover:bg-[#D3126A] hover:border-[#D3126A] hover:text-white dark:bg-transparent dark:text-white dark:hover:bg-[#D3126A] dark:hover:text-white";

interface DashboardStats {
  openTickets: number;
  resolvedTickets: number;
  activeServices: number;
  pendingInvoices: number;
  recentTickets: any[];
  services: any[];
}

export default function PortalDashboard() {
  const portalUser = readPortalUser();
  const isAdmin = portalUser?.role === "admin";
  const { data: stats, isLoading, isError, error } = useQuery<DashboardStats>({
    queryKey: ["/api/portal/dashboard"],
    queryFn: () => portalGet<DashboardStats>("/api/portal/dashboard"),
  });
  const { data: knocks } = useQuery<{
    summary: { total: number; failed: number; bots: number; pageHits: number; success: number };
  }>({
    queryKey: ["/api/portal/admin/login-knocks", 24],
    queryFn: () => portalGet("/api/portal/admin/login-knocks?hours=24"),
    enabled: isAdmin,
    refetchInterval: 60_000,
  });

  return (
    <PortalLayout title="Dashboard">
      <div className="space-y-6">
        {isAdmin && knocks?.summary && (
          <Card className="border-amber-200/80 dark:border-amber-900/40">
            <CardContent className="pt-4 pb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <DoorOpen className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Login door (24h)</p>
                  <p className="text-sm text-muted-foreground">
                    {knocks.summary.total} knocks · {knocks.summary.failed} failed · {knocks.summary.bots} bot-likely ·{" "}
                    {knocks.summary.success} success
                  </p>
                </div>
              </div>
              <Link href="/portal/admin/login-knocks">
                <Button size="sm" variant="outline">
                  Open alerts
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
        {/* Error State */}
        {isError && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-300">
              Failed to load dashboard: {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Open Tickets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                <span className="text-2xl font-bold" data-testid="stat-open-tickets">
                  {stats?.openTickets || 0}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Resolved Tickets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold" data-testid="stat-resolved-tickets">
                  {stats?.resolvedTickets || 0}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Active Services
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold" data-testid="stat-active-services">
                  {stats?.activeServices || 0}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Pending Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-red-500" />
                <span className="text-2xl font-bold" data-testid="stat-pending-invoices">
                  {stats?.pendingInvoices || 0}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Tickets */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Support Tickets</CardTitle>
                  <CardDescription>Your latest ticket activity</CardDescription>
                </div>
                <Link href="/portal/tickets" className="text-[#D3126A] hover:underline text-sm font-medium">
                  View All
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-200 dark:bg-slate-800 rounded animate-pulse" />
                  ))}
                </div>
              ) : stats?.recentTickets && stats.recentTickets.length > 0 ? (
                <div className="space-y-3">
                  {stats.recentTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="flex items-center justify-between p-3 border rounded-lg dark:border-slate-700"
                      data-testid={`ticket-${ticket.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                          {ticket.subject}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {ticket.ticketNumber}
                        </p>
                      </div>
                      <Badge
                        className={
                          ticket.status === "open"
                            ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30"
                            : "bg-green-100 text-green-800 dark:bg-green-900/30"
                        }
                      >
                        {ticket.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                  No recent tickets
                </p>
              )}
            </CardContent>
          </Card>

          {/* Active Services */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Your Services</CardTitle>
                  <CardDescription>Currently active services</CardDescription>
                </div>
                <Link href="/portal/services" className="text-[#D3126A] hover:underline text-sm font-medium">
                  View All
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-200 dark:bg-slate-800 rounded animate-pulse" />
                  ))}
                </div>
              ) : stats?.services && stats.services.length > 0 ? (
                <div className="space-y-3">
                  {stats.services.map((service) => (
                    <div
                      key={service.id}
                      className="flex items-center justify-between p-3 border rounded-lg dark:border-slate-700"
                      data-testid={`service-${service.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                          {service.serviceName}
                        </p>
                        {service.amount && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            ${service.amount}/mo
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30">
                          {service.status || "Active"}
                        </Badge>
                        {service.zohoLink && (
                          <a
                            href={service.zohoLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#D3126A] hover:text-[#1A1228] p-1"
                            title="View in Zoho"
                            data-testid={`link-zoho-${service.id}`}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                  No active services
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="border-[#D3126A]/20 bg-gradient-to-r from-[#D3126A]/10 to-blue-500/10 text-[#1A1228] dark:text-white">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button asChild variant="outline" className={quickActionClass}>
                <Link href="/portal/tickets?new=true" data-testid="button-new-ticket">
                  <Ticket className="h-4 w-4 mr-2" aria-hidden="true" />
                  Create Ticket
                </Link>
              </Button>
              <Button asChild variant="outline" className={quickActionClass}>
                <Link href="/portal/kb" data-testid="button-view-kb">
                  <FileText className="h-4 w-4 mr-2" aria-hidden="true" />
                  Browse KB
                </Link>
              </Button>
              <Button asChild variant="outline" className={quickActionClass}>
                <Link href="/portal/invoices" data-testid="button-view-invoices">
                  <FileText className="h-4 w-4 mr-2" aria-hidden="true" />
                  View Invoices
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
