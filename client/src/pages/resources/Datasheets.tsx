import { useState } from "react";
import { Link } from "wouter";
import { PageTemplate } from "@/components/PageTemplate";
import { ConversionPathBar } from "@/components/ConversionPathBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileText, ExternalLink, Shield, Server, Cloud, Users, Lock, BarChart } from "lucide-react";
import { resources as registryResources } from "@/data/resourceRegistry";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";

interface Document {
  id: number;
  title: string;
  description: string;
  category: string;
  type: "datasheet" | "whitepaper" | "guide" | "infographic";
  pages?: number;
  fileSize?: string;
  icon: any;
  downloadUrl?: string;
}

/** Map page card titles to registry resource titles when a close match exists */
const TITLE_TO_REGISTRY: Record<string, string[]> = {
  "Managed IT Support Services": ["Managed Workplace Overview", "ProActive IT Ecosystem Datasheet"],
  "Cybersecurity Solutions": ["ProActive IT & Security Ecosystem Overview"],
  "Cloud Backup & Disaster Recovery": [],
  "HIPAA Compliance Guide": [],
  "Security Awareness Training Program": [],
  "Cost of a Data Breach": [],
  "Zero Trust Security Framework": [],
  "Ransomware Defense Infographic": [],
  "Co-Managed IT Services": ["Co-Managed IT Datasheet"],
  "Compliance Requirements by Industry": ["Compliance & Risk Reports Overview"],
  "vCIO Strategic Planning": [],
  "Endpoint Detection & Response": [],
};

/** Registry lists draft PDF paths. Only expose Download when the file is actually shipped. */
const SHIPPED_DATASHEET_FILES = new Set<string>();

function resolveDownloadUrl(title: string): string | undefined {
  const candidates = TITLE_TO_REGISTRY[title] ?? [];
  for (const candidate of candidates) {
    const match = registryResources.find(
      (r) => r.title.toLowerCase() === candidate.toLowerCase()
    );
    if (match?.file && SHIPPED_DATASHEET_FILES.has(match.file)) return match.file;
  }
  const exact = registryResources.find(
    (r) => r.title.toLowerCase() === title.toLowerCase()
  );
  if (exact?.file && SHIPPED_DATASHEET_FILES.has(exact.file)) return exact.file;
  return undefined;
}

const documents: Document[] = ([
  {
    id: 1,
    title: "Managed IT Support Services",
    description: "Comprehensive overview of our managed IT support offerings, SLAs, and service levels.",
    category: "Services",
    type: "datasheet",
    pages: 4,
    icon: Server,
  },
  {
    id: 2,
    title: "Cybersecurity Solutions",
    description: "Details on our multi-layered security approach including EDR, SIEM, and SOC services.",
    category: "Security",
    type: "datasheet",
    pages: 6,
    icon: Shield,
  },
  {
    id: 3,
    title: "Cloud Backup & Disaster Recovery",
    description: "Technical specifications and pricing for our backup and DR solutions.",
    category: "Backup",
    type: "datasheet",
    pages: 4,
    icon: Cloud,
  },
  {
    id: 4,
    title: "HIPAA Compliance Guide",
    description: "Step-by-step guide to achieving and maintaining HIPAA compliance for healthcare providers.",
    category: "Compliance",
    type: "guide",
    pages: 24,
    icon: Lock,
  },
  {
    id: 5,
    title: "Security Awareness Training Program",
    description: "Overview of our employee security training platform and curriculum.",
    category: "Training",
    type: "datasheet",
    pages: 3,
    icon: Users,
  },
  {
    id: 6,
    title: "Cost of a Data Breach",
    description: "Analysis of breach costs and ROI of preventive security measures for SMBs.",
    category: "Research",
    type: "whitepaper",
    pages: 12,
    icon: BarChart,
  },
  {
    id: 7,
    title: "Zero Trust Security Framework",
    description: "Understanding and implementing Zero Trust architecture for your organization.",
    category: "Security",
    type: "whitepaper",
    pages: 18,
    icon: Shield,
  },
  {
    id: 8,
    title: "Ransomware Defense Infographic",
    description: "Visual guide to ransomware attack vectors and prevention strategies.",
    category: "Security",
    type: "infographic",
    icon: FileText,
  },
  {
    id: 9,
    title: "Co-Managed IT Services",
    description: "How our co-managed IT model works alongside your internal team.",
    category: "Services",
    type: "datasheet",
    pages: 4,
    icon: Users,
  },
  {
    id: 10,
    title: "Compliance Requirements by Industry",
    description: "Overview of PCI DSS, HIPAA, SOX, and other compliance frameworks.",
    category: "Compliance",
    type: "guide",
    pages: 16,
    icon: Lock,
  },
  {
    id: 11,
    title: "vCIO Strategic Planning",
    description: "How our virtual CIO services help align IT with business objectives.",
    category: "Services",
    type: "datasheet",
    pages: 5,
    icon: BarChart,
  },
  {
    id: 12,
    title: "Endpoint Detection & Response",
    description: "Technical deep-dive into our EDR solution and threat response capabilities.",
    category: "Security",
    type: "datasheet",
    pages: 6,
    icon: Shield,
  },
] satisfies Document[]).map((doc): Document => ({
  ...doc,
  downloadUrl: resolveDownloadUrl(doc.title),
}));

