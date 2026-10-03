import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import { BlogAudioPlayer } from "@/components/BlogAudioPlayer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  ChevronRight, 
  Home, 
  BookOpen, 
  ArrowLeft,
  Download,
  Route as RouteIcon,
  ClipboardList,
  Bookmark,
  BookMarked,
  List,
  X,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import ebookCover from "@/assets/images/ebook-defending-digital-realm-cover.webp";
import { ConversionPathBar } from "@/components/ConversionPathBar";
import { Chapter as SiteChapter, ClosingCta, Container, FactStrip, PageHero } from "@/components/site/chapters";
import { CTA } from "@/lib/ctaCopy";
import { getCyberFact, formatFactSource } from "@/data/cyberAwarenessFacts";

// Industry figures quoted in the chapters come from the sourced facts registry,
// never typed into the copy (docs/CLAIMS-REGISTER.md, "How to add a claim").
const VULN_FACT = getCyberFact("dbir-vuln-exploit-2026");
const HUMAN_FACT = getCyberFact("dbir-human-element-2026");
const SMB_RANSOM_FACT = getCyberFact("dbir-smb-ransomware-victims-2026");
const BEC_FACT = getCyberFact("ic3-bec-losses-2024");

/**
 * The chapters' stories are EXAMPLE scenarios (design/VISUAL_EVIDENCE.md):
 * composites of common findings, not a Digerati Experts client, and labelled
 * so on the page.
 */
function ExampleScenario({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <figure
      data-classification="EXAMPLE"
      className="my-8 rounded-xl border-2 border-[#D3126A] bg-gradient-to-br from-[#D3126A]/10 to-[#D3126A]/5 p-6"
    >
      <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-wider text-white/70">
        Example scenario · not a client
      </p>
      <h4 className="mb-4 text-xl font-bold text-de-accent-ink">{title}</h4>
      <div className="space-y-4 text-white/75">{children}</div>
    </figure>
  );
}

interface Chapter {
  id: number;
  title: string;
  subtitle: string;
  /** Plain text for Listen / TTS (current chapter). */
  narrationText: string;
  content: React.ReactNode;
}

function countWords(text: string): number {
  return (text.match(/[A-Za-z0-9\u00C0-\u024F]+/g) || []).length;
}

