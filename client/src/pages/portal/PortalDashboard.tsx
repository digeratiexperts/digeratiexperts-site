import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PortalLayout } from "./PortalLayout";
import { AlertCircle, CheckCircle2, Clock, Ticket, Package, FileText, TrendingUp, ArrowRight, DoorOpen } from "lucide-react";
import { Link } from "wouter";
import { portalGet } from "@/lib/portalApi";
import { canViewClientWide, readPortalUser } from "@/lib/portalRoles";

interface DashboardStats {
  openTickets: number;
  resolvedTickets: number;
  activeServices?: number;
  pendingInvoices?: number;
  recentTickets: any[];
  services?: any[];
}

export default function PortalDashboard() {
  const portalUser = readPortalUser();
  const isAdmin = portalUser?.role === "admin";
  const clientWide = canViewClientWide(portalUser);
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
              <Button asChild size="sm" variant="outline">
                <Link href="/portal/admin/login-knocks">
                  Open alerts
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
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
        <div className={`grid grid-cols-2 gap-3 lg:gap-4 ${clientWide ? "lg:grid-cols-4" : "lg:grid-cols-2"}`}>
          <Card>
            <CardHeader className="p-4 pb-1.5 lg:p-6 lg:pb-3">
              <CardTitle className="text-xs font-medium text-gray-600 dark:text-gray-400 sm:text-sm">
                Open Tickets
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 lg:px-6 lg:pb-6">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                <span className="text-2xl font-bold" data-testid="stat-open-tickets">
                  {stats?.openTickets || 0}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-1.5 lg:p-6 lg:pb-3">
              <CardTitle className="text-xs font-medium text-gray-600 dark:text-gray-400 sm:text-sm">
                Resolved Tickets
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 lg:px-6 lg:pb-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold" data-testid="stat-resolved-tickets">
                  {stats?.resolvedTickets || 0}
                </span>
              </div>
            </CardContent>
          </Card>

          {clientWide && <>
          <Card>
            <CardHeader className="p-4 pb-1.5 lg:p-6 lg:pb-3">
              <CardTitle className="text-xs font-medium text-gray-600 dark:text-gray-400 sm:text-sm">
                Active Services
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 lg:px-6 lg:pb-6">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold" data-testid="stat-active-services">
                  {stats?.activeServices || 0}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-1.5 lg:p-6 lg:pb-3">
              <CardTitle className="text-xs font-medium text-gray-600 dark:text-gray-400 sm:text-sm">
                Pending Invoices
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 lg:px-6 lg:pb-6">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-red-500" />
                <span className="text-2xl font-bold" data-testid="stat-pending-invoices">
                  {stats?.pendingInvoices || 0}
                </span>
              </div>
            </CardContent>
          </Card>
          </>}
        </div>

        <div className={`grid grid-cols-1 gap-6 ${clientWide ? "lg:grid-cols-2" : ""}`}>
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
          {clientWide && <Card>
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
          </Card>}
        </div>

        {/* Quick Actions */}
        <Card className="bg-gradient-to-r from-[#D3126A]/10 to-blue-500/10 border-[#D3126A]/20">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`grid grid-cols-1 gap-4 ${clientWide ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
              <Button
                asChild
                variant="outline"
                className="w-full border-[#D3126A]/30 hover:bg-[#D3126A]/10 text-gray-900 dark:text-white hover:text-gray-900 dark:hover:text-white"
              >
                <Link href="/portal/tickets/create" data-testid="button-new-ticket">
                    <Ticket className="h-4 w-4 mr-2" />
                    Create Ticket
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full border-[#D3126A]/30 hover:bg-[#D3126A]/10 text-gray-900 dark:text-white hover:text-gray-900 dark:hover:text-white"
              >
                <Link href="/portal/kb" data-testid="button-view-kb">
                    <FileText className="h-4 w-4 mr-2" />
                    Browse KB
                </Link>
              </Button>
              {clientWide && <Button
                asChild
                variant="outline"
                className="w-full border-[#D3126A]/30 hover:bg-[#D3126A]/10 text-gray-900 dark:text-white hover:text-gray-900 dark:hover:text-white"
              >
                <Link href="/portal/invoices" data-testid="button-view-invoices">
                    <FileText className="h-4 w-4 mr-2" />
                    View Invoices
                </Link>
              </Button>}
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
