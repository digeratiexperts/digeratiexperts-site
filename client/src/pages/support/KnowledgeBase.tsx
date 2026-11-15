import { PageTemplate } from "@/components/PageTemplate";
import { Book, FileText, Zap, MonitorSmartphone, Ticket, LogIn } from "lucide-react";
import { KbCard, KbCardGrid, KbSearchField, KbToneScope } from "@/components/kb/docs/KbIndexParts";
import { useMemo, useState } from "react";
import { useSEO } from "@/hooks/useSEO";
import { PRIMARY_PHONE, phoneAction } from "@/data/companyContact";
import {
  Chapter,
  Container,
  ClosingCta,
  HeroActions,
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
      title="How can we help?"
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
          <KbToneScope tone="paper">
            <div className="mb-10">
              <KbSearchField
                id="kb-search"
                label="Search knowledge base topics"
                placeholder="Search topics…"
                value={searchTerm}
                onChange={setSearchTerm}
                testId="input-search-kb"
              />
            </div>

            <section aria-labelledby="kb-topics-title">
              <h2 id="kb-topics-title" className="font-heading text-2xl font-semibold text-[#1A1228]">
                Browse by category
              </h2>
              <p className="mb-6 mt-1 text-[#3A3448]">Common client questions, grouped by topic.</p>
              {filtered.length === 0 ? (
                <div className="rounded-xl border border-[var(--de-paper-hairline)] bg-white p-8 text-center">
                  <p className="text-lg font-semibold text-[#1A1228]">No matching topics</p>
                  <p className="mt-2 text-[#3A3448]">
                    Try a different search, or open a ticket if you need a technician.
                  </p>
                </div>
              ) : (
                <KbCardGrid cols={3} label="Topic categories">
                  {filtered.map((cat) => (
                    <KbCard key={cat.category} icon={cat.icon} title={cat.category} sub={`${cat.topics.length} topics`} items={cat.topics} />
                  ))}
                </KbCardGrid>
              )}
            </section>

            <section aria-labelledby="kb-full-title" className="mt-14">
              <h2 id="kb-full-title" className="font-heading text-2xl font-semibold text-[#1A1228]">
                Need the full article?
              </h2>
              <p className="mb-6 mt-1 text-[#3A3448]">
                Client-facing articles, tickets, and remote sessions live in the portal and support tools.
              </p>
              <KbCardGrid cols={3} label="Where full articles live">
                {[
                  { href: PORTAL_LOGIN, icon: LogIn, title: "Client Portal", desc: "Login for tickets, invoices, and published guides", cta: "Open portal" },
                  { href: "/support/remote-support", icon: MonitorSmartphone, title: "Remote Support", desc: "Join a Zoho Assist session with a technician", cta: "Start session" },
                  { href: "/support/submit-ticket", icon: Ticket, title: "Submit a Ticket", desc: "If the topic is not published yet, we will help directly", cta: "Open ticket" },
                ].map((item) => (
                  <KbCard key={item.href} href={item.href} icon={item.icon} title={item.title} text={item.desc} cta={item.cta} />
                ))}
              </KbCardGrid>
            </section>
          </KbToneScope>
        </Container>
      </Chapter>

      <ClosingCta
        tone="surface"
        eyebrow="Support"
        title="Still have questions?"
        lede="Our support team is ready to assist."
        showPhone={false}
        primary={{ label: "Submit Support Ticket", href: "/support/submit-ticket", testId: "button-submit-ticket" }}
        secondary={phoneAction("Call Support", "button-call-support")}
      />
    </PageTemplate>
  );
}
