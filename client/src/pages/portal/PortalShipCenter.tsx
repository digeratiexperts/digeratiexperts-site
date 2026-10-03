import { Package, Truck } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PortalLayout } from "./PortalLayout";
import { Callout, DataTable, EmptyState, Panel, StatTile, Token, type DataColumn, type TokenTone } from "@/components/portal/ui";

interface Shipment {
  id: string;
  status: string;
  date: string;
  items: number;
  tracking: string;
}

function shipmentTone(status: string): TokenTone {
  switch (status) {
    case "Delivered":
      return "ok";
    case "In Transit":
      return "info";
    case "Processing":
      return "warn";
    default:
      return "neutral";
  }
}

export default function PortalShipCenter() {
  const shipmentHistory: Shipment[] = [
    { id: "SHIP-001", status: "Delivered", date: "Nov 20, 2024", items: 3, tracking: "1Z999AA10123456784" },
    { id: "SHIP-002", status: "In Transit", date: "Nov 18, 2024", items: 5, tracking: "1Z999AA10123456785" },
    { id: "SHIP-003", status: "Processing", date: "Nov 15, 2024", items: 2, tracking: "1Z999AA10123456786" },
  ];

  const columns: DataColumn<Shipment>[] = [
    {
      key: "id",
      header: "Shipment",
      primary: true,
      cell: (s) => (
        <span className="flex items-center gap-3">
          <Truck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0">
            <span className="pt-num block font-medium">{s.id}</span>
            <span className="pt-num block text-xs text-muted-foreground">{s.tracking}</span>
          </span>
        </span>
      ),
    },
    { key: "date", header: "Date", primary: true, hideBelowMd: true, className: "w-36 whitespace-nowrap", cell: (s) => <span className="pt-num text-muted-foreground">{s.date}</span> },
    { key: "items", header: "Items", align: "right", className: "w-20", cell: (s) => <span className="pt-num">{s.items}</span> },
    { key: "status", header: "Status", primary: true, className: "w-36", cell: (s) => <Token label={s.status} tone={shipmentTone(s.status)} dot /> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      primary: true,
      align: "right",
      className: "w-28",
      cell: (s) => (
        <Button variant="outline" disabled size="sm" className="border-border bg-card hover:bg-accent" data-testid={`button-track-${s.id}`}>
          Track
        </Button>
      ),
    },
  ];

  return (
    <PortalLayout title="Ship Center" description="Preview shipment tracking and contact DE for help with a shipment.">
      <div className="space-y-4">
        <Callout tone="info" title="Sample data">
          The shipments, tracking numbers and figures shown here are examples, not your shipments. DE staff will enter tracking numbers for real shipments. Live carrier tracking, rates and labels are not connected yet.
        </Callout>

        <section className="grid grid-cols-2 gap-3" aria-label="Shipment figures">
          <div data-testid="card-active-shipments">
            <StatTile label="Active shipments" value={2} hint="sample" tone="info" />
          </div>
          <div data-testid="card-total-shipments">
            <StatTile label="Total shipments" value={47} hint="sample" />
          </div>
        </section>

        <div data-testid="card-shipment-history">
          <Panel id="shipment-history" title="Example shipment history" description="Sample records; tracking actions are unavailable until real shipments are connected." flush>
            <DataTable<Shipment>
              columns={columns}
              rows={shipmentHistory}
              rowKey={(s) => s.id}
              rowTestId={(s) => `row-shipment-${s.id}`}
              caption="Shipment history"
              empty={<EmptyState compact icon={Truck} title="No shipments yet" description="Shipments appear here once they are scheduled." />}
            />
          </Panel>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div data-testid="card-create-shipment">
            <Panel id="create-shipment" title="Create new shipment" description="Contact DE to arrange a shipment. Online shipment creation is not connected." className="h-full">
              <Button variant="brand" disabled className="w-full" data-testid="button-create-shipment">
                <Package aria-hidden="true" />
                New Shipment
              </Button>
            </Panel>
          </div>
          <div data-testid="card-contact-logistics">
            <Panel id="logistics-support" title="Logistics support" description="Need help with your shipment?" className="h-full">
              <Button asChild variant="outline" className="w-full border-border bg-card hover:bg-accent" data-testid="button-contact-logistics">
                <Link href="/portal/tickets">Contact Support</Link>
              </Button>
            </Panel>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
