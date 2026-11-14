import { Headphones, KeyRound, Laptop, Mail, ShieldAlert, Wifi } from "lucide-react";
import { PageTemplate } from "@/components/PageTemplate";
import {
  Chapter,
  ChapterHeader,
  ClosingCta,
  Container,
  FaqChapter,
  FeatureGrid,
  HeroActions,
  HeroFacts,
  IndexedList,
  StepRail,
  textLinkClass,
} from "@/components/site/chapters";
import { useSEO } from "@/hooks/useSEO";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { pricing } from "@/data/pricing";

/**
 * Help Desk: paid support for businesses without a ProActive plan, and for work a
 * plan doesn't cover (MSP website research, 2026-11-11: /help-desk was a 404 and the
 * non-managed lane had no page). No price is published here because none exists in
 * the canonical pricing data yet; the page says so plainly and routes to a request.
 * Response-time promises live in agreements (about/Support.tsx), so none are made here.
 */

const WHO = [
  {
    title: "You're not on a DE plan",
    text: "Something broke and you need a technician now, without signing up for managed IT first.",
  },
  {
    title: "It's outside your plan",
    text: "Already a ProActive client? Requests beyond your plan's scope run through Help Desk, quoted before we start.",
  },
  {
    title: "Your IT person needs a hand",
    text: "Overflow, a second opinion, or cover while they're out. Need it every month? That's Co-Managed IT.",
  },
];

const STEPS = [
  {
    title: "Tell us what's wrong",
    text: "Open a ticket, or call. A two-line description is enough to start.",
    meta: "Ticket or phone",
  },
  {
    title: "Join a secure session",
    text: "We send a session link. You approve the connection, and you can end it at any time.",
    meta: "Remote session",
  },
  {
    title: "We fix it and write it down",
    text: "You get what we found, what we changed, and what to watch for next time.",
    meta: "Documented",
  },
];

const HELP_WITH = [
  { icon: KeyRound, title: "Accounts, passwords and MFA", text: "Lockouts, resets, and a new phone for your authenticator." },
  { icon: Mail, title: "Email and Microsoft 365", text: "Mail flow, mailboxes, shared calendars, and licenses." },
  { icon: Laptop, title: "Computers and printers", text: "Slow machines, updates, installs, and the printer that won't." },
  { icon: Wifi, title: "Wi-Fi and connectivity", text: "Dropped connections, VPN trouble, and the office network." },
  { icon: ShieldAlert, title: "Something looks off", text: "A suspicious email, a strange login alert, or a pop-up you didn't expect." },
  { icon: Headphones, title: "How do I…?", text: "Quick answers so your team gets back to work." },
];

const FAQS = [
  {
    question: "Is Help Desk the same as a ProActive plan?",
    answer:
      "No. A ProActive plan is managed IT: day-to-day support, security, and planning under a service agreement. Help Desk is paid, on-request support for businesses without a plan and for work a plan doesn't cover.",
  },
  {
    question: "What does Help Desk cost?",
    answer:
      "We confirm the rate and the expected scope with you before any work starts. Ask for current Help Desk rates when you open your ticket or call.",
  },
  {
    question: "Do you work on Macs as well as Windows?",
    answer: "Yes. Remote sessions run on Windows and macOS.",
  },
  {
    question: "We keep calling. Is there a better option?",
    answer: `Usually, yes. If you need help every month, a ProActive plan covers day-to-day support at a published per-user price (ProActive IT starts at $${pricing.it.user} per user per month), with security built in.`,
  },
  {
    question: "Can you work alongside our own IT person?",
    answer:
      "Yes. For one-off help, use Help Desk. For an ongoing split of duties, Co-Managed IT puts who owns what in writing.",
  },
];

export default function HelpDesk() {
  useSEO({
    title: "IT Help Desk for Arizona Businesses",
    description:
      "Paid, on-request IT support from Digerati Experts for businesses without a managed plan and for work a plan doesn't cover. Open a ticket, join a secure remote session, get it fixed.",
    canonical: "/help-desk",
  });

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Support · Help Desk"
      title="IT help, without the managed plan"
      subtitle="Not on a ProActive plan, or need something your plan doesn't cover? Get a technician on a secure remote session, and a clear path to a plan if you need us often."
      breadcrumbs={[{ label: "Support" }, { label: "Help Desk" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: "Get help now", href: "/support/submit-ticket", testId: "button-helpdesk-ticket" }}
            secondary={{ label: `Call ${PRIMARY_PHONE.display}`, href: PRIMARY_PHONE.telHref, testId: "button-helpdesk-call" }}
          />
        </div>
      }
      heroAside={
        <HeroFacts
          title="Help Desk at a glance"
          rows={[
            { label: "For", value: "Non-managed businesses, and out-of-scope work" },
            { label: "How", value: "Ticket or phone, then a secure remote session" },
            { label: "Billing", value: "Paid support, rate confirmed before work starts" },
            { label: "Next step up", value: "A ProActive plan, published pricing" },
          ]}
        />
      }
    >
      <Chapter tone="paper" seam={false}>
        <Container>
          <ChapterHeader tone="paper" eyebrow="Who it's for" title="Three reasons people call the Help Desk" />
          <div className="mt-10">
            <IndexedList tone="paper" columns={3} items={WHO} />
          </div>
        </Container>
      </Chapter>

      <Chapter tone="well">
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="Get help fast"
            title="From problem to fixed in three steps"
            lede="Start with whatever is fastest for you. A ticket keeps the details in one place; the phone is there when it can't wait."
          />
          <div className="mt-12">
            <StepRail tone="well" steps={STEPS} />
          </div>
          <p className="mt-10 text-base text-white/70">
            Already have a session code?{" "}
            <a href="/support/remote-support" className={textLinkClass("well")} data-testid="link-helpdesk-remote">
              Go to Remote Support
            </a>
          </p>
        </Container>
      </Chapter>

      <Chapter tone="surface">
        <Container>
          <ChapterHeader tone="surface" eyebrow="What we help with" title="The everyday stuff that stops work" />
          <div className="mt-10">
            <FeatureGrid tone="surface" columns={3} items={HELP_WITH} />
          </div>
        </Container>
      </Chapter>

      <Chapter tone="paper">
        <Container>
          <ChapterHeader
            tone="paper"
            eyebrow="Upgrade path"
            title="Calling every month? A plan is the calmer way to run IT."
            lede="ProActive plans put day-to-day support, security, and planning under one agreement, at a published per-user price. Start with a short call and we'll tell you straight whether a plan makes sense."
            link={{ label: "See plans and pricing", href: "/pricing" }}
          />
        </Container>
      </Chapter>

      <FaqChapter faqs={FAQS} title="Help Desk questions" />

      <ClosingCta
        tone="well"
        eyebrow="Need help now"
        title="Tell us what's wrong. We'll take it from there."
        lede="Open a ticket and we'll pick it up, or call if it can't wait."
        primary={{ label: "Open a ticket", href: "/support/submit-ticket", testId: "button-helpdesk-closing" }}
      />
    </PageTemplate>
  );
}
