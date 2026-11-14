import { PageTemplate } from "@/components/PageTemplate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, Target, Users, Shield, Zap, Clock, Award, Star } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useSEO } from "@/hooks/useSEO";

export default function MissionValues() {
  const prefersReducedMotion = useReducedMotion() ?? false;

  useSEO({
    title: 'Mission & Values - Our Commitment',
    description: 'Digerati Experts mission and core values. Security-first IT, local partnership, and proactive protection for Arizona businesses.',
    canonical: '/about/mission',
  });
  
  const values = [
    {
      icon: Shield,
      title: "Security First",
      description: "We believe every business deserves enterprise-level security, regardless of size. We stay ahead of threats so you don't have to.",
      gradient: "from-purple-500 to-indigo-600"
    },
    {
      icon: Users,
      title: "Partnership",
      description: "We're not just your IT provider – we're your technology partner. Your success is our success, and we're invested in your long-term growth.",
      gradient: "from-purple-500 to-violet-600"
    },
    {
      icon: Target,
      title: "Proactive Approach",
      description: "We prevent problems before they happen. Our proactive monitoring and maintenance keep your systems running smoothly 24/7.",
      gradient: "from-violet-500 to-fuchsia-600"
    },
    {
      icon: Heart,
      title: "Local Commitment",
      description: "Based in Chandler, Arizona, we're proud to serve businesses throughout the Phoenix metro area with personalized, local support.",
      gradient: "from-fuchsia-500 to-pink-600"
    }
  ];

  const differentiators = [
    { icon: Users, title: "Human-First Technology", desc: "While we use advanced tools and automation, every client has a dedicated team of real people who know your business." },
    { icon: Award, title: "Compliance Expertise", desc: "We specialize in helping businesses meet complex compliance requirements like HIPAA, PCI DSS, and SOC 2." },
    { icon: Star, title: "Transparent Pricing", desc: "No hidden fees, no surprises. You'll always know exactly what you're paying for and why." },
    { icon: Clock, title: "Responsive Support", desc: "When something needs attention, you should know who owns it, what happens next, and when you will hear back." }
  ];

  return (
    <PageTemplate
      title="Mission & Values"
      subtitle="Our commitment to partnership and protecting Arizona businesses."
      icon={<Heart className="w-10 h-10 text-white" />}
      breadcrumbs={[{ label: "About", href: "/" }, { label: "Mission & Values" }]}
    >
      <div className="space-y-16">
        {/* Mission Statement */}
        <motion.div 
          className="text-center max-w-4xl mx-auto"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 mb-6">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold mb-6 text-white">Our Mission</h2>
          <p className="text-xl text-gray-300 leading-relaxed">
            To empower small and medium-sized businesses in Arizona with enterprise-grade IT security and support, 
            making advanced cybersecurity accessible and affordable for organizations of all sizes.
          </p>
        </motion.div>

        {/* Core Values */}
        <div>
          <motion.h2 
            className="text-3xl font-bold text-center mb-10 text-white"
            initial={prefersReducedMotion ? {} : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Our Core Values
          </motion.h2>
          <div className="grid md:grid-cols-2 gap-6">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <motion.div
                  key={index}
                  initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                >
                  <Card className="group h-full bg-white/5 backdrop-blur-sm border border-white/10 hover:border-purple-500/50 hover:bg-white/10 transition-all duration-300 overflow-hidden">
                    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${value.gradient} opacity-10 rounded-bl-full`} />
                    <CardHeader>
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${value.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                        <Icon className="h-7 w-7 text-white" />
                      </div>
                      <CardTitle className="text-2xl text-white">{value.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-400 leading-relaxed">{value.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* What Sets Us Apart */}
        <motion.div 
          className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12 overflow-hidden"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-purple-500/20 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-indigo-500/20 to-transparent rounded-full blur-3xl" />
          
          <div className="relative">
            <h2 className="text-3xl font-bold mb-8 text-white">What Sets Us Apart</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {differentiators.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div 
                    key={index}
                    className="flex gap-4 p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:border-purple-500/50 hover:bg-white/10 transition-all duration-300"
                    initial={prefersReducedMotion ? {} : { opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1, duration: 0.3 }}
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white mb-1">{item.title}</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Stats Section */}
        <motion.div 
          className="grid md:grid-cols-4 gap-6 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-2xl p-8 text-white"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          {[
            { value: "Local", label: "Based in Chandler, Arizona" },
            { value: "Clear", label: "Recommendations in plain English" },
            { value: "Practical", label: "Controls sized to the business" },
            { value: "Accountable", label: "Ownership after the sale" }
          ].map((stat, idx) => (
            <div key={idx} className="text-center p-4 bg-white/10 rounded-xl backdrop-blur-sm">
              <p className="text-2xl font-bold mb-1">{stat.value}</p>
              <p className="text-purple-100 text-sm">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div 
          className="relative rounded-2xl overflow-hidden"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600" />
          <div className="absolute inset-0 opacity-20">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="mission-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#mission-grid)" />
            </svg>
          </div>
          
          <div className="relative p-8 md:p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Ready to Experience the Difference?</h2>
            <p className="text-lg md:text-xl mb-8 text-white/90 max-w-2xl mx-auto">
              Bring us the recurring problem, the security questionnaire, or the decision you have been putting off. We will help you make sense of it.
            </p>
            <a 
              href="/book"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center bg-white text-purple-700 hover:bg-purple-50 px-8 py-4 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl hover:scale-105"
              data-testid="button-schedule"
            >
              Schedule Free Consultation
            </a>
          </div>
        </motion.div>
      </div>
    </PageTemplate>
  );
}
