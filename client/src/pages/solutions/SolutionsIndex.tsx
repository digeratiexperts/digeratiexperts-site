import { motion, useReducedMotion } from "framer-motion";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "../sections/DigeratiEnhancedFooterSection";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle, ArrowRight, Shield, Headphones, Wifi, Monitor, 
  Activity, RefreshCw, Lock, Users, Cloud, FileCheck, Zap, 
  BarChart3, Clock, Phone, Award
} from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { pricing, getPricingFooterText } from "@/data/pricing";

const SolutionsIndex = () => {
  const prefersReducedMotion = useReducedMotion();

  useSEO({
    title: 'Managed IT & Security Solutions',
    description: 'Comprehensive managed IT and cybersecurity solutions. Network security, endpoint protection, cloud security, compliance support, and 24/7 monitoring for Arizona businesses.',
    canonical: '/solutions',
  });

  const plans = [
    {
      name: pricing.office.name,
      tier: pricing.office.tier,
      price: pricing.office.user,
      description: "A clean, managed IT baseline for businesses ready to get organized.",
      highlight: false,
      features: [
        "Email + Calendar + Team Chat",
        "MFA + SSO + Password Manager",
        "Endpoint Security (EDR)",
        "Email Protection (Anti-Phishing)",
        "Managed Network + Internet",
        "Service Desk + Backup Strategy"
      ]
    },
    {
      name: pricing.business.name,
      tier: pricing.business.tier,
      price: pricing.business.user,
      description: "Adds stronger protection, 24/7 monitoring, and proactive threat response.",
      highlight: true,
      features: [
        "Everything in Office",
        "SOC / MDR Monitoring + Response",
        "SMART HR + Onboarding Workflows",
        "Security Awareness Training",
        "vCIO + Technology Business Reviews",
        "Cyber Insurance Readiness"
      ]
    },
    {
      name: pricing.enterprise.name,
      tier: pricing.enterprise.tier,
      price: pricing.enterprise.user,
      description: "Full governance, audit readiness, and regulatory compliance support.",
      highlight: false,
      features: [
        "Everything in Business",
        "HIPAA / GDPR Compliance Modules",
        "Penetration Testing (scoped)",
        "Disaster Recovery Runbooks",
        "Privileged Access + Audit Logs",
        "AI & Cloud Automation"
      ]
    }
  ];

  const foundationServices = [
    {
      icon: Headphones,
      title: "Service Desk & Support",
      description: "Fast help for day-to-day issues, questions, and requests—plus escalation when it's more complex. Response times under 15 minutes guaranteed."
    },
    {
      icon: Wifi,
      title: "Managed Network Security",
      description: "We review your router/firewall, Wi-Fi, and switches. Identify risks, provide upgrade timelines, and handle ongoing monitoring, updates, and security settings."
    },
    {
      icon: Monitor,
      title: "Device & User Management",
      description: "We manage users, devices, access, and standard configurations. Onboarding and offboarding handled securely and consistently."
    },
    {
      icon: Activity,
      title: "Monitoring & Maintenance",
      description: "Always-on monitoring and proactive maintenance to reduce downtime. We catch issues before they become problems."
    },
    {
      icon: RefreshCw,
      title: "Updates & Patch Management",
      description: "Operating systems and core apps kept current. Security patches deployed promptly to reduce vulnerability windows."
    },
    {
      icon: Shield,
      title: "Security Settings Management",
      description: "Baseline hardening and secure configuration management. Consistent security posture maintained over time."
    }
  ];

  const securityServices = [
    {
      icon: Lock,
      title: "24/7 SOC Monitoring",
      description: "Security Operations Center with real human analysts watching your environment around the clock.",
      tier: "Business+"
    },
    {
      icon: Zap,
      title: "Threat Detection & Response",
      description: "Advanced EDR with behavioral analysis. We detect, contain, and remediate threats before damage occurs.",
      tier: "Business+"
    },
    {
      icon: Users,
      title: "Security Awareness Training",
      description: "Ongoing phishing simulations and training to turn your staff into your first line of defense.",
      tier: "Business+"
    },
    {
      icon: Cloud,
      title: "Backup & Disaster Recovery",
      description: "Comprehensive backup strategy with tested recovery procedures. Recover in hours, not weeks.",
      tier: "All Plans"
    }
  ];

  const complianceServices = [
    {
      icon: FileCheck,
      title: "HIPAA / GDPR Compliance",
      description: "Full compliance modules with documentation, policies, and technical controls for healthcare and privacy regulations.",
      tier: "Enterprise"
    },
    {
      icon: BarChart3,
      title: "vCIO & Strategy",
      description: "Executive IT guidance on demand. Quarterly business reviews, technology roadmaps, and budget planning.",
      tier: "Business+"
    },
    {
      icon: Award,
      title: "Cyber Insurance Readiness",
      description: "Documentation and controls that satisfy carrier requirements. Lower premiums, better coverage.",
      tier: "Business+"
    },
    {
      icon: Shield,
      title: "Penetration Testing",
      description: "Scoped security assessments to identify vulnerabilities before attackers do.",
      tier: "Enterprise"
    }
  ];

  const containerVariants = prefersReducedMotion ? undefined : {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
  };

  const itemVariants = prefersReducedMotion ? undefined : {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <MegaMenu />
      
      <main className="pt-28 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Hero Section */}
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 mb-6">
              <Shield className="w-4 h-4 text-violet-400" />
              <span className="text-sm text-violet-300">Complete IT & Security Solutions</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
              The ProActive{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-violet-300 to-fuchsia-300">
                Ecosystem
              </span>
            </h1>
            <p className="text-xl text-white/70 max-w-3xl mx-auto leading-relaxed">
              Everything your business needs to stay secure, productive, and compliant—all in one monthly subscription. 
              No surprise bills. No nickel-and-diming. Just predictable, professional IT.
            </p>
          </motion.div>

          {/* Pricing Tiers */}
          <motion.section 
            className="mb-20"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Choose Your Plan</h2>
              <p className="text-white/60">All plans include the same foundation. Higher tiers add depth.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {plans.map((plan, index) => (
                <motion.div
                  key={plan.name}
                  variants={itemVariants}
                  className={`relative rounded-2xl p-6 border backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 ${
                    plan.highlight 
                      ? 'bg-violet-500/10 border-violet-500/40 shadow-[0_0_40px_rgba(139,92,246,0.2)]' 
                      : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                  }`}
                  data-testid={`plan-${plan.name.toLowerCase()}`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-violet-600 text-white text-xs font-bold rounded-full">
                      Most Popular
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-lg font-bold text-white">{plan.name}</span>
                    <span className="px-2 py-1 text-xs font-medium bg-white/10 text-white/70 rounded">
                      {plan.tier}
                    </span>
                  </div>
                  
                  <div className="mb-4">
                    <span className="text-4xl font-black text-white">${plan.price}</span>
                    <span className="text-white/50 text-sm ml-2">/ user / month</span>
                  </div>
                  
                  <p className="text-white/60 text-sm mb-6 leading-relaxed">
                    {plan.description}
                  </p>
                  
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span className="text-white/80 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <a href="/book">
                    <Button 
                      className={`w-full ${
                        plan.highlight 
                          ? 'bg-violet-600 hover:bg-violet-500 text-white' 
                          : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                      }`}
                      data-testid={`button-get-${plan.name.toLowerCase()}`}
                    >
                      Get Started
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </a>
                </motion.div>
              ))}
            </div>
            
            <p className="text-center text-white/40 text-sm mt-6">
              {getPricingFooterText()}. Final pricing tailored to your users, sites, and compliance needs.
            </p>
          </motion.section>

          {/* Foundation Services - What's Included in ALL Plans */}
          <motion.section 
            className="mb-20 rounded-2xl p-8 bg-white/[0.02] border border-white/10"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-10">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
                Included in Every Plan
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">ProActive Ecosystem Foundation</h2>
              <p className="text-white/60 max-w-2xl mx-auto">
                Every plan includes these core managed services. This is your baseline—everything you need to run a secure, productive office.
              </p>
            </div>
            
            <motion.div 
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {foundationServices.map((service, index) => (
                <motion.div
                  key={service.title}
                  variants={itemVariants}
                  className="p-5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-violet-500/30 transition-all duration-300"
                  data-testid={`foundation-${index}`}
                >
                  <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center mb-4">
                    <service.icon className="w-5 h-5 text-violet-400" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">{service.title}</h3>
                  <p className="text-white/60 text-sm leading-relaxed">{service.description}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.section>

          {/* Security Services */}
          <motion.section 
            className="mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Security & Protection</h2>
              <p className="text-white/60">Advanced security features for businesses that need more than baseline protection.</p>
            </div>
            
            <motion.div 
              className="grid md:grid-cols-2 gap-5"
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {securityServices.map((service, index) => (
                <motion.div
                  key={service.title}
                  variants={itemVariants}
                  className="flex gap-4 p-5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-violet-500/30 transition-all duration-300"
                  data-testid={`security-${index}`}
                >
                  <div className="w-12 h-12 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <service.icon className="w-6 h-6 text-violet-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-white font-semibold">{service.title}</h3>
                      <span className="px-2 py-0.5 text-xs bg-violet-500/20 text-violet-300 rounded">
                        {service.tier}
                      </span>
                    </div>
                    <p className="text-white/60 text-sm leading-relaxed">{service.description}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.section>

          {/* Compliance & Strategy Services */}
          <motion.section 
            className="mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Compliance & Strategy</h2>
              <p className="text-white/60">Governance, audit readiness, and executive IT guidance for regulated industries.</p>
            </div>
            
            <motion.div 
              className="grid md:grid-cols-2 gap-5"
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {complianceServices.map((service, index) => (
                <motion.div
                  key={service.title}
                  variants={itemVariants}
                  className="flex gap-4 p-5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-violet-500/30 transition-all duration-300"
                  data-testid={`compliance-${index}`}
                >
                  <div className="w-12 h-12 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <service.icon className="w-6 h-6 text-violet-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-white font-semibold">{service.title}</h3>
                      <span className="px-2 py-0.5 text-xs bg-violet-500/20 text-violet-300 rounded">
                        {service.tier}
                      </span>
                    </div>
                    <p className="text-white/60 text-sm leading-relaxed">{service.description}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.section>

          {/* Why Choose Us */}
          <motion.section 
            className="mb-20 rounded-2xl p-8 bg-gradient-to-br from-violet-900/20 to-violet-900/20 border border-violet-500/20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Why Arizona Businesses Choose Us</h2>
            </div>
            
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { icon: Clock, value: "Clear", label: "Response", description: "Know who owns the next step" },
                { icon: Shield, value: "Secure", label: "By Design", description: "Risk considered from the start" },
                { icon: Phone, value: "Human", label: "Support", description: "People you can actually reach" },
                { icon: Award, value: "Right-sized", label: "Recommendations", description: "Assessment before package" }
              ].map((stat, index) => (
                <div key={index} className="text-center p-4">
                  <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center mx-auto mb-3">
                    <stat.icon className="w-6 h-6 text-violet-400" />
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
                  <div className="text-white/80 font-medium text-sm">{stat.label}</div>
                  <div className="text-white/50 text-xs">{stat.description}</div>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Final CTA */}
          <motion.section 
            className="text-center"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Ready to Get Protected?
            </h2>
            <p className="text-white/60 mb-8 max-w-xl mx-auto">
              Schedule a free 15-minute call to discuss your needs. No pressure, no obligation—just honest advice about what your business actually needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/book">
                <Button 
                  size="lg"
                  className="h-14 px-8 text-lg font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/25"
                  data-testid="button-final-cta"
                >
                  Schedule Free Consultation
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </a>
              <a href="tel:[DE_PUBLIC_PHONE]">
                <Button 
                  size="lg"
                  className="h-14 px-8 text-lg font-semibold bg-transparent border-2 border-white/30 text-white hover:bg-white/10 hover:border-white/50"
                  data-testid="button-call-us"
                >
                  <Phone className="w-5 h-5 mr-2" />
                  [DE_PUBLIC_PHONE]
                </Button>
              </a>
            </div>
          </motion.section>

        </div>
      </main>

      <DigeratiEnhancedFooterSection />
    </div>
  );
};

export default SolutionsIndex;
