import { Bot, ClipboardCheck, GraduationCap, HardDrive, Headphones, Layers, ShieldCheck, Users } from "lucide-react";
import { PageTemplate } from "@/components/PageTemplate";
import {
  Chapter,
  Container,
  ChapterHeader,
  CheckList,
  ClosingCta,
  FaqChapter,
  FeatureGrid,
  HeroActions,
  HeroFacts,
  IndexedList,
  StepRail,
  cardPaper,
} from "@/components/site/chapters";
import { useSEO } from "@/hooks/useSEO";

/**
 * /solutions/efficiency-before-ai: DE's position that a secure, working IT
 * foundation and an efficient team come before AI spend. A position piece: it
 * carries no statistics or third-party figures (docs/CLAIMS-REGISTER.md).
 */

const pressure = [
  {
    title: "“Your competitors are already ahead.”",
    text: "Urgency is the pitch. Most businesses are working out the same questions you are, and the ones that rush AI in without controls take on new exposure along with it.",
  },
  {
    title: "“Adopt now or fall behind.”",
    text: "A license bought on a deadline doesn't make anyone faster. A tool nobody was trained on, on top of systems that already slow your team down, adds cost without adding capacity.",
  },
  {
    title: "“AI will do the work.”",
    text: "Your people still serve your clients. AI can help them, but it can't answer the phone when the internet is down or restore a file from a backup nobody tested.",
  },
];

const foundationGaps = [
  "Staff locked out because identities and MFA were never cleaned up",
  "Aging laptops and slow logins that cost time every morning",
  "Backups that exist but have never been restored to prove they work",
  "Shared passwords and accounts nobody switched off when someone left",
  "One internet connection and no plan for when it drops",
  "New hires waiting on access while their first week slips away",
];

const budgetCuts = [
  {
    icon: HardDrive,
    title: "Hardware refresh pushed out",
    text: "Old devices fail more, patch less and slow everyone down. Delaying them to fund AI moves the cost to your team's day.",
  },
  {
    icon: GraduationCap,
    title: "Security awareness training dropped",
    text: "People are still the first line against phishing and payment fraud. AI tools make convincing scams easier to write, not harder.",
  },
  {
    icon: ShieldCheck,
    title: "Backup and recovery testing skipped",
    text: "Recovery is the line that decides whether a bad day is an inconvenience or a closed office. It is not where the savings should come from.",
  },
  {
    icon: Headphones,
    title: "Support hours trimmed",
    text: "When a problem stops someone from working, the time to fix it is what your clients feel. Fewer support hours means longer stops.",
  },
];

const order = [
  {
    meta: "Foundation",
    title: "Secure what you run on",
    text: "Identity and MFA, managed devices, patching, a protected network, and backups you have restored to prove they work.",
  },
  {
    meta: "Operations",
    title: "Make the team efficient",
    text: "Fast onboarding and offboarding, tools that work, support that answers, and a documented environment someone else could pick up.",
  },
  {
    meta: "Readiness",
    title: "Clean up data and access",
    text: "Decide who can see what before anything gets access. AI built into your apps can reach whatever the person using it can open.",
  },
  {
    meta: "AI",
    title: "Add AI where it earns its place",
    text: "Business accounts, a one-page policy your team will read, a specific job for it to do, and a check on whether it is doing it.",
  },
];

const nextSteps = [
  {
    icon: ClipboardCheck,
    title: "Cyber Risk Assessment",
    text: "See where your foundation stands: identity, devices, backup, network and data access, mapped against how your team works.",
    href: "/book",
    linkLabel: "Book the assessment",
  },
  {
    icon: Layers,
    title: "ProActive Ecosystem",
    text: "One accountable operating model for security, support and the day-to-day IT your team depends on.",
    href: "/solutions/proactive-ecosystem",
    linkLabel: "See the ecosystem",
  },
  {
    icon: Bot,
    title: "AI Background Check",
    text: "Already using AI? Find out which tools are connected to your company data, what they can reach, and your top fixes.",
    href: "/go/ai-background-check",
    linkLabel: "Check your AI",
  },
];

const faqs = [
  {
    question: "Are you telling us not to use AI?",
    answer:
      "No. AI can save your team real time when it sits on a secure, well-run environment and has a clear job to do. Our point is about order and budget: fix what stops your team from working first, then add AI on top of it, not in place of it.",
  },
  {
    question: "Our team is already using AI. What should we do now?",
    answer:
      "Move it onto business accounts your company controls, write a short policy, and check what those tools can reach. Our free AI Background Check covers which AI tools are connected to your company data, what they can reach, and your top three fixes.",
  },
  {
    question: "How do we know whether our foundation is ready?",
    answer:
      "Start with an assessment, not a purchase. A cyber risk assessment looks at identity, devices, backup and recovery, the network and data access against how your team actually works, and tells you what to fix first.",
  },
  {
    question: "We have a limited budget. Where should it go first?",
    answer:
      "Protect the things that keep you open: identities and MFA, devices, tested backups and support that answers. Then remove the friction that slows your team down. AI spending makes sense once those are in place and there is a specific job for it to do.",
  },
];

