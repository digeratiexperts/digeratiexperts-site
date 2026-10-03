import { PageTemplate } from "@/components/PageTemplate";
import { IconWell } from "@/components/visual/IconWell";
import { Search, Book, FileText, Zap, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { useSEO } from "@/hooks/useSEO";
import { PRIMARY_PHONE } from "@/data/companyContact";
import {
  Chapter,
  Container,
  ChapterHeader,
  ClosingCta,
  HeroActions,
  cardDark,
} from "@/components/site/chapters";

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
      layout="chapters"
      eyebrow="Support · Knowledge Base"
      title="Knowledge Base"
      subtitle="A public topic index for common client questions. Full articles and ticket history live in the Client Portal."
      breadcrumbs={[{ label: "Support", href: "/about/support" }, { label: "Knowledge Base" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: "Open Client Portal", href: PORTAL_LOGIN }}
            secondary={{ label: "Submit a Ticket", href: "/support/submit-ticket" }}
          />
        </div>
      }
    >
      <Chapter tone="paper" seam={false}>
        <Container>
          <div className="mb-12 max-w-2xl">
            <label htmlFor="kb-search" className="sr-only">
              Search knowledge base topics
            </label>
            <div className="relative flex items-center rounded-xl border border-[var(--de-paper-hairline)] bg-white focus-within:border-[#D3126A] focus-within:ring-2 focus-within:ring-[#D3126A]/30">
              <Search className="absolute left-4 h-5 w-5 text-black/55" aria-hidden="true" />
              <Input
                id="kb-search"
                type="search"
                placeholder="Search topics…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-12 border-0 bg-transparent py-3 pl-12 pr-4 text-lg text-[#1A1228] placeholder:text-black/55 focus-visible:ring-0"
                data-testid="input-search-kb"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-[var(--de-paper-hairline)] bg-white p-8 text-center">
              <p className="text-lg font-semibold text-[#1A1228]">No matching topics</p>
              <p className="mt-2 text-[#3A3448]">
                Try a different search, or open a ticket if you need a technician.
              </p>
            </div>
          ) : (
            <div className="space-y-14">
              {filtered.map((cat) => {
                const Icon = cat.icon;
                return (
                  <section key={cat.category} className="grid gap-6 lg:grid-cols-12 lg:gap-14">
                    <div className="flex items-start gap-4 lg:col-span-4">
                      <IconWell icon={Icon} size="sm" surface="light" />
                      <div>
                        <h2 className="font-heading text-2xl font-semibold text-[#1A1228]">{cat.category}</h2>
                        <p className="mt-1 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-black/55">
                          {cat.topics.length} topics
                        </p>
                      </div>
                    </div>
                    <ul className="border-t border-[var(--de-paper-hairline)] lg:col-span-8">
                      {cat.topics.map((topic) => (
                        <li
                          key={topic}
                          className="border-b border-[var(--de-paper-hairline)] py-4 text-base text-[#1A1228]"
                        >
                          {topic}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </Container>
      </Chapter>

      <Chapter tone="well">
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="Full articles"
            title="Need the full article?"
            lede="Client-facing articles, tickets, and remote sessions live in the portal and support tools."
          />
          <ul className="grid gap-4 md:grid-cols-3 md:gap-5">
            {[
              { href: PORTAL_LOGIN, title: "Client Portal", desc: "Login for tickets, invoices, and published guides", cta: "Open portal" },
              { href: "/support/remote-support", title: "Remote Support", desc: "Join a Zoho Assist session with a technician", cta: "Start session" },
              { href: "/support/submit-ticket", title: "Submit a Ticket", desc: "If the topic is not published yet, we will help directly", cta: "Open ticket" },
            ].map((item) => (
              <li key={item.href} className="flex">
                <a
                  href={item.href}
                  className={`${cardDark} de-interactive-card group flex w-full flex-col p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]`}
                >
                  <h3 className="font-heading text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 flex-1 text-[0.95rem] leading-relaxed text-white/70">{item.desc}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-de-magenta-ink">
                    {item.cta}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </Chapter>

      <ClosingCta
        tone="surface"
        eyebrow="Support"
        title="Still Need Help?"
        lede="Our support team is ready to assist."
        showPhone={false}
        primary={{ label: "Submit Support Ticket", href: "/support/submit-ticket", testId: "button-submit-ticket" }}
        secondary={{ label: "Call Support", href: PRIMARY_PHONE.telHref, testId: "button-call-support" }}
      />
    </PageTemplate>
  );
}
