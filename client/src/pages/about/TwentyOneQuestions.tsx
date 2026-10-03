import { Check } from "lucide-react";
import { PageTemplate } from "@/components/PageTemplate";
import { Chapter, Container, ClosingCta, HeroActions } from "@/components/site/chapters";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";

const questions = [
  "Do they answer calls live and provide multiple ways to reach support with clear escalation?",
  "Do they publish written response targets and resolution priorities for critical vs routine issues?",
  "Do they communicate in plain English and tie tech to business outcomes?",
  "Do they run regular Cyber Risk Assessments with a prioritized roadmap?",
  "Do they provide vCIO-style reviews with recurring reports and Technology Business Reviews?",
  "Do they deliver transparent invoices and clearly define what is included vs out-of-scope?",
  "Do they carry insurance that protects YOU (E&O, liability, workers comp) with proof?",
  "Do they guarantee projects with clear scope, timeline, exclusions, and risks in a formal SOW?",
  "Do they provide true 24/7 monitoring of endpoints, servers, and network?",
  "Do they offer a modern managed security stack (EDR + SOC + email security + user training)?",
  "Do they deliver complete, updated IT documentation (assets, network, IAM, vendor records)?",
  "Do they have depth across disciplines so you're not dependent on one person?",
  "Do they manage Identity & Access (MFA, SSO, provisioning) as a core service?",
  "Do they enforce Zero Trust basics (device health, least privilege, conditional access)?",
  "Do they protect users where work happens: browser security, phishing resistance, data-loss controls?",
  "Do they monitor BOTH local and cloud backups and perform scheduled test restores?",
  "Do they maintain an incident response and disaster recovery playbook tailored to you?",
  "Is their help desk local/US-based — and will you know who's working your tickets?",
  "Do they manage your modern workplace (MDM, SaaS, Microsoft/Google, Teams) cohesively?",
  "Do they understand SMB compliance and offer defined modules (HIPAA, FTC, GDPR, cyber insurance)?",
  "Are they experienced with your line-of-business apps and own vendor coordination end-to-end?"
];

export default function TwentyOneQuestions() {
  useSEO({
    title: "21 Questions Before Hiring an IT Company",
    description:
      "21 questions Arizona businesses should ask before hiring an IT support company. Use this comparison chart to evaluate MSPs.",
    canonical: "/about/21-questions",
  });

  const th = "border border-[var(--de-paper-hairline)] p-4 text-center text-sm font-semibold text-[#1A1228]";

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Elite IT & Cybersecurity for Phoenix Businesses"
      title="21 Questions You MUST Ask Before Hiring An IT Support Company"
      subtitle="A modern MSP is identity-first, security-led, and business-aligned. Use this chart to compare the real difference."
      breadcrumbs={[{ label: "About" }, { label: "21 Questions" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: CTA.primary, href: "/book" }}
            secondary={{ label: `Call ${PRIMARY_PHONE.display}`, href: PRIMARY_PHONE.telHref }}
          />
        </div>
      }
    >
      <Chapter tone="paper" seam={false}>
        <Container>
          <p className="mb-3 text-sm text-black/60 md:hidden">Swipe sideways to compare companies.</p>
          <div
            className="overflow-x-auto rounded-xl border border-[var(--de-paper-hairline)] bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]"
            tabIndex={0}
            role="region"
            aria-label="21 questions comparison table"
          >
            <table className="w-full min-w-[800px] border-collapse" data-testid="comparison-table">
              <thead>
                <tr>
                  <th className={`${th} w-[45%] bg-[#F4F1EA] text-left`}>Critical Question</th>
                  <th className={`${th} w-[13.75%]`}>
                    Company A<br />
                    <span className="text-black/45">_______</span>
                  </th>
                  <th className={`${th} w-[13.75%]`}>
                    Company B<br />
                    <span className="text-black/45">_______</span>
                  </th>
                  <th className={`${th} w-[13.75%]`}>
                    Company C<br />
                    <span className="text-black/45">_______</span>
                  </th>
                  <th className={`${th} w-[13.75%] border-b-2 border-b-[#D3126A] bg-[#FBEAF2] text-de-magenta-paper-ink`}>
                    DIGERATI
                    <br />
                    EXPERTS
                  </th>
                </tr>
              </thead>
              <tbody>
                {questions.map((question, index) => (
                  <tr key={question} className={index % 2 === 0 ? "bg-white" : "bg-[#FAF8F4]"}>
                    <td
                      className="border border-[var(--de-paper-hairline)] p-4 text-sm font-medium leading-relaxed text-[#1A1228]"
                      data-testid={`question-${index}`}
                    >
                      <span className="mr-2 font-mono text-xs text-black/50">{String(index + 1).padStart(2, "0")}</span>
                      {question}
                    </td>
                    <td className="border border-[var(--de-paper-hairline)] p-4" />
                    <td className="border border-[var(--de-paper-hairline)] p-4" />
                    <td className="border border-[var(--de-paper-hairline)] p-4" />
                    <td className="border border-[var(--de-paper-hairline)] bg-[#FBEAF2]/60 p-4 text-center">
                      {index === 17 ? (
                        <span className="block text-xs font-bold leading-tight text-de-magenta-paper-ink" data-testid="special-note">
                          Chandler-based<br />& US Only!
                        </span>
                      ) : (
                        <Check className="mx-auto h-6 w-6 text-de-magenta-paper-ink" strokeWidth={3} data-testid={`check-${index}`} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </Chapter>

      <div data-testid="heading-cta">
        <ClosingCta
          tone="well"
          title="Ready to experience the Digerati Experts difference?"
          lede={
            <>
              Call now for your FREE 30-Day Risk-Free Pilot.
              <br />
              Serving Phoenix, Scottsdale, Tempe, Chandler, Mesa &amp; Surrounding Areas
            </>
          }
          primary={{ label: CTA.primary, href: "/book", testId: "button-schedule" }}
          secondary={{ label: PRIMARY_PHONE.display, href: PRIMARY_PHONE.telHref, testId: "link-phone" }}
        />
      </div>

      <Chapter tone="well" compact>
        <Container>
          <div className="text-center">
            <p className="font-semibold text-white">
              DIGERATI EXPERTS | {PRIMARY_PHONE.display} | info@digeratiexperts.com
            </p>
            <p className="mt-1 text-sm text-white/60">
              Serving Phoenix Metro Area | Chandler, Arizona | www.digeratiexperts.com
            </p>
          </div>
        </Container>
      </Chapter>
    </PageTemplate>
  );
}
