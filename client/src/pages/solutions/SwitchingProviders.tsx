import { BadgeCheck, FileText, KeyRound, ScrollText } from "lucide-react";
import { PageTemplate } from "@/components/PageTemplate";
import {
  Chapter,
  ChapterHeader,
  CheckList,
  ClosingCta,
  Container,
  FaqChapter,
  FeatureGrid,
  HeroActions,
  StepRail,
} from "@/components/site/chapters";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";

/**
 * Switching IT providers (MSP website research, 2026-11-11: competitors answer
 * "how hard is it to leave my current MSP?" up front; DE's answer, the Bill of
 * Rights, the 30-day guarantee and the public MSA/SLA, was buried). Every promise
 * on this page links to the page where DE already makes it.
 */

const OWN_THIS = [
  "Admin access to Microsoft 365 or Google Workspace, in an account you control",
  "Your domain registrar and DNS logins",
  "Firewall, Wi-Fi and backup console logins",
  "A list of licenses and renewals, and who pays for each",
  "Where your backups live, and the last time a restore was tested",
  "The notice period in your current IT contract",
];

const STEPS = [
  {
    title: "A short fit call",
    text: "Tell us what's not working. We'll say straight away if we're not the right fit.",
    meta: "Step 1",
  },
  {
    title: "Cyber Risk Assessment",
    text: "We document identity, endpoints, email, backups and controls, so the switch starts from facts, not guesses.",
    meta: "Step 2",
  },
  {
    title: "A plan you can see priced",
    text: "A proposal on a published ProActive tier, with scope written down before you sign.",
    meta: "Step 3",
  },
  {
    title: "A planned handover",
    text: "We agree the order of work and the cutover date with you, so the day you switch is a non-event.",
    meta: "Step 4",
  },
];

const PROMISES = [
  {
    icon: KeyRound,
    title: "Your technology, your data, your keys",
    text: "Credentials, tenants and licenses stay yours, with a clear exit path if you ever leave us.",
    href: "/about/client-bill-of-rights",
    linkLabel: "Client Bill of Rights",
  },
  {
    icon: BadgeCheck,
    title: "30-day money-back guarantee",
    text: "Not happy in the first 30 days? Cancel and get your service fees back, no questions asked.",
    href: "/about/guarantee",
    linkLabel: "Read the guarantee",
  },
  {
    icon: ScrollText,
    title: "The contract, in public",
    text: "Read our Master Services Agreement before you ever talk to sales.",
    href: "/legal/msa",
    linkLabel: "Master Services Agreement",
  },
  {
    icon: FileText,
    title: "Service levels, in writing",
    text: "The service level agreement is published too, so you know what to hold us to.",
    href: "/legal/sla",
    linkLabel: "Service Level Agreement",
  },
];

const FAQS = [
  {
    question: "Do I have to wait for my current contract to end?",
    answer:
      "Not to start. The fit call and the assessment can happen while your current contract runs, so the plan is ready when your notice period ends.",
  },
  {
    question: "What if my current provider holds our admin passwords?",
    answer:
      "It's common, and it's the first thing to fix. The checklist on this page lists what to get back. If something can't be recovered, we'll flag it in the assessment and plan around it.",
  },
  {
    question: "Will my team notice the switch?",
    answer:
      "The goal is that they don't, apart from knowing who to call. The handover order and cutover date are agreed with you in advance.",
  },
  {
    question: "What does it cost to switch?",
    answer:
      "ProActive plans are priced per user and published on our pricing page. The assessment is scoped and quoted before it starts, and the proposal shows the full price before you sign.",
  },
];

export default function SwitchingProviders() {
  useSEO({
    title: "Switching IT Providers in Arizona",
    description:
      "Thinking about leaving your current IT provider? What to get back first, how a switch to Digerati Experts works, and the guarantees we put in writing.",
    canonical: "/solutions/switching-it-providers",
  });

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Solutions · Switching providers"
      title="Switching IT providers, minus the drama"
      subtitle="Unhappy with your current IT? Here's what to get back first, how a switch works, and the promises we put in writing so you're never stuck with us either."
      breadcrumbs={[{ label: "Solutions", href: "/solutions" }, { label: "Switching IT providers" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: CTA.primary, href: "/book", testId: "button-switching-primary" }}
            secondary={{ label: "See plans and pricing", href: "/pricing", testId: "button-switching-pricing" }}
          />
        </div>
      }
    >
      <Chapter tone="paper" seam={false}>
        <Container>
          <ChapterHeader
            tone="paper"
            eyebrow="Before you switch"
            title="Make sure you own these"
            lede="Whoever runs your IT next, these should be in your hands, not your provider's. Start collecting them now."
          />
          <div className="mt-10">
            <CheckList tone="paper" items={OWN_THIS} />
          </div>
        </Container>
      </Chapter>

      <Chapter tone="well">
        <Container>
          <ChapterHeader tone="well" eyebrow="How it works" title="Four steps from fed up to sorted" />
          <div className="mt-12">
            <StepRail tone="well" steps={STEPS} />
          </div>
        </Container>
      </Chapter>

      <Chapter tone="surface">
        <Container>
          <ChapterHeader
            tone="surface"
            eyebrow="Risk reversal"
            title="No hostage-taking. It's in writing."
            lede="Each of these is a page you can read today, not a promise on a sales call."
          />
          <div className="mt-10">
            <FeatureGrid tone="surface" columns={2} items={PROMISES} />
          </div>
        </Container>
      </Chapter>

      <FaqChapter faqs={FAQS} title="Switching questions" />

      <ClosingCta
        tone="well"
        title="Ready to compare notes on your current setup?"
        lede="Start with a conversation. You'll leave with a clearer picture, whether or not you switch."
        primary={{ label: CTA.primary, href: "/book", testId: "button-switching-closing" }}
      />
    </PageTemplate>
  );
}