export default function EfficiencyBeforeAI() {
  useSEO({
    title: "Team Efficiency Before AI Readiness | Digerati Experts",
    description:
      "AI hype sells urgency. Digerati Experts helps businesses build the secure, working IT foundation that keeps the team and service delivery running first, then adds AI where it earns its place.",
    canonical: "/solutions/efficiency-before-ai",
  });

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Efficiency before AI"
      title="Focus on your team’s efficiency, not just AI readiness."
      subtitle="AI marketing sells fear: adopt now or fall behind. The businesses that keep serving clients through outages, attacks and staff changes are the ones whose everyday IT works. Get that right first. AI goes on top of a strong foundation, not in place of one."
      breadcrumbs={[{ label: "Solutions", href: "/solutions" }, { label: "Efficiency before AI" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: "Get My Cyber Risk Assessment", href: "/book", testId: "efficiency-hero-cta" }}
            secondary={{ label: "Free AI Background Check", href: "/go/ai-background-check" }}
          />
        </div>
      }
      heroAside={
        <HeroFacts
          title="Where the budget goes first"
          rows={[
            { label: "1 · Foundation", value: "Secure identities, devices, network and tested backups" },
            { label: "2 · Operations", value: "The tools and support your team uses every day, working" },
            { label: "3 · Readiness", value: "Clean data and access, so nothing sees more than it should" },
            { label: "4 · AI", value: "On business accounts, with a job to do" },
          ]}
          footnote="AI is a tool for your people and your operations. It is not a replacement for either."
        />
      }
    >
      <Chapter tone="well" seam={false} aria-labelledby="fear-pitch">
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="The pitch"
            title="The AI hype runs on fear"
            titleId="fear-pitch"
            lede="Fear sells fast decisions. Fast decisions about technology tend to skip the questions that matter: what problem this solves, what it can reach, and what gets cut to pay for it."
          />
          <IndexedList tone="well" items={pressure} />
        </Container>
      </Chapter>

      <Chapter tone="paper" aria-labelledby="what-ai-cant-fix">
        <Container>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-7">
              <ChapterHeader
                tone="paper"
                layout="stack"
                eyebrow="The foundation"
                title="What actually stops your team from working"
                titleId="what-ai-cant-fix"
                lede="When service delivery breaks, it is rarely because a business lacked AI. It is because something underneath failed. None of these are fixed by adding an AI tool."
              />
              <CheckList tone="paper" items={foundationGaps} />
            </div>
            <aside className={`${cardPaper} self-start p-6 md:p-7 lg:col-span-5`}>
              <Users className="h-6 w-6 text-de-magenta-paper-ink" aria-hidden="true" />
              <h3 className="mt-4 font-heading text-lg font-semibold text-[#1A1228]">AI inherits what is underneath it</h3>
              <p className="mt-2 text-base leading-relaxed text-[#3A3448]">
                An AI tool is only as good as the systems and data it sits on. If files are disorganized and permissions
                are wide open, AI surfaces that faster than anyone. A strong, secure foundation is what makes AI useful,
                and what keeps it safe.
              </p>
            </aside>
          </div>
        </Container>
      </Chapter>

      <Chapter tone="surface" aria-labelledby="budget-cuts">
        <Container>
          <ChapterHeader
            tone="surface"
            eyebrow="The budget"
            title="AI budgets are cutting the things that keep you running"
            titleId="budget-cuts"
            lede="An AI line item has to be paid for somewhere. When it comes out of the basics, the risk doesn't disappear. It moves to your team, your clients and the next bad day."
          />
          <FeatureGrid tone="surface" columns={4} items={budgetCuts} />
        </Container>
      </Chapter>

      <Chapter tone="paper" aria-labelledby="right-order">
        <Container>
          <ChapterHeader
            tone="paper"
            eyebrow="The order that works"
            title="People and operations first. AI second."
            titleId="right-order"
            lede="Each step makes the next one cheaper and safer. Skip ahead and you pay for AI on top of problems it can't solve."
            layout="stack"
          />
          <StepRail tone="paper" steps={order} />
        </Container>
      </Chapter>

      <Chapter tone="well" aria-labelledby="where-to-start">
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="Where DE fits"
            title="We help with AI. We won’t sell it as a substitute for the basics."
            titleId="where-to-start"
            lede="Start where your business actually is: the foundation, the operating model, or the AI your team is already using."
          />
          <FeatureGrid tone="well" columns={3} items={nextSteps} />
        </Container>
      </Chapter>

      <FaqChapter faqs={faqs} title="Questions about AI and your IT priorities" />

      <ClosingCta
        tone="surface"
        title="Fund the foundation first."
        lede="Find out what is slowing your team down and what would stop your business on a bad day. Then decide where AI fits."
      />
    </PageTemplate>
  );
}
