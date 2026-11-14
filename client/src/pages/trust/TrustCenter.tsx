import { PageTemplate } from "@/components/PageTemplate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, FileCheck, Award, Eye, Server, CheckCircle, Mail, Phone } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

export default function TrustCenter() {
  const prefersReducedMotion = useReducedMotion() ?? false;
  
  const assuranceAreas = [
    { icon: Award, title: "Security Documentation", desc: "Architecture notes, control summaries, and vendor questionnaires scoped to the services you use", status: "By Request", gradient: "from-violet-500 to-purple-600" },
    { icon: FileCheck, title: "HIPAA Readiness", desc: "Practical safeguards, documentation support, and Business Associate Agreement review for healthcare environments", status: "Supported", gradient: "from-purple-500 to-fuchsia-600" },
    { icon: Lock, title: "Cyber Insurance Readiness", desc: "Evidence gathering and control planning for common insurer requirements and renewal questions", status: "Supported", gradient: "from-fuchsia-500 to-pink-600" }
  ];

  const technicalControls = [
    "Encryption for data at rest and in transit",
    "Multi-factor authentication and conditional access",
    "Endpoint monitoring and response workflows",
    "Network segmentation and secure configuration",
    "Vulnerability identification and prioritization",
    "Backup protection and recovery validation"
  ];

  const adminControls = [
    "Security awareness and role-based training",
    "Incident response roles and procedures",
    "Access reviews and joiner-mover-leaver processes",
    "Vendor and third-party risk documentation",
    "Policy ownership and evidence collection",
    "Framework mapping when the business requires it"
  ];

  return (
    <PageTemplate
      title="Trust Center"
      subtitle="Clear information about security, compliance support, and the evidence available to clients"
      icon={<Shield className="w-10 h-10 text-white" />}
      gradientColors="from-slate-700 via-slate-800 to-slate-900"
      breadcrumbs={[{ label: "Trust", href: "/" }, { label: "Trust Center" }]}
    >
      <div className="space-y-16">
        {/* Intro */}
        <motion.p 
          className="text-xl text-gray-300 text-center max-w-3xl mx-auto leading-relaxed"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          Trust should come from clear answers and evidence—not a wall of badges. This center explains the control areas we help with and how to request documentation relevant to your environment.
        </motion.p>

        {/* Assurance areas */}
        <div className="grid md:grid-cols-3 gap-6">
          {assuranceAreas.map((area, idx) => {
            const Icon = area.icon;
            return (
              <motion.div
                key={idx}
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1, duration: 0.5 }}
              >
                <Card className="group h-full bg-white/5 backdrop-blur-sm border border-white/10 hover:border-purple-500/50 hover:shadow-xl transition-all duration-300 overflow-hidden">
                  <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${area.gradient} opacity-10 rounded-bl-full`} />
                  <CardHeader>
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${area.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                    <CardTitle className="text-xl text-white">{area.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-400 mb-4 leading-relaxed">{area.desc}</p>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {area.status}
                    </Badge>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Security Practices */}
        <motion.div 
          className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12 overflow-hidden"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-purple-500/20 to-transparent rounded-full blur-3xl" />
          
          <div className="relative">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white">Control Areas We Review</h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-violet-400" />
                  Technical Controls
                </h3>
                <div className="space-y-3">
                  {technicalControls.map((control, idx) => (
                    <motion.div 
                      key={idx}
                      className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10"
                      initial={prefersReducedMotion ? {} : { opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.05, duration: 0.3 }}
                    >
                      <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      <span className="text-gray-300">{control}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-violet-400" />
                  Administrative Controls
                </h3>
                <div className="space-y-3">
                  {adminControls.map((control, idx) => (
                    <motion.div 
                      key={idx}
                      className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10"
                      initial={prefersReducedMotion ? {} : { opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.05, duration: 0.3 }}
                    >
                      <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      <span className="text-gray-300">{control}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Infrastructure Security */}
        <motion.div 
          className="bg-white/5 backdrop-blur-sm border-l-4 border-violet-500 border border-white/10 rounded-xl p-8"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center">
              <Server className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Infrastructure Questions We Help Answer</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { label: "Hosting", value: "Where data lives, which provider controls apply, and what evidence is available" },
              { label: "Network Security", value: "Firewall policy, segmentation, remote access, and exposure management" },
              { label: "Access Controls", value: "Role-based access, least privilege, and accountable administrative access" },
              { label: "Monitoring", value: "Which signals are collected, who reviews them, and how escalation works" },
              { label: "Backups", value: "What is protected, where copies live, and how recovery is validated" }
            ].map((item, idx) => (
              <div key={idx} className="p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                <span className="font-semibold text-white">{item.label}:</span>{" "}
                <span className="text-gray-300">{item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Privacy & Data Protection */}
        <motion.div 
          className="bg-white/5 backdrop-blur-sm border-l-4 border-purple-500 border border-white/10 rounded-xl p-8"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Privacy & Data Protection</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { label: "Privacy Policy", value: "Comprehensive privacy practices aligned with Arizona data breach laws" },
              { label: "Data Minimization", value: "We collect only data necessary for service delivery" },
              { label: "Data Retention", value: "Clear retention schedules and secure deletion procedures" },
              { label: "Client Rights", value: "Access, correction, deletion, and portability rights" },
              { label: "No Data Selling", value: "We never sell client data to third parties" }
            ].map((item, idx) => (
              <div key={idx} className="p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                <span className="font-semibold text-white">{item.label}:</span>{" "}
                <span className="text-gray-300">{item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div 
          className="relative rounded-2xl overflow-hidden"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600" />
          <div className="absolute inset-0 opacity-20">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="trust-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#trust-grid)" />
            </svg>
          </div>
          
          <div className="relative p-8 md:p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Need Security Documentation?</h2>
            <p className="text-lg md:text-xl mb-8 text-white/90 max-w-2xl mx-auto">
              Request a security overview, service-specific control information, or help completing a vendor questionnaire.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="mailto:security@digeratiexperts.com?subject=Security Documentation Request"
                className="group inline-flex items-center justify-center bg-white text-purple-700 hover:bg-purple-50 px-8 py-4 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl hover:scale-105"
                data-testid="button-request-docs"
              >
                <Mail className="mr-2 h-5 w-5" />
                Request Documentation
              </a>
              <a 
                href="tel:[DE_PUBLIC_PHONE]"
                className="inline-flex items-center justify-center border-2 border-white bg-white/10 backdrop-blur-sm text-white hover:bg-white hover:text-purple-700 px-8 py-4 rounded-xl font-semibold transition-all"
                data-testid="button-call-trust"
              >
                <Phone className="mr-2 h-5 w-5" />
                Call [DE_PUBLIC_PHONE]
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </PageTemplate>
  );
}
