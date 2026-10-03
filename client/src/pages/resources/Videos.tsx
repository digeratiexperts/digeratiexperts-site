import { Link } from "wouter";
import { PageTemplate } from "@/components/PageTemplate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
import { Chapter, ChapterHeader, ClosingCta, Container, HeroActions, cardPaper } from "@/components/site/chapters";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";

import trendsImg from "@assets/stock_images/cybersecurity_trends_d69267d4.jpg";
import hipaaImg from "@assets/stock_images/healthcare_medical_r_3bfa1a64.jpg";
import ransomwareImg from "@assets/stock_images/ransomware_protectio_63d2a35d.jpg";
import cloudImg from "@assets/stock_images/cloud_backup_server__4ac65288.jpg";
import realEstateImg from "@assets/stock_images/real_estate_house_ke_f7c5422b.jpg";
import trainingImg from "@assets/stock_images/employee_security_tr_12ae4644.jpg";

const topics = [
  {
    id: 1,
    title: "Cybersecurity 101 for Small Business",
    description: "Learn the fundamentals of protecting your business from cyber threats in this comprehensive overview.",
    type: "Topic guide",
    thumbnail: trendsImg,
  },
  {
    id: 2,
    title: "HIPAA Compliance Workshop",
    description: "Everything healthcare providers need to know about maintaining HIPAA compliance.",
    type: "Topic guide",
    thumbnail: hipaaImg,
  },
  {
    id: 3,
    title: "Ransomware Defense Strategies",
    description: "Practical steps to protect your organization from ransomware attacks.",
    type: "Topic guide",
    thumbnail: ransomwareImg,
  },
  {
    id: 4,
    title: "Cloud Security Best Practices",
    description: "Secure your cloud infrastructure with proven strategies and tools.",
    type: "Topic guide",
    thumbnail: cloudImg,
  },
  {
    id: 5,
    title: "Wire Fraud Prevention for Real Estate",
    description: "Protect your real estate transactions from increasingly sophisticated wire fraud schemes.",
    type: "Topic guide",
    thumbnail: realEstateImg,
  },
  {
    id: 6,
    title: "Employee Security Training Demo",
    description: "See how security awareness training helps reduce human error risks.",
    type: "Topic guide",
    thumbnail: trainingImg,
  },
];

const trainingTopics = [
  {
    id: 1,
    title: "Cybersecurity Predictions & Planning",
    summary: "Threat trends and practical planning for Arizona SMBs",
  },
  {
    id: 2,
    title: "Zero Trust Architecture for SMBs",
    summary: "How smaller teams can adopt Zero Trust without enterprise complexity",
  },
  {
    id: 3,
    title: "Compliance Updates That Matter",
    summary: "HIPAA, cyber insurance, and audit-ready controls for growing firms",
  },
];

export default function Videos() {
  useSEO({
    title: "Videos & Learning Topics",
    description:
      "Cybersecurity topic guides from Digerati Experts. This is a topic library — not a live on-demand webinar catalog.",
    canonical: "/resources/videos",
  });

  return (
    <PageTemplate
      title="Learn From the Experts"
      eyebrow="Topic guides"
      subtitle="Explore cybersecurity topics we cover with Arizona businesses. This page is a topic guide — not a live on-demand webinar library."
      breadcrumbs={[{ label: "Resources", href: "/resources" }, { label: "Videos" }]}
      layout="chapters"
      actions={<HeroActions primary={{ label: CTA.primary, href: "/book" }} />}
    >
      <Chapter tone="surface" seam={false}>
        <Container>
          <ChapterHeader
            tone="surface"
            eyebrow="Live sessions"
            title="Request a Live Session"
            lede="Interested in a briefing or team workshop on these topics? Book a conversation and we'll schedule it with you."
          />
          <ol className="grid border-t border-[var(--de-hairline)] md:grid-cols-3 md:gap-x-10">
            {trainingTopics.map((topic, i) => (
              <li
                key={topic.id}
                className="flex flex-col border-b border-[var(--de-hairline)] py-7"
                data-testid={`card-upcoming-${topic.id}`}
              >
                <span className="font-mono text-sm font-semibold text-de-magenta-ink">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 font-heading text-lg font-semibold leading-snug text-white">{topic.title}</h3>
                <p className="mb-5 mt-2 flex-1 text-base leading-relaxed text-white/70">{topic.summary}</p>
                <Button asChild variant="brand" className="min-h-11 w-full sm:w-auto sm:self-start" data-testid={`button-register-${topic.id}`}>
                  <Link href="/book">Book a Session</Link>
                </Button>
              </li>
            ))}
          </ol>
        </Container>
      </Chapter>

      <Chapter tone="paper">
        <Container>
          <ChapterHeader
            tone="paper"
            eyebrow="Library"
            title="Topic Library"
            lede="Related reading from our journal — these are articles and guides, not playable webinar recordings."
          />
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic) => (
              <li key={topic.id} className="flex">
                <article
                  className={`${cardPaper} flex w-full flex-col overflow-hidden`}
                  data-testid={`card-video-${topic.id}`}
                >
                  <div className="relative aspect-video overflow-hidden">
                    <img
                      src={topic.thumbnail}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width={400}
                      height={225}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <Badge className="mb-3 self-start border border-[var(--de-paper-hairline)] bg-[var(--de-paper)] text-de-magenta-paper-ink">
                      {topic.type}
                    </Badge>
                    <h3 className="font-heading text-lg font-semibold leading-snug text-[#1A1228]">{topic.title}</h3>
                    <p className="mt-2 flex-1 text-[0.95rem] leading-relaxed text-[#3A3448]">{topic.description}</p>
                    <Button
                      asChild
                      variant="outline"
                      className="mt-5 min-h-11 w-full border-[var(--de-paper-hairline)] bg-white text-[#1A1228] hover:bg-[var(--de-paper)] hover:text-[#1A1228]"
                      data-testid={`button-related-reading-${topic.id}`}
                    >
                      <Link href="/resources/blog">
                        <BookOpen className="mr-2 h-4 w-4" aria-hidden="true" />
                        Related reading
                      </Link>
                    </Button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </Container>
      </Chapter>

      <ClosingCta
        tone="well"
        title="Want a custom training session?"
        lede="We offer personalized security training for your team. Book an assessment to scope it."
        primary={{ label: CTA.primary, href: "/book", testId: "button-schedule-training" }}
      />
    </PageTemplate>
  );
}
