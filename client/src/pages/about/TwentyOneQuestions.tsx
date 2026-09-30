import { Phone, MapPin, Check } from "lucide-react";
import { PageTemplate } from "@/components/PageTemplate";
import { Button } from "@/components/ui/button";
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

  return (
    <PageTemplate
      title="21 Questions You MUST Ask Before Hiring An IT Support Company"
      subtitle="A modern MSP is identity-first, security-led, and business-aligned. Use this chart to compare the real difference."
      breadcrumbs={[{ label: "About" }, { label: "21 Questions" }]}
    >
      <div className="space-y-12">
        <p className="text-sm font-semibold uppercase tracking-wider text-de-accent-ink">
          Elite IT & Cybersecurity for Phoenix Businesses
        </p>

        <p className="mb-3 text-sm text-white/55 md:hidden">
          Swipe sideways to compare companies.
        </p>
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-de-magenta-ink" tabIndex={0} role="region" aria-label="21 questions comparison table">
          <table className="w-full min-w-[800px] border-collapse" data-testid="comparison-table">
            <thead>
              <tr>
                <th className="w-[45%] border border-de-hairline bg-de-raised p-4 text-left text-sm font-bold text-white">
                  Critical Question
                </th>
                <th className="w-[13.75%] border border-de-hairline bg-de-bg p-4 text-center text-sm font-bold text-white">
                  Company A<br /><span className="text-white/55">_______</span>
                </th>
                <th className="w-[13.75%] border border-de-hairline bg-de-bg p-4 text-center text-sm font-bold text-white">
                  Company B<br /><span className="text-white/55">_______</span>
                </th>
                <th className="w-[13.75%] border border-de-hairline bg-de-bg p-4 text-center text-sm font-bold text-white">
                  Company C<br /><span className="text-white/55">_______</span>
                </th>
                <th className="w-[13.75%] border border-de-hairline bg-de-raised p-4 text-center text-sm font-bold text-white">
                  DIGERATI<br />EXPERTS
                </th>
              </tr>
            </thead>
            <tbody>
              {questions.map((question, index) => (
                <tr key={question} className={index % 2 === 0 ? "bg-de-bg" : "bg-de-raised/60"}>
                  <td
                    className="border border-de-hairline p-4 text-sm font-medium leading-relaxed text-white"
                    data-testid={`question-${index}`}
                  >
                    {question}
                  </td>
                  <td className="border border-de-hairline p-4" />
                  <td className="border border-de-hairline p-4" />
                  <td className="border border-de-hairline p-4" />
                  <td className="border border-de-hairline bg-de-raised p-4 text-center">
                    {index === 17 ? (
                      <span className="block text-xs font-bold leading-tight text-de-accent-ink" data-testid="special-note">
                        Phoenix-based<br />& US Only!
                      </span>
                    ) : (
                      <Check className="mx-auto h-7 w-7 text-de-accent-ink" strokeWidth={3} data-testid={`check-${index}`} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-[#D3126A]/40 bg-[#D3126A] px-8 py-10 text-center md:px-12 md:py-12">
          <h2 className="mb-6 text-2xl font-bold text-white md:text-3xl" data-testid="heading-cta">
            Ready to experience the Digerati Experts difference?
          </h2>
          <a
            href={PRIMARY_PHONE.telHref}
            className="mb-6 block text-3xl font-bold text-white md:text-4xl"
            data-testid="link-phone"
          >
            <Phone className="mr-3 inline-block h-8 w-8 -mt-1" />
            {PRIMARY_PHONE.display}
          </a>
          <p className="text-lg font-medium leading-relaxed text-white">
            Call now for your FREE 30-Day Risk-Free Pilot<br />
            <span className="text-white">Serving Phoenix, Scottsdale, Tempe, Chandler, Mesa & Surrounding Areas</span>
          </p>
          <div className="mt-8">
            <Button asChild size="lg" className="h-12 bg-white px-8 font-semibold text-[#D3126A] hover:bg-white/95">
              <a href="/book" data-testid="button-schedule">
                {CTA.primary}
              </a>
            </Button>
          </div>
        </div>

        <div className="border-t border-de-hairline py-6 text-center">
          <p className="mb-2 font-semibold text-white">
            DIGERATI EXPERTS | {PRIMARY_PHONE.display} | info@digeratiexperts.com
          </p>
          <p className="flex items-center justify-center gap-2 text-sm text-white/55">
            <MapPin className="h-4 w-4" />
            Serving Phoenix Metro Area | Chandler, Arizona | www.digeratiexperts.com
          </p>
        </div>
      </div>
    </PageTemplate>
  );
}