const chapters: Chapter[] = [
  {
    id: 1,
    title: "Understanding Cybersecurity Risk Assessment",
    subtitle: "The Foundation of Digital Defense",
    narrationText: [
      "Chapter 1. Understanding Cybersecurity Risk Assessment. The Foundation of Digital Defense.",
      "In today's interconnected world, cybersecurity risk assessment isn't just a technical exercise—it's a business imperative. As digital threats continue to evolve in sophistication and frequency, organizations of all sizes must understand their vulnerabilities and take proactive steps to protect their assets, data, and reputation.",
      "What Is Cybersecurity Risk Assessment?",
      "A cybersecurity risk assessment is a systematic process of identifying, analyzing, and evaluating risks to your organization's information systems and data. It helps you understand what assets you have, what threats they face, what vulnerabilities exist, and what the potential impact of a security incident could be.",
      "Example scenario, not a client: The Wake-Up Call.",
      "Picture a growing Arizona manufacturer that believes it is too small to be a target. Its network has grown for years without anyone owning security. A first risk assessment typically turns up the same things: more devices on the network than anyone has listed; systems missing security updates; no multi-factor authentication on email or the finance system; and backups nobody has tested.",
      `Size is no shield: ${SMB_RANSOM_FACT.metric} ${SMB_RANSOM_FACT.statement}, according to ${formatFactSource(SMB_RANSOM_FACT)}. Each finding has a known fix, and the assessment puts them in order.`,
      "Key Lesson: The organizations that survive cyber attacks aren't necessarily the ones with the biggest budgets—they're the ones that understand their risks and address them systematically.",
    ].join(" "),
    content: (
      <>
        <div className="bg-gradient-to-r from-de-raised to-de-bg border-l-4 border-[#D3126A] p-6 rounded-r-lg mb-8">
          <p className="text-white/90 leading-relaxed">
            In today's interconnected world, cybersecurity risk assessment isn't just a technical exercise—it's a business imperative. As digital threats continue to evolve in sophistication and frequency, organizations of all sizes must understand their vulnerabilities and take proactive steps to protect their assets, data, and reputation.
          </p>
        </div>
        
        <h3 className="text-2xl font-bold text-[#D3126A] mb-4">What Is Cybersecurity Risk Assessment?</h3>
        <p className="text-white/75 mb-6 leading-relaxed">
          A cybersecurity risk assessment is a systematic process of identifying, analyzing, and evaluating risks to your organization's information systems and data. It helps you understand what assets you have, what threats they face, what vulnerabilities exist, and what the potential impact of a security incident could be.
        </p>

        <ExampleScenario title="The Wake-Up Call">
          <p>
            Picture a growing Arizona manufacturer that believes it is "too small to be a target." Its network has grown for years without anyone owning security. A first risk assessment typically turns up the same things:
          </p>
          <ul className="list-disc ml-6 space-y-2">
            <li><strong className="text-de-accent-ink">More devices</strong> on the network than anyone has listed</li>
            <li><strong className="text-de-accent-ink">Systems missing security updates</strong></li>
            <li><strong className="text-de-accent-ink">No multi-factor authentication</strong> on email or the finance system</li>
            <li><strong className="text-de-accent-ink">Backups</strong> nobody has tested</li>
          </ul>
          <p>
            Size is no shield: {SMB_RANSOM_FACT.metric} {SMB_RANSOM_FACT.statement} (
            <a href={SMB_RANSOM_FACT.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {formatFactSource(SMB_RANSOM_FACT)}
            </a>
            ). Each finding has a known fix, and the assessment puts them in order.
          </p>
        </ExampleScenario>

        <div className="bg-de-bg border-l-4 border-[#D3126A] p-5 my-6 rounded-r-lg">
          <p className="text-de-accent-ink font-semibold">
            Key Lesson: The organizations that survive cyber attacks aren't necessarily the ones with the biggest budgets—they're the ones that understand their risks and address them systematically.
          </p>
        </div>
      </>
    )
  },
  {
    id: 2,
    title: "The Risk Assessment Framework",
    subtitle: "A Structured Approach to Security",
    narrationText: [
      "Chapter 2. The Risk Assessment Framework. A Structured Approach to Security.",
      "Effective risk assessment follows a structured framework that ensures no critical areas are overlooked. While various frameworks exist—NIST, ISO 27001, FAIR—they all share common elements that form the foundation of a comprehensive assessment.",
      "Asset Identification: Catalog all hardware, software, data, and processes that support your business operations. You can't protect what you don't know exists.",
      "Threat Identification: Identify potential threat actors and scenarios: external hackers, insider threats, natural disasters, system failures, and human error.",
      "Vulnerability Assessment: Evaluate weaknesses in your systems, processes, and human factors that could be exploited by identified threats.",
      "Impact Analysis: Determine the potential business impact of different security incidents, including financial, operational, legal, and reputational consequences.",
      "Risk Prioritization: Rank risks based on their likelihood and potential impact to focus resources on the most critical areas.",
      "Key Assessment Areas include network security, endpoint protection, identity and access, data protection, and human factors such as security awareness, policies, and incident response training.",
    ].join(" "),
    content: (
      <>
        <p className="text-white/75 mb-6 leading-relaxed">
          Effective risk assessment follows a structured framework that ensures no critical areas are overlooked. While various frameworks exist (NIST, ISO 27001, FAIR), they all share common elements that form the foundation of a comprehensive assessment.
        </p>

        <div className="space-y-4 my-8">
          {[
            { title: "Asset Identification", text: "Catalog all hardware, software, data, and processes that support your business operations. You can't protect what you don't know exists." },
            { title: "Threat Identification", text: "Identify potential threat actors and scenarios: external hackers, insider threats, natural disasters, system failures, and human error." },
            { title: "Vulnerability Assessment", text: "Evaluate weaknesses in your systems, processes, and human factors that could be exploited by identified threats." },
            { title: "Impact Analysis", text: "Determine the potential business impact of different security incidents, including financial, operational, legal, and reputational consequences." },
            { title: "Risk Prioritization", text: "Rank risks based on their likelihood and potential impact to focus resources on the most critical areas." }
          ].map((item, idx) => (
            <div key={idx} className="bg-gradient-to-r from-de-raised to-de-bg border border-de-hairline p-5 rounded-xl border-l-4 border-l-[#D3126A] hover:shadow-lg hover:shadow-none transition-all">
              <h4 className="font-bold text-[#D3126A] mb-2">{item.title}</h4>
              <p className="text-white/60">{item.text}</p>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-br from-de-raised to-de-bg border-2 border-[#D3126A] rounded-xl p-6 my-8">
          <h4 className="text-xl font-bold text-de-accent-ink mb-4">Key Assessment Areas</h4>
          <ul className="space-y-3 text-white/75">
            <li className="flex items-start gap-2">
              <span className="text-[#D3126A]">•</span>
              <span><strong className="text-white">Network Security:</strong> Firewalls, segmentation, intrusion detection, and access controls</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#D3126A]">•</span>
              <span><strong className="text-white">Endpoint Protection:</strong> Antivirus, EDR, patch management, and device encryption</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#D3126A]">•</span>
              <span><strong className="text-white">Identity & Access:</strong> Authentication methods, privilege management, and user lifecycle</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#D3126A]">•</span>
              <span><strong className="text-white">Data Protection:</strong> Encryption, classification, backup, and retention policies</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#D3126A]">•</span>
              <span><strong className="text-white">Human Factors:</strong> Security awareness, policies, and incident response training</span>
            </li>
          </ul>
        </div>
      </>
    )
  },
  {
    id: 3,
    title: "Common Vulnerabilities",
    subtitle: "The Weaknesses Breach Data Keeps Pointing To",
    narrationText: [
      "Chapter 3. Common Vulnerabilities. The Weaknesses Breach Data Keeps Pointing To.",
      `Breach data keeps pointing at the same weaknesses. ${VULN_FACT.metric} ${VULN_FACT.statement}, and ${HUMAN_FACT.metric} ${HUMAN_FACT.statement}, according to ${formatFactSource(VULN_FACT)}. These are the areas a risk assessment checks first.`,
      "Weak Authentication: Single-factor authentication remains the norm for many business applications, leaving them vulnerable to credential theft and brute force attacks.",
      "Unpatched Systems: Many organizations struggle to maintain current patches, leaving known vulnerabilities exposed for weeks or months.",
      "Inadequate Backups: Backups exist but are rarely tested. When disaster strikes, organizations discover their backups are incomplete or corrupted.",
      "Poor Network Segmentation: Flat networks allow attackers to move laterally, turning a single compromised device into a complete network breach.",
      "Shadow IT: Employees use unauthorized cloud services and applications, creating data leakage risks and compliance violations.",
      "Insufficient Logging: Many organizations can't answer basic questions about their security events because they lack adequate logging and monitoring.",
      "Example scenario, not a client: The Email Compromise.",
      "Picture a title company where an attacker signs in to one employee's mailbox, watches a closing, and sends the buyer new wire instructions. The money is gone before anyone calls. Afterwards the gaps are plain: no multi-factor authentication on email; no filtering for suspicious links and attachments; no rule to confirm wire changes by phone; and no training on business email compromise.",
      `It is one of the costliest crimes in the FBI's data: ${BEC_FACT.metric} ${BEC_FACT.statement} in ${BEC_FACT.year}, according to the ${formatFactSource(BEC_FACT)}. Every gap in the list is something a risk assessment finds before an attacker does.`,
    ].join(" "),
    content: (
      <>
        <p className="text-white/75 mb-6 leading-relaxed">
          Breach data keeps pointing at the same weaknesses. {VULN_FACT.metric} {VULN_FACT.statement}, and {HUMAN_FACT.metric} {HUMAN_FACT.statement} (
          <a href={VULN_FACT.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {formatFactSource(VULN_FACT)}
          </a>
          ). These are the areas a risk assessment checks first.
        </p>

        <div className="grid md:grid-cols-2 gap-4 my-8">
          {[
            { title: "Weak Authentication", text: "Single-factor authentication remains the norm for many business applications, leaving them vulnerable to credential theft and brute force attacks." },
            { title: "Unpatched Systems", text: "Many organizations struggle to maintain current patches, leaving known vulnerabilities exposed for weeks or months." },
            { title: "Inadequate Backups", text: "Backups exist but are rarely tested. When disaster strikes, organizations discover their backups are incomplete or corrupted." },
            { title: "Poor Network Segmentation", text: "Flat networks allow attackers to move laterally, turning a single compromised device into a complete network breach." },
            { title: "Shadow IT", text: "Employees use unauthorized cloud services and applications, creating data leakage risks and compliance violations." },
            { title: "Insufficient Logging", text: "Many organizations can't answer basic questions about their security events because they lack adequate logging and monitoring." }
          ].map((item, idx) => (
            <div key={idx} className="bg-gradient-to-br from-de-raised to-de-bg border border-de-hairline p-5 rounded-xl hover:border-[#D3126A]/40 transition-colors">
              <h4 className="font-bold text-[#D3126A] mb-2">{item.title}</h4>
              <p className="text-white/60 text-sm">{item.text}</p>
            </div>
          ))}
        </div>

        <ExampleScenario title="The Email Compromise">
          <p>
            Picture a title company where an attacker signs in to one employee's mailbox, watches a closing, and sends the buyer new wire instructions. The money is gone before anyone calls. Afterwards the gaps are plain:
          </p>
          <ul className="list-disc ml-6 space-y-2">
            <li>No multi-factor authentication on email</li>
            <li>No filtering for suspicious links and attachments</li>
            <li>No rule to confirm wire changes by phone</li>
            <li>No training on business email compromise</li>
          </ul>
          <p>
            It is one of the costliest crimes in the FBI's data: {BEC_FACT.metric} {BEC_FACT.statement} in {BEC_FACT.year} (
            <a href={BEC_FACT.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {formatFactSource(BEC_FACT)}
            </a>
            ). Every gap in the list is something a risk assessment finds before an attacker does.
          </p>
        </ExampleScenario>
      </>
    )
  },
  {
    id: 4,
    title: "Quantifying Risk",
    subtitle: "From Technical Findings to Business Impact",
    narrationText: [
      "Chapter 4. Quantifying Risk. From Technical Findings to Business Impact.",
      "Technical vulnerabilities mean little to business leaders until they're translated into business terms. Effective risk assessment quantifies potential impacts in ways that support decision-making and resource allocation.",
      "The Risk Equation: Risk equals Likelihood times Impact. This simple formula guides all risk prioritization decisions.",
      "Impact Categories include financial impact—direct costs, recovery costs, and ongoing costs; operational impact—downtime, productivity losses, and supply chain disruptions; reputational impact—customer trust and brand damage; and legal and regulatory impact—compliance violations, fines, and litigation.",
      "Pro Tip: When quantifying risk, don't just consider the worst-case scenario. Calculate expected annual loss by multiplying the impact by the annual probability of occurrence. This provides a more realistic basis for investment decisions.",
    ].join(" "),
    content: (
      <>
        <p className="text-white/75 mb-6 leading-relaxed">
          Technical vulnerabilities mean little to business leaders until they're translated into business terms. Effective risk assessment quantifies potential impacts in ways that support decision-making and resource allocation.
        </p>

        <h3 className="text-2xl font-bold text-[#D3126A] mb-4">The Risk Equation</h3>
        <div className="bg-gradient-to-r from-de-raised to-de-bg border border-[#D3126A]/30 rounded-xl p-6 my-6 text-center">
          <p className="text-2xl font-mono text-de-accent-ink">
            Risk = Likelihood × Impact
          </p>
          <p className="text-white/60 mt-2 text-sm">
            This simple formula guides all risk prioritization decisions
          </p>
        </div>

        <h3 className="text-2xl font-bold text-[#D3126A] mb-4 mt-8">Impact Categories</h3>
        <div className="space-y-4 my-6">
          {[
            { title: "Financial Impact", text: "Direct costs (ransom payments, fraud losses), recovery costs (forensics, remediation), and ongoing costs (increased insurance, compliance penalties)." },
            { title: "Operational Impact", text: "Downtime costs, productivity losses, supply chain disruptions, and the resources required for incident response." },
            { title: "Reputational Impact", text: "Customer trust erosion, brand damage, competitive disadvantage, and potential loss of business relationships." },
            { title: "Legal & Regulatory Impact", text: "Compliance violations, regulatory fines, litigation costs, and contractual penalties." }
          ].map((item, idx) => (
            <div key={idx} className="bg-de-bg border-l-4 border-[#D3126A] p-5 rounded-r-lg">
              <h4 className="font-bold text-white mb-2">{item.title}</h4>
              <p className="text-white/60">{item.text}</p>
            </div>
          ))}
        </div>

        <div className="bg-de-bg border-l-4 border-[#D3126A] p-5 my-6 rounded-r-lg">
          <p className="text-de-accent-ink font-semibold">
            Pro Tip: When quantifying risk, don't just consider the worst-case scenario. Calculate expected annual loss (EAL) by multiplying the impact by the annual probability of occurrence. This provides a more realistic basis for investment decisions.
          </p>
        </div>
      </>
    )
  },
  {
    id: 5,
    title: "Building Your Security Roadmap",
    subtitle: "From Assessment to Action",
    narrationText: [
      "Chapter 5. Building Your Security Roadmap. From Assessment to Action.",
      "A risk assessment is only valuable if it leads to action. The assessment findings should inform a prioritized security roadmap that addresses the most critical risks while respecting budget and resource constraints.",
      "Prioritization Principles: Critical items need immediate attention within 24 to 72 hours. High risks should be remediated within 30 days. Medium risks within 90 days. Low items belong in regular maintenance cycles.",
      "Balance your roadmap between quick wins that demonstrate progress and build momentum, and strategic initiatives that address fundamental security gaps.",
      "Sample 90-Day Roadmap. Days 1 to 30: Enable MFA on all critical systems, update endpoint protection, patch critical vulnerabilities. Days 31 to 60: Implement network segmentation, deploy email security, begin security awareness training. Days 61 to 90: Establish backup testing procedures, implement logging and monitoring, develop an incident response plan.",
    ].join(" "),
    content: (
      <>
        <p className="text-white/75 mb-6 leading-relaxed">
          A risk assessment is only valuable if it leads to action. The assessment findings should inform a prioritized security roadmap that addresses the most critical risks while respecting budget and resource constraints.
        </p>

        <h3 className="text-2xl font-bold text-[#D3126A] mb-4">Prioritization Principles</h3>
        <div className="grid md:grid-cols-2 gap-4 my-6">
          <div className="bg-gradient-to-br from-red-900/20 to-slate-900 border border-red-500/30 p-5 rounded-xl">
            <h4 className="font-bold text-red-400 mb-2">Critical (Immediate)</h4>
            <p className="text-white/60 text-sm">High-impact vulnerabilities with known exploits. Address within 24-72 hours.</p>
          </div>
          <div className="bg-gradient-to-br from-orange-900/20 to-slate-900 border border-[#D3126A]/30 p-5 rounded-xl">
            <h4 className="font-bold text-de-accent-ink mb-2">High (Short-term)</h4>
            <p className="text-white/60 text-sm">Significant risks requiring remediation within 30 days.</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-900/20 to-slate-900 border border-yellow-500/30 p-5 rounded-xl">
            <h4 className="font-bold text-yellow-400 mb-2">Medium (Near-term)</h4>
            <p className="text-white/60 text-sm">Moderate risks to address within 90 days.</p>
          </div>
          <div className="bg-gradient-to-br from-blue-900/20 to-slate-900 border border-blue-500/30 p-5 rounded-xl">
            <h4 className="font-bold text-blue-400 mb-2">Low (Planned)</h4>
            <p className="text-white/60 text-sm">Lower-priority items for inclusion in regular maintenance cycles.</p>
          </div>
        </div>

        <h3 className="text-2xl font-bold text-[#D3126A] mb-4 mt-8">Quick Wins vs. Strategic Initiatives</h3>
        <p className="text-white/75 mb-6 leading-relaxed">
          Balance your roadmap between quick wins that demonstrate progress and build momentum, and strategic initiatives that address fundamental security gaps. Quick wins build confidence and organizational support; strategic initiatives create lasting security improvements.
        </p>

        <div className="bg-gradient-to-br from-[#D3126A]/10 to-[#D3126A]/5 border-2 border-[#D3126A] rounded-xl p-6 my-8">
          <h4 className="text-xl font-bold text-de-accent-ink mb-4">Sample 90-Day Roadmap</h4>
          <div className="text-white/75 space-y-3">
            <p><strong className="text-white">Days 1-30:</strong> Enable MFA on all critical systems, update endpoint protection, patch critical vulnerabilities</p>
            <p><strong className="text-white">Days 31-60:</strong> Implement network segmentation, deploy email security, begin security awareness training</p>
            <p><strong className="text-white">Days 61-90:</strong> Establish backup testing procedures, implement logging and monitoring, develop incident response plan</p>
          </div>
        </div>
      </>
    )
  },
  {
    id: 6,
    title: "Conclusion",
    subtitle: "Your Journey to Security Resilience",
    narrationText: [
      "Chapter 6. Conclusion. Your Journey to Security Resilience.",
      "Cybersecurity risk assessment isn't a one-time project—it's an ongoing discipline that should be embedded in your organization's culture and operations. As threats evolve and your business changes, regular reassessment ensures your defenses remain aligned with your actual risks.",
      "Key Takeaways. One: Risk assessment is the foundation of effective cybersecurity—you can't protect what you don't understand. Two: Common vulnerabilities are common for a reason—address the basics before pursuing advanced solutions. Three: Translate technical findings into business impact to gain leadership support and appropriate resources. Four: Prioritize based on risk, not just severity—consider both likelihood and impact. Five: Make assessment an ongoing process, not a one-time event.",
      "Ready to assess your security posture? Digerati Experts offers comprehensive cybersecurity risk assessments designed specifically for Arizona businesses. Schedule your Cyber Risk Assessment at digeratiexperts.com/book.",
    ].join(" "),
    content: (
      <>
        <p className="text-white/75 mb-6 leading-relaxed text-lg">
          Cybersecurity risk assessment isn't a one-time project—it's an ongoing discipline that should be embedded in your organization's culture and operations. As threats evolve and your business changes, regular reassessment ensures your defenses remain aligned with your actual risks.
        </p>

        <div className="bg-gradient-to-br from-de-raised to-de-bg border-2 border-[#D3126A] rounded-xl p-6 my-8">
          <h4 className="text-xl font-bold text-de-accent-ink mb-4">Key Takeaways</h4>
          <ul className="space-y-3 text-white/75">
            <li className="flex items-start gap-2">
              <span className="text-[#D3126A] font-bold">1.</span>
              <span>Risk assessment is the foundation of effective cybersecurity—you can't protect what you don't understand.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#D3126A] font-bold">2.</span>
              <span>Common vulnerabilities are common for a reason—address the basics before pursuing advanced solutions.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#D3126A] font-bold">3.</span>
              <span>Translate technical findings into business impact to gain leadership support and appropriate resources.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#D3126A] font-bold">4.</span>
              <span>Prioritize based on risk, not just severity—consider both likelihood and impact.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#D3126A] font-bold">5.</span>
              <span>Make assessment an ongoing process, not a one-time event.</span>
            </li>
          </ul>
        </div>

        <div className="bg-[#D3126A] text-white p-8 rounded-xl my-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
          <div className="relative z-10">
            <h3 className="text-2xl font-bold mb-3">Ready to Assess Your Security Posture?</h3>
            <p className="mb-6 opacity-95">
              Digerati Experts offers comprehensive cybersecurity risk assessments designed specifically for Arizona businesses.
            </p>
            <a 
              href="/book"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-white text-[#D3126A] font-bold px-8 py-3 rounded-lg hover:shadow-lg hover:-translate-y-1 transition-all"
            >
              {CTA.primary}
            </a>
          </div>
        </div>

        <div className="text-center mt-12 pt-8 border-t border-de-hairline">
          <p className="text-white/60 text-sm">
            © {new Date().getFullYear()} Digerati Experts. All rights reserved.
          </p>
          <p className="text-white/55 text-sm mt-2">
            Joe Petro — Founder, Digerati Experts
          </p>
        </div>
      </>
    )
  }
];

export default function Ebook() {
  const [currentChapter, setCurrentChapter] = useState(0);
  const [showCover, setShowCover] = useState(true);
  const [showTOC, setShowTOC] = useState(false);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [readProgress, setReadProgress] = useState(0);
  const [fontSize, setFontSize] = useState(19);
  const [pageDirection, setPageDirection] = useState<'left' | 'right'>('right');

  // Track reading progress
  useEffect(() => {
    if (!showCover) {
      const progress = ((currentChapter + 1) / chapters.length) * 100;
      setReadProgress(progress);
    }
  }, [currentChapter, showCover]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showCover) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        nextChapter();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        prevChapter();
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToChapter(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goToChapter(chapters.length - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCover, currentChapter]);

  const goToChapter = useCallback((index: number) => {
    setPageDirection(index > currentChapter ? 'right' : 'left');
    setCurrentChapter(index);
    setShowCover(false);
    setShowTOC(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentChapter]);

  const nextChapter = useCallback(() => {
    if (currentChapter < chapters.length - 1) {
      setPageDirection('right');
      goToChapter(currentChapter + 1);
    }
  }, [currentChapter, goToChapter]);

  const prevChapter = useCallback(() => {
    if (currentChapter > 0) {
      setPageDirection('left');
      goToChapter(currentChapter - 1);
    }
  }, [currentChapter, goToChapter]);

  const toggleBookmark = (chapterIndex: number) => {
    setBookmarks(prev => 
      prev.includes(chapterIndex) 
        ? prev.filter(b => b !== chapterIndex)
        : [...prev, chapterIndex]
    );
  };

  const isBookmarked = bookmarks.includes(currentChapter);

  const chapterAudioText = useMemo(() => {
    const chapter = chapters[currentChapter];
    return chapter?.narrationText ?? "";
  }, [currentChapter]);

  const chapterWordCount = useMemo(
    () => countWords(chapterAudioText),
    [chapterAudioText],
  );

  const pageVariants = {
    enter: (direction: 'left' | 'right') => ({
      x: direction === 'right' ? 100 : -100,
      opacity: 0,
      rotateY: direction === 'right' ? 5 : -5,
    }),
    center: {
      x: 0,
      opacity: 1,
      rotateY: 0,
    },
    exit: (direction: 'left' | 'right') => ({
      x: direction === 'right' ? -100 : 100,
      opacity: 0,
      rotateY: direction === 'right' ? -5 : 5,
    }),
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Helmet>
        <title>Defending the Digital Realm - Free Ebook | Digerati Experts</title>
        <meta name="description" content="A cyber risk assessment framework for modern businesses by Joe Petro, Founder of Digerati Experts. Learn how to protect your Arizona business from digital threats." />
        <meta property="og:title" content="Defending the Digital Realm - Free Cybersecurity Ebook" />
        <meta property="og:description" content="A cyber risk assessment framework for modern businesses. Protect your Arizona business from digital threats." />
        <meta property="og:type" content="book" />
        <meta property="og:image" content={ebookCover} />
      </Helmet>

      <MegaMenu />

      {/* Reading Progress Bar */}
      {!showCover && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-de-bg">
          <motion.div 
            className="h-full bg-[#D3126A]"
            initial={{ width: 0 }}
            animate={{ width: `${readProgress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}

      <main className={showCover ? "" : "de-nav-clear pb-20"}>
        {showCover && (
          <>
            <PageHero
              eyebrow="Free Ebook"
              breadcrumbs={[{ label: "Resources", href: "/resources" }, { label: "Defending the Digital Realm" }]}
              title="Defending the Digital Realm"
              lede="A Cyber Risk Assessment Framework for Modern Businesses"
              aside={
                <div className="mx-auto max-w-xs lg:ml-auto lg:mr-0">
                  <img
                    src={ebookCover}
                    alt="Defending the Digital Realm ebook cover"
                    loading="eager"
                    decoding="async"
                    width={448}
                    height={580}
                    className="w-full rounded-xl border border-white/10 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)]"
                    data-testid="img-ebook-cover"
                  />
                </div>
              }
              asideOnMobile
              actions={
                <>
                  <Button
                    onClick={() => setShowCover(false)}
                    className="min-h-12 bg-[#D3126A] px-7 text-base font-semibold text-white hover:bg-[#b80f5c]"
                    data-testid="button-start-reading"
                  >
                    <BookOpen className="mr-2 h-5 w-5" aria-hidden="true" />
                    Start Reading
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-12 border-white/25 bg-transparent px-6 text-base text-white hover:bg-white/10 hover:text-white"
                    onClick={() => window.print()}
                    data-testid="button-download"
                  >
                    <Download className="mr-2 h-5 w-5" aria-hidden="true" />
                    Save as PDF
                  </Button>
                </>
              }
              note="Joe Petro — Founder, Digerati Experts"
            />

            <FactStrip
              label="Inside the ebook"
              facts={[
                { icon: BookOpen, title: "6 Chapters", text: "Comprehensive coverage of risk assessment fundamentals" },
                { icon: ClipboardList, title: "Practical scenarios", text: "Common patterns Arizona businesses run into" },
                { icon: RouteIcon, title: "Actionable Roadmap", text: "90-day plan to improve your security posture" },
              ]}
            />

            <SiteChapter tone="well" seam={false}>
              <Container>
                <div className="grid items-center gap-6 lg:grid-cols-12 lg:gap-14">
                  <div className="lg:col-span-5">
                    <h2 className="font-heading text-2xl font-semibold tracking-[-0.02em] text-white md:text-3xl">
                      Read Chapter 1 to you
                    </h2>
                  </div>
                  <div className="lg:col-span-7">
                    <BlogAudioPlayer
                      key="ebook-cover-ch1"
                      title={`${chapters[0].title} — Defending the Digital Realm`}
                      text={chapters[0].narrationText}
                      wordCount={countWords(chapters[0].narrationText)}
                    />
                  </div>
                </div>
              </Container>
            </SiteChapter>

            <ClosingCta
              tone="paper"
              eyebrow="Next step"
              title="Ready to assess your environment?"
              lede="Use this framework with a DE Cyber Risk Assessment — not a generic checklist."
              primary={{ label: CTA.primary, href: "/book", testId: "button-conversion-assessment" }}
            />
          </>
        )}

        {!showCover && (
        <div className="container mx-auto px-4 max-w-7xl">
          <Link href="/resources/blog" className="mb-4 inline-flex min-h-11 items-center text-de-accent-ink transition-colors hover:text-white" data-testid="link-back-blog">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Back to Resources
          </Link>

            <div className="relative">
              {/* Table of Contents Sidebar */}
              <AnimatePresence>
                {showTOC && (
                  <motion.div
                    initial={{ opacity: 0, x: -300 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -300 }}
                    className="fixed left-0 top-0 bottom-0 w-80 bg-de-bg border-r border-de-hairline z-50 pt-20 overflow-y-auto"
                  >
                    <div className="p-6">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-white">Table of Contents</h3>
                        <button 
                          onClick={() => setShowTOC(false)}
                          className="text-white/60 hover:text-white transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {chapters.map((chapter, idx) => (
                          <button
                            key={chapter.id}
                            onClick={() => goToChapter(idx)}
                            className={`w-full text-left p-4 rounded-xl transition-all ${
                              currentChapter === idx
                                ? 'bg-gradient-to-r from-[#D3126A]/20 to-[#D3126A]/10 border-l-4 border-[#D3126A] text-white'
                                : 'hover:bg-white/5 text-white/60 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`font-mono text-sm ${currentChapter === idx ? 'text-de-accent-ink' : 'text-white/55'}`}>
                                {String(chapter.id).padStart(2, '0')}
                              </span>
                              <div>
                                <p className="font-medium text-sm">{chapter.title}</p>
                                <p className="text-xs text-white/55 mt-1">{chapter.subtitle}</p>
                              </div>
                              {bookmarks.includes(idx) && (
                                <BookMarked className="w-4 h-4 text-de-accent-ink ml-auto" />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main Reader */}
              <div className="bg-gradient-to-b from-de-raised via-de-raised to-de-bg rounded-3xl shadow-2xl overflow-hidden border border-[#D3126A]/20 relative" 
                style={{ boxShadow: '0 25px 100px -20px rgba(0,0,0,0.6), 0 0 80px rgba(211, 18, 106, 0.08), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
                
                {/* Decorative glow effect */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-1 bg-gradient-to-r from-transparent via-[#D3126A]/50 to-transparent" />
                
                {/* Enhanced Chapter Navigation Bar */}
                <div className="bg-gradient-to-b from-de-raised to-de-raised border-b border-de-hairline sticky top-16 z-30">
                  <div className="flex items-center justify-between px-2 py-1">
                    <div className="flex items-center">
                      <button
                        onClick={() => setShowTOC(true)}
                        className="p-3 text-white/60 hover:text-de-accent-ink hover:bg-[#D3126A]/10 rounded-lg transition-all mr-1"
                        title="Table of Contents"
                        data-testid="button-toc"
                      >
                        <List className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setShowCover(true)}
                        className="p-3 text-white/60 hover:text-de-accent-ink hover:bg-[#D3126A]/10 rounded-lg transition-all"
                        data-testid="button-cover"
                        title="Cover"
                      >
                        <Home className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <div className="flex overflow-x-auto scrollbar-hide">
                      {chapters.map((chapter, idx) => (
                        <button
                          key={chapter.id}
                          onClick={() => goToChapter(idx)}
                          className={`relative px-5 py-3 text-sm font-medium whitespace-nowrap transition-all ${
                            currentChapter === idx
                              ? 'text-de-accent-ink'
                              : 'text-white/60 hover:text-white'
                          }`}
                          data-testid={`button-chapter-${chapter.id}`}
                        >
                          Ch. {chapter.id}
                          {currentChapter === idx && (
                            <motion.div 
                              layoutId="activeChapter"
                              className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D3126A]"
                            />
                          )}
                          {bookmarks.includes(idx) && currentChapter !== idx && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-[#D3126A] rounded-full" />
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setFontSize(prev => Math.max(14, prev - 2))}
                        className="p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                        title="Decrease font size"
                      >
                        <ZoomOut className="w-4 h-4" />
                      </button>
                      <span className="text-xs text-white/55 w-8 text-center">{fontSize}</span>
                      <button
                        onClick={() => setFontSize(prev => Math.min(28, prev + 2))}
                        className="p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                        title="Increase font size"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleBookmark(currentChapter)}
                        className={`p-2 rounded-lg transition-all ${
                          isBookmarked 
                            ? 'text-de-accent-ink bg-[#D3126A]/10' 
                            : 'text-white/60 hover:text-de-accent-ink hover:bg-[#D3126A]/10'
                        }`}
                        title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
                        data-testid="button-bookmark"
                      >
                        {isBookmarked ? <BookMarked className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-center px-4 pb-3 border-t border-de-hairline">
                    <BlogAudioPlayer
                      key={`ebook-audio-${currentChapter}`}
                      title={`${chapters[currentChapter].title} — Defending the Digital Realm`}
                      text={chapterAudioText}
                      wordCount={chapterWordCount}
                    />
                  </div>
                </div>

                {/* Chapter Content with Page Effect */}
                <AnimatePresence mode="wait" custom={pageDirection}>
                  <motion.div
                    key={currentChapter}
                    custom={pageDirection}
                    variants={pageVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="p-8 md:p-16 lg:p-20 min-h-[700px]"
                    style={{ fontSize: `${fontSize}px`, lineHeight: '1.8' }}
                  >
                    {/* Page Header */}
                    <div className="flex items-center justify-between mb-6">
                      <Badge className="bg-gradient-to-r from-[#D3126A]/20 to-[#D3126A]/10 text-de-accent-ink border-[#D3126A]/30 font-mono">
                        CHAPTER {chapters[currentChapter].id}
                      </Badge>
                      <span className="text-xs text-white/55 font-mono">
                        Page {currentChapter + 1} of {chapters.length}
                      </span>
                    </div>

                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
                      {chapters[currentChapter].title}
                    </h1>
                    <p className="text-xl md:text-2xl text-white/60 mb-12 pb-8 border-b border-de-hairline">
                      {chapters[currentChapter].subtitle}
                    </p>
                    
                    <div className="prose prose-invert prose-lg md:prose-xl max-w-none prose-headings:text-white prose-p:text-white/75 prose-strong:text-de-accent-ink prose-li:text-white/75" data-testid="ebook-content">
                      {chapters[currentChapter].content}
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Enhanced Navigation Footer */}
                <div className="bg-gradient-to-t from-de-bg to-transparent border-t border-de-hairline p-6">
                  <div className="flex justify-between items-center">
                    <Button
                      onClick={prevChapter}
                      disabled={currentChapter === 0}
                      variant="outline"
                      className="border-de-hairline text-white/75 hover:text-white hover:bg-white/5 hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed px-6 py-5 group transition-all"
                      data-testid="button-prev-chapter"
                    >
                      <ChevronLeft className="mr-2 h-5 w-5 group-hover:-translate-x-1 transition-transform" />
                      Previous
                    </Button>
                    
                    <div className="flex items-center gap-3">
                      {chapters.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => goToChapter(idx)}
                          className={`w-3 h-3 rounded-full transition-all ${
                            currentChapter === idx
                              ? 'bg-[#D3126A] scale-125'
                              : 'bg-white/20 hover:bg-white/35'
                          }`}
                          data-testid={`page-dot-${idx}`}
                        />
                      ))}
                    </div>
                    
                    <Button
                      onClick={nextChapter}
                      disabled={currentChapter === chapters.length - 1}
                      className="bg-[#D3126A] text-white hover:shadow-lg hover:shadow-[#D3126A]/20 disabled:opacity-30 disabled:cursor-not-allowed px-6 py-5 group transition-all"
                      data-testid="button-next-chapter"
                    >
                      Next
                      <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                  
                  {/* Page indicator */}
                  <div className="text-center mt-4">
                    <span className="text-sm text-white/55 font-mono">
                      {currentChapter + 1} of {chapters.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
        </div>
        )}
      </main>

      <DigeratiEnhancedFooterSection />
    </div>
  );
}
