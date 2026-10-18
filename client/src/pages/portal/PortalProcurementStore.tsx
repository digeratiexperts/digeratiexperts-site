import { Link } from "wouter";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortalLayout } from "./PortalLayout";
import { Panel } from "@/components/portal/ui";

export default function PortalProcurementStore() {
  return <PortalLayout title="Procurement Store" description="Find products and services available through Digerati Experts.">
    <Panel id="procurement-marketplace" title="Shop the marketplace" description="Browse the current catalog and continue through the existing cart and approval process.">
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="brand"><Link href="/portal/marketplace"><ShoppingCart aria-hidden="true" /> Open marketplace</Link></Button>
        <Button asChild variant="outline"><Link href="/portal/tickets/create">Ask for procurement help</Link></Button>
      </div>
    </Panel>
  </PortalLayout>;
}
