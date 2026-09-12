import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ClipboardCheck, ShoppingCart, Warehouse } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PortalLayout } from "./PortalLayout";
import { portalGet } from "@/lib/portalApi";
import { MARKETPLACE_ELIGIBILITY } from "@shared/checkoutEligibility";

type MarketplaceResponse = {
  eligibility: typeof MARKETPLACE_ELIGIBILITY;
  items: unknown[];
  status: "unavailable" | "unmapped" | "staff";
  reason: string;
  warehouseUrl?: string;
};

export default function PortalMarketplace() {
  const { data, isLoading, isError } = useQuery<MarketplaceResponse>({
    queryKey: ["/api/portal/marketplace"],
    queryFn: () => portalGet<MarketplaceResponse>("/api/portal/marketplace"),
  });

  const isStaff = data?.status === "staff";

  return (
    <PortalLayout title="Client Marketplace">
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">Client Marketplace</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Standardized items for your organization. Pay Now is not available until Hub
            entitlements exist.
          </p>
        </div>

        {isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-300">
            Marketplace is temporarily unavailable. Request approval below or contact DE.
          </div>
        )}

        {isStaff ? (
          <Card data-testid="marketplace-staff">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Warehouse className="h-5 w-5 text-[#D3126A]" />
                DE Staff — Digital Warehouse
              </CardTitle>
              <CardDescription>
                You are signed in as DE staff. This page is the client view — no approval
                request is needed for your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                The full catalog with vendors, costs, and Pay Now lives in the staff-only
                Digital Warehouse.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="bg-[#D3126A] text-white hover:bg-[#D3126A]/90">
                  <Link href={data?.warehouseUrl || "/internal/warehouse"}>
                    <Warehouse className="mr-2 h-4 w-4" />
                    Open Digital Warehouse
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/portal/procurement">Open procurement</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card data-testid="marketplace-empty">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-[#D3126A]" />
                Request Approval
              </CardTitle>
              <CardDescription>
                {isLoading
                  ? "Checking your tenant catalog…"
                  : data?.reason || "Tenant catalog is not available from Hub yet."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Eligibility for this surface is <code>{data?.eligibility || MARKETPLACE_ELIGIBILITY}</code>.
                No warehouse SKUs, vendors, costs, or margins are listed here.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="bg-[#D3126A] text-white hover:bg-[#D3126A]/90">
                  <Link href="/portal/forms">
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    Request Approval
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/portal/procurement">Open procurement</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}
