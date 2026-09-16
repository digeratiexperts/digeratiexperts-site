import { PageTemplate } from "@/components/PageTemplate";
import { IconWell } from "@/components/visual/IconWell";
import { Search, Book, FileText, Zap, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { useSEO } from "@/hooks/useSEO";
import { PRIMARY_PHONE } from "@/data/companyContact";

const PORTAL_LOGIN = "https://portal.digeratiexperts.com/portal/login";

const categories = [
  {
    category: "Getting Started",
    icon: Zap,
    topics: [
      "How to Access Your Client Portal",
      "Setting Up Multi-Factor Authentication",
      "Submitting Your First Support Ticket",
      "Understanding Your Invoice and Payment Options",
    ],
  },
  {
    category: "Troubleshooting",
    icon: FileText,
    topics: [
      "Resetting Your Portal Password",
      "Cannot Connect to Remote Support",
      "Email and Calendar Not Syncing",
      "Network Connectivity Issues",
    ],
  },
  {
    category: "Security & Compliance",
    icon: Book,
    topics: [
      "Understanding HIPAA Requirements",
      "Best Practices for Password Management",
      "Recognizing Phishing and Social Engineering",
      "Data Backup and Recovery Options",
    ],
  },
];

export default function KnowledgeBase() {
  const [searchTerm, setSearchTerm] = useState("");

  useSEO({
    title: "Knowledge Base | Digerati Experts",
    description:
      "Self-service topic index for Digerati Experts clients. Full articles live in the Client Portal and Desk.",
    canonical: "/support/knowledge-base",
  });

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((cat) => ({
        ...cat,
        topics: cat.topics.filter((t) => t.toLowerCase().includes(q)),
      }))
      .filter((cat) => cat.topics.length > 0);
  }, [searchTerm]);

  return (
    <PageTemplate
      title="Knowledge Base"
      subtitle="A public topic index for common client questions. Full articles and ticket history live in the Client Portal."
      breadcrumbs={[{ label: "Support", href: "/about/support" }, { label: "Knowledge Base" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="brand" size="lg" className="h-12 px-6 font-semibold">
            <a href={PORTAL_LOGIN}>Open Client Portal</a>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-12 border-white/20 px-6 font-semibold text-white hover:bg-white/10">
            <a href="/support/submit-ticket">Submit a Ticket</a>
          </Button>
        </div>
      }
    >
      <div className="space-y-16">
        <div className="mx-auto w-full max-w-2xl">
          <label htmlFor="kb-search" className="sr-only">
            Search knowledge base topics
          </label>
          <div className="relative flex items-center rounded-xl border border-de-hairline bg-de-raised">
            <Search className="absolute left-4 h-5 w-5 text-white/55" aria-hidden="true" />
            <Input
              id="kb-search"
              type="search"
              placeholder="Search topics…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-0 bg-transparent py-3 pl-12 pr-4 text-lg text-white placeholder:text-white/55"
              data-testid="input-search-kb"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-de-hairline bg-de-raised p-8 text-center">
            <p className="text-lg font-semibold text-white">No matching topics</p>
            <p className="mt-2 text-white/65">
              Try a different search, or open a ticket if you need a technician.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {filtered.map((cat) => {
              const Icon = cat.icon;
              return (
                <div key={cat.category}>
                  <div className="mb-6 flex items-center gap-3">
                    <IconWell icon={Icon} size="sm" surface="dark" />
                    <h2 className="text-2xl font-bold text-white">{cat.category}</h2>
                    <span className="ml-auto text-sm text-white/50">{cat.topics.length} topics</span>
                  </div>
                  <ul className="grid gap-3 md:grid-cols-2">
                    {cat.topics.map((topic) => (
                      <li
                        key={topic}
                        className="rounded-xl border border-de-hairline bg-de-raised px-5 py-4 text-white/85"
                      >
                        {topic}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        <div className="rounded-2xl border border-de-hairline bg-de-raised p-8 md:p-12">
          <h2 className="mb-3 text-center text-2xl font-bold text-white">Need the full article?</h2>
          <p className="mx-auto mb-8 max-w-2xl text-center text-white/65">
            Client-facing articles, tickets, and remote sessions live in the portal and support tools.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { href: PORTAL_LOGIN, title: "Client Portal", desc: "Login for tickets, invoices, and published guides", cta: "Open portal" },
              { href: "/support/remote-support", title: "Remote Support", desc: "Join a Zoho Assist session with a technician", cta: "Start session" },
              { href: "/support/submit-ticket", title: "Submit a Ticket", desc: "If the topic is not published yet, we will help directly", cta: "Open ticket" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="de-interactive-card flex h-full flex-col rounded-2xl border border-de-hairline bg-de-bg p-6 focus-visible:outline-none"
              >
                <h3 className="font-semibold text-white">{item.title}</h3>
                <p className="mt-2 flex-1 text-sm text-white/60">{item.desc}</p>
                <span className="mt-4 text-sm font-semibold text-de-accent-ink">{item.cta}</span>
              </a>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-de-hairline bg-de-raised p-8 text-center">
          <LifeBuoy className="mx-auto mb-3 h-6 w-6 text-de-accent-ink" aria-hidden="true" />
          <h2 className="mb-4 text-3xl font-bold text-white">Still Need Help?</h2>
          <p className="mb-6 text-lg text-white/70">Our support team is ready to assist.</p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild variant="brand" size="lg" className="h-12 px-8 font-semibold" data-testid="button-submit-ticket">
              <a href="/support/submit-ticket">Submit Support Ticket</a>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 border-white/20 px-8 font-semibold text-white hover:bg-white/10" data-testid="button-call-support">
              <a href={PRIMARY_PHONE.telHref}>Call Support</a>
            </Button>
          </div>
        </div>
      </div>
    </PageTemplate>
  );
}