const categories = ["All", "Services", "Security", "Backup", "Compliance", "Training", "Research"];

const getTypeColor = (_type: string) =>
  "border border-de-hairline bg-de-bg text-de-accent-ink";

export default function Datasheets() {
  const [activeCategory, setActiveCategory] = useState("All");
  const visibleDocuments = documents.filter(
    (d) => activeCategory === "All" || d.category === activeCategory,
  );
  const downloadableCount = documents.filter((d) => d.downloadUrl).length;

  useSEO({
    title: "Datasheets & Documentation",
    description:
      "Digerati Experts service datasheets and documentation. Request the latest version — PDFs are sent when a current file is available.",
    canonical: "/resources/datasheets",
  });

  return (
    <PageTemplate
      title="Datasheets & Documentation"
      subtitle={
        downloadableCount > 0
          ? `Browse our service documentation. ${downloadableCount} documents are available for immediate PDF download; others can be requested and we'll send the latest version.`
          : "Browse our service documentation. Request a document and we'll send the current version — PDFs are not hosted for automatic download yet."
      }
      icon={<FileText className="h-10 w-10 text-de-accent-ink" />}
      breadcrumbs={[{ label: "Resources", href: "/resources" }, { label: "Datasheets" }]}
      actions={
        <Button asChild variant="brand" size="lg" className="h-12 px-6 font-semibold">
          <Link href="/book">{CTA.primary}</Link>
        </Button>
      }
    >
      <div className="space-y-12">
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((category) => (
              <Button
                key={category}
                variant="outline"
                size="sm"
                className={
                  activeCategory === category
                    ? "border-[#D3126A] bg-de-raised text-white"
                    : "border-de-hairline bg-transparent text-white/70 hover:border-de-hairline hover:bg-de-raised hover:text-white"
                }
                aria-pressed={activeCategory === category}
                data-testid={`button-filter-${category.toLowerCase()}`}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {visibleDocuments.map((doc) => (
              <article key={doc.id} className="rounded-2xl border border-de-hairline bg-de-raised p-6" data-testid={`card-document-${doc.id}`}>
                <div className="mb-2 flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-de-hairline bg-de-bg">
                      <doc.icon className="h-6 w-6 text-de-accent-ink" aria-hidden="true" />
                    </div>
                    <Badge className={getTypeColor(doc.type)}>
                      {doc.type}
                    </Badge>
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-white">{doc.title}</h2>
                  <p className="mt-2 text-white/60">{doc.description}</p>
                  <div className="mb-4 mt-4 flex items-center justify-between text-sm text-white/50">
                    <span>{doc.category}</span>
                    <span>On request</span>
                  </div>
                  {doc.downloadUrl ? (
                    <Button
                      asChild
                      variant="brand"
                      className="w-full"
                      data-testid={`button-download-${doc.id}`}
                    >
                      <a href={doc.downloadUrl} download target="_blank" rel="noopener noreferrer">
                        <Download className="mr-2 h-4 w-4" />
                        Download PDF
                      </a>
                    </Button>
                  ) : (
                    <Button
                      asChild
                      variant="outline"
                      className="w-full border-de-hairline text-white hover:bg-de-bg"
                      data-testid={`button-request-${doc.id}`}
                    >
                      <Link href="/book">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Request document
                      </Link>
                    </Button>
                  )}
              </article>
            ))}
          </div>

          <ConversionPathBar
            headline="Need custom documentation?"
            body="We can provide tailored proposals, assessments, and documentation for your specific needs."
            primaryTestId="button-request-docs"
          />

          <p className="text-center text-sm text-white/55">
            All documents are for informational purposes. Contact us for specific pricing and service details.
          </p>
      </div>
    </PageTemplate>
  );
}
