import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PortalLayout } from "./PortalLayout";
import { Plus, Search, MessageSquare, Clock } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { portalGet } from "@/lib/portalApi";
import { formatDeskTimestamp } from "@/lib/deskTimestamp";

interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  companyName?: string;
  isInternal?: boolean;
}

interface TicketsResponse {
  tickets: Ticket[];
}

export default function PortalTickets() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "true") {
      navigate("/portal/tickets/create");
    }
  }, [navigate]);

  const { data, isLoading, isError, error } = useQuery<TicketsResponse>({
    queryKey: ["/api/portal/tickets"],
    queryFn: () => portalGet<TicketsResponse>("/api/portal/tickets"),
  });
  
  const tickets = data?.tickets || [];

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      ticket.subject.toLowerCase().includes(search.toLowerCase()) ||
      ticket.ticketNumber.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || ticket.status === filter;
    return matchesSearch && matchesFilter;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-100 text-red-800 dark:bg-red-900/30";
      case "high":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30";
    }
  };

  return (
    <PortalLayout title="Support Tickets">
      <div className="space-y-6">
        {/* Error State */}
        {isError && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-300">
              Failed to load tickets: {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">Support Tickets</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your support requests and track resolutions
            </p>
          </div>
          <Link href="/portal/tickets/create">
            <Button
              className="bg-[#D3126A] hover:bg-[#D3126A]/90 text-white"
              data-testid="button-create-ticket"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Ticket
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by subject or ticket number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          <div className="flex gap-2">
            {["all", "open", "in_progress", "pending_client", "resolved", "closed"].map(
              (status) => (
                <Button
                  key={status}
                  variant={filter === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(status)}
                  className={filter === status ? "bg-[#D3126A] hover:bg-[#D3126A]/90" : ""}
                  data-testid={`button-filter-${status}`}
                >
                  {status === "all" ? "All" : status.replace(/_/g, " ")}
                </Button>
              )
            )}
          </div>
        </div>

        {/* Tickets List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Tickets</CardTitle>
            <CardDescription>
              {filteredTickets.length} ticket{filteredTickets.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-16 bg-gray-200 dark:bg-slate-800 rounded animate-pulse"
                  />
                ))}
              </div>
            ) : filteredTickets.length > 0 ? (
              <div className="space-y-3">
                {filteredTickets.map((ticket) => (
                  <Link key={ticket.id} href={`/portal/tickets/${ticket.id}`}>
                    <a
                      className="flex items-center justify-between p-4 border rounded-lg dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer block"
                      data-testid={`ticket-row-${ticket.id}`}
                    >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {ticket.subject}
                        </p>
                        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded">
                          {ticket.ticketNumber}
                        </span>
                        {ticket.isInternal && (
                          <span className="text-xs text-[#D3126A] bg-[#D3126A]/10 px-2 py-1 rounded">
                            Internal
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDeskTimestamp(ticket.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Badge className={getPriorityColor(ticket.priority)}>
                        {ticket.priority}
                      </Badge>
                      <Badge
                        className={
                          ticket.status === "closed"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30"
                            : ticket.status === "resolved"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30"
                            : "bg-orange-100 text-orange-800 dark:bg-orange-900/30"
                        }
                      >
                        {ticket.status}
                      </Badge>
                    </div>
                    </a>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <MessageSquare className="h-12 w-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No tickets found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
