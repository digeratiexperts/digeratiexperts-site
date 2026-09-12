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
  Bookmark,
  BookMarked,
  List,
  X,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import ebookCover from "@/assets/images/ebook-defending-digital-realm-cover.png";
import { ConversionPathBar } from "@/components/ConversionPathBar";
import { CTA } from "@/lib/ctaCopy";

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
      "Case Study: The Wake-Up Call.",
      "A mid-sized manufacturing company in Arizona believed they were too small to be a target. Their IT infrastructure had grown organically over 15 years, with minimal security oversight. When they finally conducted their first risk assessment, they discovered: 147 devices connected to their network—40 more than they knew existed; 23 systems running outdated, unpatched software; no multi-factor authentication on their email or financial systems; and backup systems that hadn't been tested in over two years.",
      "Three months after the assessment, they successfully defended against a ransomware attack that had encrypted files at a competitor. The difference? They had addressed their critical vulnerabilities.",
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

        <div className="bg-gradient-to-br from-[#D3126A]/10 to-[#D3126A]/5 border-2 border-[#D3126A] rounded-xl p-6 my-8">
          <h4 className="text-xl font-bold text-de-accent-ink mb-4">Case Study: The Wake-Up Call</h4>
          <div className="text-white/75 space-y-4">
            <p>
              A mid-sized manufacturing company in Arizona believed they were "too small to be a target." Their IT infrastructure had grown organically over 15 years, with minimal security oversight. When they finally conducted their first risk assessment, they discovered:
            </p>
            <ul className="list-disc ml-6 space-y-2">
              <li><strong className="text-de-accent-ink">147 devices</strong> connected to their network—40 more than they knew existed</li>
              <li><strong className="text-de-accent-ink">23 systems</strong> running outdated, unpatched software</li>
              <li><strong className="text-de-accent-ink">No multi-factor authentication</strong> on their email or financial systems</li>
              <li><strong className="text-de-accent-ink">Backup systems</strong> that hadn't been tested in over two years</li>
            </ul>
            <p>
              Three months after the assessment, they successfully defended against a ransomware attack that had encrypted files at a competitor. The difference? They had addressed their critical vulnerabilities.
            </p>
          </div>
        </div>

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
    subtitle: "What We Find in Most Assessments",
    narrationText: [
      "Chapter 3. Common Vulnerabilities. What We Find in Most Assessments.",
      "After conducting hundreds of risk assessments for Arizona businesses, certain patterns emerge. Understanding these common vulnerabilities can help you identify areas that likely need attention in your own organization.",
      "Weak Authentication: Single-factor authentication remains the norm for many business applications, leaving them vulnerable to credential theft and brute force attacks.",
      "Unpatched Systems: Many organizations struggle to maintain current patches, leaving known vulnerabilities exposed for weeks or months.",
      "Inadequate Backups: Backups exist but are rarely tested. When disaster strikes, organizations discover their backups are incomplete or corrupted.",
      "Poor Network Segmentation: Flat networks allow attackers to move laterally, turning a single compromised device into a complete network breach.",
      "Shadow IT: Employees use unauthorized cloud services and applications, creating data leakage risks and compliance violations.",
      "Insufficient Logging: Many organizations can't answer basic questions about their security events because they lack adequate logging and monitoring.",
      "Case Study: The Email Compromise.",
      "A real estate title company lost 1.2 million dollars when attackers compromised their email system and redirected a closing wire transfer. The post-incident assessment revealed: no multi-factor authentication on email accounts; no email filtering for suspicious attachments or links; no procedures for verifying wire transfer instructions; and no employee training on business email compromise tactics.",
      "Each of these vulnerabilities could have been identified and addressed through a proper risk assessment—at a fraction of the cost of the eventual loss.",
    ].join(" "),
    content: (
      <>
        <p className="text-white/75 mb-6 leading-relaxed">
          After conducting hundreds of risk assessments for Arizona businesses, certain patterns emerge. Understanding these common vulnerabilities can help you identify areas that likely need attention in your own organization.
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

        <div className="bg-gradient-to-br from-[#D3126A]/10 to-[#D3126A]/5 border-2 border-[#D3126A] rounded-xl p-6 my-8">
          <h4 className="text-xl font-bold text-de-accent-ink mb-4">Case Study: The Email Compromise</h4>
          <div className="text-white/75 space-y-4">
            <p>
              A real estate title company lost $1.2 million when attackers compromised their email system and redirected a closing wire transfer. The post-incident assessment revealed:
            </p>
            <ul className="list-disc ml-6 space-y-2">
              <li>No multi-factor authentication on email accounts</li>
              <li>No email filtering for suspicious attachments or links</li>
              <li>No procedures for verifying wire transfer instructions</li>
              <li>No employee training on business email compromise tactics</li>
            </ul>
            <p>
              Each of these vulnerabilities could have been identified and addressed through a proper risk assessment—at a fraction of the cost of the eventual loss.
            </p>
          </div>
        </div>
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

      <main className="de-nav-clear pb-20">
        <div className="container mx-auto px-4 max-w-7xl">
          <Link href="/resources/blog" className="inline-flex items-center text-de-accent-ink hover:text-de-accent-ink mb-6 transition-colors" data-testid="link-back-blog">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Resources
          </Link>

          {showCover ? (
            <motion.div 
              className="text-center py-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div 
                className="max-w-md mx-auto mb-8 perspective-1000"
                whileHover={{ scale: 1.02, rotateY: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <img 
                  src={ebookCover} 
                  alt="Defending the Digital Realm ebook cover" 
                  loading="eager"
                  decoding="async"
                  width={448}
                  height={580}
                  className="w-full rounded-xl shadow-2xl shadow-none border border-[#D3126A]/30"
                  style={{ 
                    boxShadow: '0 25px 50px -12px rgba(211, 18, 106, 0.18), 0 0 0 1px rgba(211, 18, 106, 0.12), inset 0 0 0 1px rgba(255,255,255,0.05)'
                  }}
                  data-testid="img-ebook-cover"
                />
              </motion.div>
              <Badge className="mb-4 bg-gradient-to-r from-[#D3126A]/20 to-[#D3126A]/10 text-de-accent-ink border-[#D3126A]/30 px-4 py-1">
                Free Ebook
              </Badge>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Defending the Digital Realm
              </h1>
              <p className="text-xl text-white/70 mb-2">
                A Cyber Risk Assessment Framework for Modern Businesses
              </p>
              <p className="text-white/50 mb-8">Joe Petro — Founder, Digerati Experts</p>
              
              <div className="flex flex-wrap justify-center items-center gap-4 mb-8">
                <Button 
                  onClick={() => setShowCover(false)}
                  className="bg-[#D3126A] text-white font-bold px-8 py-6 text-lg hover:shadow-xl hover:shadow-[#D3126A]/20 hover:-translate-y-1 transition-all"
                  data-testid="button-start-reading"
                >
                  <BookOpen className="mr-2 h-5 w-5" />
                  Start Reading
                </Button>
                <Button
                  variant="outline"
                  className="border-[#D3126A]/40 text-de-accent-ink hover:bg-[#D3126A]/10 px-6 py-6"
                  onClick={() => window.print()}
                  data-testid="button-download"
                >
                  <Download className="mr-2 h-5 w-5" />
                  Save as PDF
                </Button>
              </div>
              <div className="flex justify-center mb-10">
                <div className="flex flex-col items-center gap-2">
                  <p className="text-xs uppercase tracking-wider text-white/55">
                    Read Chapter 1 to you
                  </p>
                  <BlogAudioPlayer
                    key="ebook-cover-ch1"
                    title={`${chapters[0].title} — Defending the Digital Realm`}
                    text={chapters[0].narrationText}
                    wordCount={countWords(chapters[0].narrationText)}
                  />
                </div>
              </div>

              <div className="mt-12 grid md:grid-cols-3 gap-6 text-left">
                {[
                  { title: "6 Chapters", desc: "Comprehensive coverage of risk assessment fundamentals", icon: "📚" },
                  { title: "Practical scenarios", desc: "Common patterns Arizona businesses run into", icon: "📊" },
                  { title: "Actionable Roadmap", desc: "90-day plan to improve your security posture", icon: "🗺️" }
                ].map((item, idx) => (
                  <motion.div 
                    key={idx}
                    className="rounded-xl border border-de-hairline bg-de-raised p-6 transition-colors hover:border-[#D3126A]/30"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + idx * 0.1 }}
                  >
                    <span className="text-2xl mb-3 block">{item.icon}</span>
                    <h3 className="text-lg font-bold text-de-accent-ink mb-2">{item.title}</h3>
                    <p className="text-white/60 text-sm">{item.desc}</p>
                  </motion.div>
                ))}
              </div>

              <div className="mt-12">
                <ConversionPathBar
                  headline="Ready to assess your environment?"
                  body="Use this framework with a Digerati Cyber Risk Assessment — not a generic checklist."
                />
              </div>
            </motion.div>
          ) : (
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
          )}
        </div>
      </main>

      <DigeratiEnhancedFooterSection />
    </div>
  );
}
