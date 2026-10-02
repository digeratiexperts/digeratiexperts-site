import { ExternalLink, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortalLayout } from "./PortalLayout";
import { Callout, DataTable, EmptyState, Panel, Token, type DataColumn } from "@/components/portal/ui";

interface Distributor {
  name: string;
  url: string;
  description: string;
  categories: string[];
  logo: string;
  featured: boolean;
}

interface InternalProduct {
  id: string;
  name: string;
  description: string;
  price: string;
  category: string;
}

export default function PortalProcurementStore() {
  const distributors: Distributor[] = [
    {
      name: "Griffin IT",
      url: "https://shop.griffin-it.com/",
      description: "Comprehensive IT solutions and equipment distributor",
      categories: ["Hardware", "Software", "Networking"],
      logo: "🏢",
      featured: true,
    },
    {
      name: "Sherweb",
      url: "https://www.sherweb.com/",
      description: "Cloud solutions and Microsoft partner services",
      categories: ["Cloud Services", "Microsoft Products", "Licensing"],
      logo: "☁️",
      featured: true,
    },
    {
      name: "Pax8",
      url: "https://www.pax8.com/",
      description: "Cloud marketplace for IT service providers",
      categories: ["Cloud Products", "Security", "Management"],
      logo: "🛡️",
      featured: true,
    },
    {
      name: "ClimbCS",
      url: "https://www.climbcs.com/",
      description: "Managed services and IT solutions partner",
      categories: ["Managed Services", "Support", "Solutions"],
      logo: "🚀",
      featured: true,
    },
  ];

  const internalProducts: InternalProduct[] = [
    {
      id: "INT-001",
      name: "Premium Support Package",
      description: "24/7 managed IT support and monitoring",
      price: "$299/month",
      category: "Services",
    },
    {
      id: "INT-002",
      name: "Security Audit Service",
      description: "Comprehensive security assessment and reporting",
      price: "$1,999",
      category: "Consulting",
    },
    {
      id: "INT-003",
      name: "Disaster Recovery Plan",
      description: "Full DR setup and testing included",
      price: "$2,499",
      category: "Services",
    },
    {
      id: "INT-004",
      name: "Compliance Training",
      description: "Employee security and compliance training",
      price: "$799",
      category: "Training",
    },
  ];

  const productColumns: DataColumn<InternalProduct>[] = [
    {
      key: "name",
      header: "Product",
      primary: true,
      cell: (p) => (
        <div className="min-w-0">
          <p className="font-medium">{p.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
        </div>
      ),
    },
    { key: "category", header: "Category", primary: true, className: "w-32", cell: (p) => <Token label={p.category} tone="neutral" /> },
    { key: "price", header: "Price", primary: true, align: "right", className: "w-32 whitespace-nowrap", cell: (p) => <span className="pt-num font-medium">{p.price}</span> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      primary: true,
      align: "right",
      className: "w-24",
      cell: (p) => (
        <Button variant="brand" size="sm" data-testid={`button-add-${p.id}`}>
          <ShoppingCart aria-hidden="true" />
          Add
        </Button>
      ),
    },
  ];

  const distributorColumns: DataColumn<Distributor>[] = [
    {
      key: "name",
      header: "Distributor",
      primary: true,
      cell: (d) => (
        <div className="flex min-w-0 items-start gap-3">
          <span className="text-xl leading-none" aria-hidden="true">
            {d.logo}
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {d.name}
              {d.featured && <Token label="Featured" tone="brand" />}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{d.description}</p>
          </div>
        </div>
      ),
    },
    {
      key: "categories",
      header: "Categories",
      hideBelowMd: true,
      cell: (d) => (
        <span className="flex flex-wrap gap-1.5">
          {d.categories.map((category) => (
            <Token key={category} label={category} tone="neutral" className="normal-case tracking-normal" />
          ))}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      primary: true,
      align: "right",
      className: "w-36",
      cell: (d) => (
        <Button
          variant="outline"
          size="sm"
          className="border-border bg-card hover:bg-accent"
          onClick={() => window.open(d.url, "_blank")}
          data-testid={`button-visit-${d.name.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <ExternalLink aria-hidden="true" />
          Visit Store
        </Button>
      ),
    },
  ];

  return (
    <PortalLayout title="Procurement Store" description="Digerati Experts services and the partner distributors we buy through." width="wide">
      <div className="space-y-4">
        <section data-testid="section-internal-products">
          <Panel id="internal-products" title="Digerati Experts products & services" description="Our exclusive managed services and solutions" flush>
            <DataTable<InternalProduct>
              columns={productColumns}
              rows={internalProducts}
              rowKey={(p) => p.id}
              rowTestId={(p) => `card-product-${p.id}`}
              caption="Digerati Experts products and services"
              empty={<EmptyState compact icon={ShoppingCart} title="No products listed" description="DE services appear here when they are published." />}
            />
          </Panel>
        </section>

        <section data-testid="section-partner-distributors">
          <Panel id="partner-distributors" title="Partner distributors" description="Access products and services from our trusted partners" flush>
            <DataTable<Distributor>
              columns={distributorColumns}
              rows={distributors}
              rowKey={(d) => d.name}
              rowTestId={(d) => `card-distributor-${d.name.toLowerCase()}`}
              caption="Partner distributors"
              empty={<EmptyState compact icon={ExternalLink} title="No distributors listed" description="Partner stores appear here when they are added." />}
            />
          </Panel>
        </section>

        <Callout tone="info" title="Procurement support">
          Need help finding the right product or service? Contact our procurement team at{" "}
          <strong className="text-foreground">procurement@digeratiexperts.com</strong> or use the support chat.
        </Callout>
      </div>
    </PortalLayout>
  );
}
