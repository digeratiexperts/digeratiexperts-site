import { Link } from "wouter";
import {
  Star,
  Shield,
  MessageCircle,
  Award,
  Zap,
  DollarSign,
  Mail,
  Target,
} from "lucide-react";
import { PageTemplate } from "@/components/PageTemplate";
import { IconWell } from "@/components/visual/IconWell";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/useSEO";

interface RightCard {
  icon: typeof Star;
  title: string;
  rightText: string;
  pledgeText: string;
}

const rights: RightCard[] = [
  {
    icon: Star,
    title: "Complete Satisfaction",
    rightText: "You have a right to expect complete satisfaction from all services you receive from Digerati Experts. If you are ever unhappy with a service provided, we will correct and redeliver that service until you are completely satisfied with the result.",
    pledgeText: "We Pledge to make it right—at no additional cost to you—until we've exceeded your expectations."
  },
  {
    icon: Shield,
    title: "Compliance-First Solutions",
    rightText: "You have the right to trust that we are recommending and delivering solutions that meet all relevant compliance requirements for your industry—including HIPAA, PCI-DSS, FTC Safeguards, and SOC 2 standards.",
    pledgeText: "We Pledge to never recommend or deliver a service that would put you at risk for non-compliance."
  },
  {
    icon: MessageCircle,
    title: "Plain English Communication",
    rightText: "You have the right to get answers to your questions in plain English, not techno-babble. We believe technology should empower you, not confuse you.",
    pledgeText: "We Pledge to explain recommendations clearly and answer your questions without talking down to you or making you feel foolish for asking."
  },
  {
    icon: Award,
    title: "Professionalism & Respect",
    rightText: "You have a right to expect the highest levels of personal accountability, professionalism, and empowerment in every interaction with our organization.",
    pledgeText: "We Pledge to treat you with courtesy, responsiveness, integrity, and respect—ensuring every interaction is a positive, cooperative experience."
  },
  {
    icon: Zap,
    title: "Proactive Innovation",
    rightText: "You have a right to expect us to lead the way in finding, vetting, and recommending new technologies that can protect your business from cyber threats, increase efficiency, lower costs, and improve operations.",
    pledgeText: "We Pledge to constantly seek better solutions to help your business thrive—not just to pad our pockets."
  },
  {
    icon: DollarSign,
    title: "Transparent Pricing",
    rightText: "You have a right to know exactly what a project, solution, or service will cost before we begin. No surprises, no confusion, no hidden fees.",
    pledgeText: "We Pledge to deliver solutions on budget with straightforward, clear billing—without mistakes, hidden fees, or unexpected expenses."
  },
  {
    icon: Mail,
    title: "Your Preferred Communication",
    rightText: "You have a right to communicate with us in your preferred method—whether that's through our website, ticketing system, email, phone, or in person.",
    pledgeText: "We Pledge to make it easy for you to reach us your way—never forcing you to use a portal or communication method you're uncomfortable with."
  },
  {
    icon: Target,
    title: "Single Point of Contact",
    rightText: "You have the right to a single, trusted account representative who understands your business and can help with any IT-related issue—from vendor coordination to security concerns.",
    pledgeText: "We Pledge to provide you with a known contact who can address all your technology needs, including computers, networks, phones, security systems, and vendor relationships."
  }
];

export default function ClientBillOfRights() {
  useSEO({
    title: "Client Bill of Rights",
    description:
      "Digerati Experts Client Bill of Rights: satisfaction, compliance-first recommendations, plain English, transparent pricing, and a single point of contact.",
    canonical: "/about/client-bill-of-rights",
  });

  return (
    <PageTemplate
      title="Client Bill of Rights"
      subtitle="We greatly appreciate the trust and confidence our clients have placed in Digerati Experts. Your security is our mission, and exceptional service is our standard."
      breadcrumbs={[{ label: "About" }, { label: "Client Bill of Rights" }]}
    >
      <div className="mx-auto max-w-5xl space-y-12">
        <div className="rounded-xl border border-de-hairline bg-de-raised p-6 text-center">
          <p className="text-white/85">
            We pledge to uphold the <span className="font-semibold text-de-accent-ink">highest standards</span> of
            technical support, cybersecurity excellence, and customer satisfaction
          </p>
        </div>

        <div className="grid gap-6">
          {rights.map((right, index) => (
            <article
              key={right.title}
              className="de-interactive-card rounded-xl border border-de-hairline bg-de-raised p-6 md:p-8"
              data-testid={`card-right-${index}`}
            >
              <div className="mb-5 flex items-start gap-5">
                <IconWell icon={right.icon} size="md" surface="dark" />
                <div>
                  <h3 className="mb-3 text-xl font-semibold text-white">{right.title}</h3>
                  <p className="leading-relaxed text-white/80">
                    <span className="font-medium text-de-accent-ink">You have a right</span>{" "}
                    {right.rightText.replace(/^You have (a |the )?right ?(to)?/i, "")}
                  </p>
                </div>
              </div>
              <div className="rounded-r-lg border-l-2 border-[#D3126A] bg-de-bg py-3 pl-4 pr-4 md:ml-[68px]">
                <p className="text-sm leading-relaxed text-white/75">
                  <span className="font-semibold text-de-accent-ink">We Pledge</span>{" "}
                  {right.pledgeText.replace(/^We Pledge /i, "")}
                </p>
              </div>
            </article>
          ))}
        </div>

        <section className="rounded-2xl border border-de-hairline bg-de-raised p-8 text-center md:p-10">
          <h2 className="mb-6 text-2xl font-bold text-white md:text-3xl" data-testid="heading-commitment">
            Our Commitment to Excellence
          </h2>
          <p className="text-lg leading-relaxed text-white/80">
            Most of our clients come from referrals from satisfied customers. We <span className="font-medium text-de-accent-ink">want</span> you to recommend us,
            but we understand that you will only do this if you are extremely pleased with our services.
            That's why we work so hard to go above and beyond. The establishment of our Client Bill of Rights,
            along with our continual investment in people, processes, and technology, clearly demonstrates
            our unwavering commitment to your success and security.
          </p>
        </section>

        <div className="rounded-2xl border border-[#D3126A]/40 bg-[#D3126A] px-8 py-10 text-center">
          <p className="mb-6 text-white">See also our money-back guarantee</p>
          <Button asChild size="lg" className="h-12 bg-white px-8 font-semibold text-[#D3126A] hover:bg-white/95">
            <Link href="/about/guarantee" data-testid="link-guarantee">
              100% Money-Back Guarantee
            </Link>
          </Button>
        </div>
      </div>
    </PageTemplate>
  );
}
