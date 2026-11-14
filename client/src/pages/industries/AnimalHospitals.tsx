import { PageTemplate } from "@/components/PageTemplate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, FileCheck, CheckCircle, Phone, Heart, Activity, PawPrint, AlertTriangle, Database, Clock, Users } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

export default function AnimalHospitals() {
  const prefersReducedMotion = useReducedMotion() ?? false;
  
  const metrics = [
    { label: "Data Protection", value: "Layered", icon: Shield, color: "from-violet-500 to-purple-500" },
    { label: "System Planning", value: "Reliable", icon: Activity, color: "from-purple-500 to-fuchsia-500" },
    { label: "Response Ownership", value: "Clear", icon: Clock, color: "from-violet-500 to-purple-500" },
    { label: "Veterinary Focus", value: "Practical", icon: Heart, color: "from-purple-500 to-fuchsia-500" }
  ];

  const challenges = [
    { 
      icon: Database, 
      title: "Patient Records Security", 
      description: "Protect sensitive pet medical records and client payment information with enterprise-grade encryption.",
      color: "text-violet-400"
    },
    { 
      icon: Lock, 
      title: "Payment Card Compliance", 
      description: "Maintain PCI DSS compliance for credit card transactions and client billing systems.",
      color: "text-violet-400"
    },
    { 
      icon: Users, 
      title: "Multi-Location Management", 
      description: "Seamlessly manage IT across multiple clinic locations with centralized security and monitoring.",
      color: "text-violet-400"
    }
  ];

  const securityFeatures = [
    "Practice Management System Security",
    "Encrypted Client Communications",
    "Secure Payment Processing",
    "24/7 Network Monitoring",
    "Backup & Disaster Recovery",
    "Email Protection & Anti-Phishing",
    "Endpoint Security (EDR)",
    "Security Awareness Training",
    "Remote Access Security",
    "Compliance Documentation"
  ];

  return (
    <PageTemplate
      title="IT Solutions for Veterinary Practices"
      subtitle="Secure, reliable IT solutions designed specifically for animal hospitals and veterinary clinics across Arizona."
      gradientColors="from-violet-600 via-purple-600 to-fuchsia-600"
      icon={<PawPrint className="w-10 h-10 text-white" />}
      breadcrumbs={[{ label: "Industries", href: "/" }, { label: "Animal Hospitals" }]}
    >
      <div className="space-y-16">
        {/* Metrics Dashboard */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric, idx) => {
            const Icon = metric.icon;
            return (
              <motion.div
                key={idx}
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1, duration: 0.5 }}
                className="group relative"
              >
                <div className={`absolute inset-0 bg-gradient-to-r ${metric.color} rounded-xl blur opacity-0 group-hover:opacity-30 transition-all duration-300`} />
                <Card className="relative bg-white/5 backdrop-blur-sm border border-white/10 hover:border-violet-500/30 hover:shadow-lg transition-all">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${metric.color} flex items-center justify-center`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <Badge variant="outline" className="text-xs border-white/20 text-gray-300">Key Metric</Badge>
                    </div>
                    <p className="text-3xl font-bold text-white">{metric.value}</p>
                    <p className="text-sm text-gray-400 mt-1">{metric.label}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Risk Alert */}
        <motion.div 
          className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-8"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex gap-4">
            <AlertTriangle className="h-8 w-8 text-amber-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Veterinary Practices Are Prime Targets</h3>
              <p className="text-gray-300 leading-relaxed">
                Animal hospitals store valuable client payment data, pet insurance information, and personal contact details. 
                Cybercriminals increasingly target veterinary practices knowing they often lack enterprise-grade security. 
                A single ransomware attack can halt operations, disrupt patient care, and damage your reputation.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Challenges Grid */}
        <div>
          <motion.h2 
            className="text-2xl md:text-3xl font-bold text-white mb-8 text-center"
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Challenges We Solve for Veterinary Practices
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-6">
            {challenges.map((challenge, idx) => {
              const Icon = challenge.icon;
              return (
                <motion.div
                  key={idx}
                  initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1, duration: 0.5 }}
                >
                  <Card className="bg-white/5 backdrop-blur-sm border border-white/10 hover:border-violet-500/30 transition-all h-full">
                    <CardHeader>
                      <div className={`w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center mb-4`}>
                        <Icon className={`h-6 w-6 ${challenge.color}`} />
                      </div>
                      <CardTitle className="text-xl text-white">{challenge.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-400">{challenge.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Security Features */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Card className="bg-gradient-to-br from-violet-600/20 to-purple-600/20 border border-violet-500/30">
            <CardHeader>
              <CardTitle className="text-2xl text-white flex items-center gap-3">
                <Shield className="h-7 w-7 text-violet-400" />
                Complete Security for Your Practice
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-4">
                {securityFeatures.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                    <span className="text-gray-200">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Why Choose Us */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Trusted by Veterinary Practices Across Arizona
          </h2>
          <p className="text-lg text-gray-400 max-w-3xl mx-auto mb-8">
            From small clinics to multi-location animal hospitals, we understand the unique IT needs of veterinary practices. 
            Our team provides responsive support so you can focus on what matters most – caring for your patients.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="/book"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-lg transition-colors"
              data-testid="button-schedule-call"
            >
              <Phone className="h-5 w-5" />
              Schedule a Consultation
            </a>
            <a 
              href="tel:[DE_PUBLIC_PHONE]"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg border border-white/20 transition-colors"
              data-testid="button-call-now"
            >
              Call [DE_PUBLIC_PHONE]
            </a>
          </div>
        </motion.div>
      </div>
    </PageTemplate>
  );
}
