import { Shield, Users, Server, Building2, HeadphonesIcon, FileCheck } from "lucide-react";
import { motion } from "framer-motion";
import { pricing } from "@/data/pricing";

export default function Ecosystem() {
  const servicePillars = [
    { 
      name: "DE WORKPLACE", 
      icon: Users,
      desc: "SMART HR · SMART Identity · SMART Communications · Team Collaboration",
      details: ["Email + Calendar + Chat", "MFA + SSO + Password Manager", "UCaaS + Video Conferencing", "File Storage + Wiki + Projects"]
    },
    { 
      name: "DE SECURITY", 
      icon: Shield,
      desc: "Email Protection · EDR · SOC/MDR · Security Awareness · DLP",
      details: ["24/7 alert monitoring, on plans that include it", "Endpoint Detection & Response", "Phishing Protection", "Security Logging & Reporting"]
    },
    { 
      name: "DE INFRASTRUCTURE", 
      icon: Server,
      desc: "Managed Network · Firewall · Remote Access · Site Connectivity",
      details: ["Firewall + Switching + Wi-Fi", "ISP Coordination + Failover", "SASE / ZTNA Architecture", "Network Segmentation"]
    },
    { 
      name: "DE SUPPORT", 
      icon: HeadphonesIcon,
      desc: "Service Desk · Vendor Management · Change Requests · Config Mgmt",
      details: ["User Support for DE Systems", "Vendor Escalations", "Standards-Based Configuration", "Access Changes"]
    },
    { 
      name: "DE BACKUP & RECOVERY", 
      icon: Building2,
      desc: "Backup Strategy · Restore Testing · DR Runbooks · Off-site Backup",
      details: ["Endpoints + SaaS Backup", "Verified Restore Testing", "Cold / Warm / Hot Site Planning", "Business Continuity"]
    },
    { 
      name: "DE COMPLIANCE", 
      icon: FileCheck,
      desc: "HIPAA · GDPR · FTC Safeguards · Cyber Insurance · Policy Enforcement",
      details: ["Compliance Modules", "Evidence Support", "Audit-Ready Documentation", "Framework Mapping"]
    },
  ];

  const tiers = [
    { 
      name: pricing.office.name, 
      price: `$${pricing.office.user}`,
      desc: "Core security-first IT for small teams",
      highlights: ["Email + MFA + SSO", "EDR + Email Protection", "Managed Network", "Service Desk + Backup"]
    },
    { 
      name: pricing.business.name, 
      price: `$${pricing.business.user}`,
      desc: "SOC/MDR + SMART HR + vCIO advisory",
      highlights: ["Everything in Office", "SOC / MDR Monitoring", "SMART HR Workflows", "Security Awareness + vCIO"]
    },
    { 
      name: pricing.enterprise.name, 
      price: `$${pricing.enterprise.user}`,
      desc: "Full compliance + advanced controls",
      highlights: ["Everything in Business", "HIPAA/GDPR Modules", "Pen Testing + DR Runbooks", "AI & Cloud Automation"]
    },
  ];

  return (
    <section className="min-h-screen bg-de-bg de-nav-clear px-6 pb-16 text-white">
      <div className="max-w-7xl mx-auto">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">
            ProActive Ecosystem
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Security-first IT built around how your business actually works. Controls, evidence, and operational ownership—not just break-fix.
          </p>
        </motion.div>

        <motion.div 
          className="mb-20"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h2 className="text-2xl font-bold text-center mb-8 text-white">Service Pillars</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {servicePillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.name}
                  className="rounded-2xl border border-de-hairline bg-de-raised p-6 transition-colors hover:border-[#D3126A]/40"
                >
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl border border-de-hairline bg-de-bg mb-4`}>
                    <Icon className="w-6 h-6 text-de-magenta" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{pillar.name}</h3>
                  <p className="text-sm text-gray-400 mb-4">{pillar.desc}</p>
                  <ul className="space-y-1">
                    {pillar.details.map((detail, idx) => (
                      <li key={idx} className="text-xs text-white/70 flex items-center gap-2">
                        <span className="h-1 w-1 rounded-full bg-[#D3126A]" />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <h2 className="text-2xl font-bold text-center mb-8 text-white">Package Tiers</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {tiers.map((tier, index) => (
              <div
                key={tier.name}
                className="flex flex-col rounded-2xl border border-de-hairline bg-de-raised p-8 transition-colors hover:border-[#D3126A]/40"
              >
                <div className={`inline-block px-4 py-1.5 rounded-lg bg-de-magenta text-white text-sm font-bold mb-4 w-fit`}>
                  {tier.name}
                </div>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-white">{tier.price}</span>
                  <span className="text-gray-400 text-sm">/user avg</span>
                </div>
                <p className="text-gray-300 text-sm mb-6">{tier.desc}</p>
                <ul className="space-y-2 flex-grow">
                  {tier.highlights.map((highlight, idx) => (
                    <li key={idx} className="text-sm text-gray-400 flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#D3126A]" />
                      {highlight}
                    </li>
                  ))}
                </ul>
                <a
                  href="/book"
                  className="mt-6 block w-full rounded-lg border border-[#D3126A] bg-[#D3126A] py-3 text-center font-semibold text-white transition-colors hover:bg-[#b80f5c]"
                >
                  Get My Cyber Risk Assessment
                </a>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.p 
          className="text-center text-sm text-white/70 mt-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          {`Minimums: Office $${pricing.office.siteMin}/site/mo; Business $${pricing.business.siteMin.toLocaleString()}/site/mo; Enterprise $${pricing.enterprise.siteMin.toLocaleString()}/site/mo. Final pricing tailored to your environment.`}
        </motion.p>
      </div>
    </section>
  );
}
