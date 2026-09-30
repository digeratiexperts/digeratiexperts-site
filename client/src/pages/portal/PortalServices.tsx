import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PortalLayout } from "./PortalLayout";
import { Package, Users, DollarSign, Calendar } from "lucide-react";
import { portalGet } from "@/lib/portalApi";

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
    <PortalLayout title="My Services">
      <div className="space-y-6">
        {/* Error State */}
        {isError && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-300">
              Failed to load services: {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        )}

        {/* Header */}
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">My Services</h2>
          <p className="text-gray-600 dark:text-gray-400">
            View and manage your active services
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <>
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-64 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse"
                />
              ))}
            </>
          ) : services.length > 0 ? (
            services.map((service) => (
              <Card key={service.id} data-testid={`service-card-${service.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-[#D3126A]" />
                        {service.serviceName}
                      </CardTitle>
                      <CardDescription>{service.description}</CardDescription>
                    </div>
                    <Badge
                      className={
                        service.status === "active"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-900/30"
                      }
                    >
                      {service.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {service.monthlyPrice && (
                      <div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                          <DollarSign className="h-4 w-4" />
                          <span>Monthly Price</span>
                        </div>
                        <p className="font-semibold text-lg" data-testid={`price-${service.id}`}>
                          ${parseFloat(service.monthlyPrice).toFixed(2)}
                        </p>
                      </div>
                    )}
                    {service.userCount && (
                      <div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                          <Users className="h-4 w-4" />
                          <span>Users</span>
                        </div>
                        <p className="font-semibold text-lg" data-testid={`users-${service.id}`}>
                          {service.userCount}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t dark:border-slate-700">
                    <Calendar className="h-3 w-3" />
                    <span>
                      Started {new Date(service.startDate).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full py-12 text-center">
              <Package className="h-12 w-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No active services on file</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
                When your Zoho Billing subscriptions are linked, they will appear here. Contact your DE account team if something is missing.
              </p>
            </div>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
