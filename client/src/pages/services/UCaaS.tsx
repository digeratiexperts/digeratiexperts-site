import { PageTemplate } from "@/components/PageTemplate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Phone, 
  MapPin, 
  Building2, 
  Archive, 
  AlertTriangle, 
  DollarSign, 
  Scale,
  Hash,
  GitBranch,
  Shield,
  Video,
  FileText,
  BarChart3,
  CheckCircle,
  X,
  ArrowRight,
  Headphones
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useSEO } from "@/hooks/useSEO";
import { ServiceJsonLd, BreadcrumbJsonLd } from "@/components/JsonLd";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { CTA } from "@/lib/ctaCopy";
import { IconWell } from "@/components/visual/IconWell";

export default function UCaaS() {
  const prefersReducedMotion = useReducedMotion() ?? false;

  useSEO({
    title: "UCaaS Voice & Meetings | Managed Phone Systems",
    description: "We design, secure, and run your phone system and meeting stack so it actually supports the business. E911 compliance, call routing, retention policies, and 24/7 support.",
    canonical: "/services/ucaas",
  });

  const brokenItems = [
    {
      icon: <GitBranch className="h-6 w-6 text-de-accent-ink" />,
      title: "Routing",
      description: "Calls go to the wrong person or get dropped. Ring groups and auto-attendants aren't set up correctly, frustrating customers."
    },
    {
      icon: <MapPin className="h-6 w-6 text-de-accent-ink" />,
      title: "E911",
      description: "Your address records are outdated or wrong. In an emergency, first responders could be sent to the wrong location."
    },
    {
      icon: <Building2 className="h-6 w-6 text-de-accent-ink" />,
      title: "Too many vendors",
      description: "Phone from one vendor, meetings from another, fax from a third. Nobody owns the stack, so problems fall through the cracks."
    },
    {
      icon: <Archive className="h-6 w-6 text-de-accent-ink" />,
      title: "No retention",
      description: "Call recordings and voicemails vanish after 30 days. When you need them for compliance or disputes, they're gone."
    }
  ];

  const hiddenBillItems = {
    business: [
      "Lost sales from missed or misrouted calls",
      "Wasted time troubleshooting without expert help",
      "Productivity loss during outages",
      "Customer frustration from poor call quality"
    ],
    liability: [
      "E911 non-compliance fines (up to $10,000 per violation)",
      "HIPAA violations for unencrypted health calls",
      "Legal discovery failures from missing recordings",
      "FTC compliance gaps for financial services"
    ]
  };

  const serviceCards = [
    {
      icon: <Hash className="h-6 w-6 text-white" />,
      title: "Number procurement",
      description: "We port existing numbers and provision new DIDs with proper documentation. Never lose a business number again."
    },
    {
      icon: <GitBranch className="h-6 w-6 text-white" />,
      title: "Call flow / IVR",
      description: "Custom auto-attendants, ring groups, hunt groups, and after-hours routing designed around how your team actually works."
    },
    {
      icon: <Shield className="h-6 w-6 text-white" />,
      title: "E911 compliance",
      description: "Location records updated for every user, every site. Dispatchable addresses verified quarterly. Full audit trail."
    },
    {
      icon: <Video className="h-6 w-6 text-white" />,
      title: "Meetings governance",
      description: "Zoom/Teams/Meet policies enforced across your org. Waiting rooms, passwords, recording rules—all configured to spec."
    },
    {
      icon: <FileText className="h-6 w-6 text-white" />,
      title: "Retention policy",
      description: "Call recordings, voicemails, and meeting recordings retained for your compliance window. Automated purge when allowed."
    },
    {
      icon: <BarChart3 className="h-6 w-6 text-white" />,
      title: "Quality reporting",
      description: "Monthly reports on call quality, uptime, usage patterns, and cost. Actionable insights, not just data dumps."
    }
  ];

  const pricingTiers = [
    {
      name: "SOW Implementation",
      type: "one-time",
      price: "From $1,500",
      description: "One-time project to set up or fix your UCaaS stack",
      features: [
        "Platform audit & gap analysis",
        "Number porting coordination",
        "Call flow design & implementation",
        "E911 address verification",
        "User training session",
        "Documentation & runbook"
      ]
    },
    {
      name: "Managed UCaaS",
      type: "monthly",
      price: "$12/user/mo",
      description: "Ongoing management for your voice and meetings stack",
      features: [
        "24/7 phone system support",
        "User adds/changes/deletes",
        "E911 quarterly audits",
        "Call recording management",
        "Meeting policy enforcement",
        "Monthly quality reports"
      ],
      popular: false
    },
    {
      name: "Managed UCaaS + Platform",
      type: "monthly",
      price: "$35/user/mo",
      description: "Full stack: platform licenses plus management",
      features: [
        "Everything in Managed UCaaS",
        "Cytracom or Teams Phone license",
        "Unlimited US/CA calling",
        "Voicemail to email",
        "Mobile & desktop apps",
        "Call center queue (add-on)"
      ]
    }
  ];

  const comparisonItems = [
    { feature: "Initial setup", diy: "You figure it out", digerati: "White-glove implementation" },
    { feature: "E911 compliance", diy: "Hope it's right", digerati: "Verified quarterly" },
    { feature: "Call flow changes", diy: "Open a ticket, wait", digerati: "Same-day turnaround" },
    { feature: "Retention policy", diy: "Default 30 days", digerati: "Custom to your compliance" },
    { feature: "Quality issues", diy: "Escalate and pray", digerati: "Root cause analysis" },
    { feature: "Vendor coordination", diy: "You manage it", digerati: "Single point of contact" },
    { feature: "Cost visibility", diy: "Surprise invoices", digerati: "Predictable monthly fee" }
  ];

  return (
    <PageTemplate
      title="UCaaS: Voice & Meetings"
      subtitle="We design, secure, and run your phone system and meeting stack so it actually supports the business"
      icon={<Phone className="h-10 w-10 text-de-accent-ink" />}
      breadcrumbs={[
        { label: "Solutions", href: "/solutions" },
        { label: "UCaaS" }
      ]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="brand" size="lg" className="h-12 px-6 font-semibold">
            <a href="/book">
              {CTA.primary}
              <ArrowRight className="ml-1 h-4 w-4" />
            </a>
          </Button>
        </div>
      }
    >
      <ServiceJsonLd
        name="Unified Communications (UCaaS)"
        description="We design, secure, and run your phone system and meeting stack so it actually supports the business."
        url="/services/ucaas"
      />
      <BreadcrumbJsonLd items={[
        { name: "Home", url: "/" },
        { name: "Solutions", url: "/solutions" },
        { name: "UCaaS", url: "/services/ucaas" }
      ]} />
      <div className="space-y-20">
        {/* What's Broken Section */}
        <motion.section
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
            <div className="mb-8 flex items-center gap-3">
            <IconWell icon={AlertTriangle} size="sm" surface="dark" />
            <h2 className="text-3xl font-bold text-white">What's broken right now</h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {brokenItems.map((item, index) => (
              <motion.div
                key={item.title}
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
              >
                <Card 
                  className="h-full border-de-hairline bg-de-raised"
                  data-testid={`card-broken-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <CardHeader>
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-de-hairline bg-de-bg">
                      {item.icon}
                    </div>
                    <CardTitle className="text-xl text-white">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-400">{item.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* The Hidden Bill Section */}
        <motion.section
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl border border-de-hairline bg-de-raised p-8 md:p-12"
        >
          <div className="relative">
            <div className="mb-8 flex items-center gap-3">
              <IconWell icon={DollarSign} size="sm" surface="dark" />
              <h2 className="text-3xl font-bold text-white">The hidden bill</h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-de-accent-ink" />
                  Business impact
                </h3>
                <ul className="space-y-3">
                  {hiddenBillItems.business.map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <X className="mt-0.5 h-5 w-5 shrink-0 text-white/55" />
                      <span className="text-gray-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <Scale className="h-5 w-5 text-de-accent-ink" />
                  Liability & compliance
                </h3>
                <ul className="space-y-3">
                  {hiddenBillItems.liability.map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-de-accent-ink" />
                      <span className="text-gray-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </motion.section>

        {/* What We Actually Do Section */}
        <motion.section
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
            <div className="mb-8 flex items-center gap-3">
            <IconWell icon={Headphones} size="sm" surface="dark" />
            <h2 className="text-3xl font-bold text-white">What we actually do</h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {serviceCards.map((card, index) => (
              <motion.div
                key={card.title}
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
              >
                <Card 
                  className="group h-full border-de-hairline bg-de-raised"
                  data-testid={`card-service-${card.title.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <CardHeader className="relative">
                  <div className="relative mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-de-hairline bg-de-bg">
                      {card.icon}
                    </div>
                    <CardTitle className="text-xl font-semibold text-white group-hover:text-de-accent-ink transition-colors">
                      {card.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative">
                    <p className="text-gray-400 leading-relaxed">{card.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Service & Cost Section */}
        <motion.section
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Service & Cost</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Choose the level of support that fits your business. Start with implementation, 
              add ongoing management, or get the full stack.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {pricingTiers.map((tier, index) => (
              <motion.div
                key={tier.name}
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="relative"
              >
                <Card 
                  className="h-full border-de-hairline bg-de-raised"
                  data-testid={`card-pricing-${tier.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <CardHeader>
                    <div className="text-sm text-de-accent-ink uppercase tracking-wider mb-1">
                      {tier.type === 'one-time' ? 'One-Time' : 'Monthly'}
                    </div>
                    <CardTitle className="text-2xl text-white">{tier.name}</CardTitle>
                    <div className="text-3xl font-bold text-white mt-2">{tier.price}</div>
                    <p className="text-gray-400 text-sm mt-2">{tier.description}</p>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {tier.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start gap-3">
                          <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-de-accent-ink" />
                          <span className="text-gray-300">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Comparison Table Section */}
        <motion.section
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">DIY vs Digerati Experts UCaaS</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              See what you're really getting when you partner with us instead of going it alone.
            </p>
          </div>
          
          <div className="overflow-hidden rounded-2xl border border-de-hairline bg-de-raised">
            <div className="grid grid-cols-3 border-b border-de-hairline bg-de-bg">
              <div className="p-4 font-semibold text-gray-400">Feature</div>
              <div className="p-4 font-semibold text-gray-400 text-center border-l border-white/10">DIY</div>
              <div className="p-4 font-semibold text-de-accent-ink text-center border-l border-white/10 bg-de-raised">
                Digerati Experts UCaaS
              </div>
            </div>
            {comparisonItems.map((item, index) => (
              <div 
                key={item.feature} 
                className={`grid grid-cols-3 ${index % 2 === 0 ? "bg-de-bg/40" : ""}`}
                data-testid={`row-comparison-${index}`}
              >
                <div className="p-4 text-white font-medium">{item.feature}</div>
                <div className="p-4 text-gray-400 text-center border-l border-white/10">{item.diy}</div>
                <div className="border-l border-de-hairline bg-de-bg p-4 text-center font-medium text-de-accent-ink">
                  {item.digerati}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* CTA Section */}
        <motion.section
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border border-de-hairline bg-de-raised p-8 text-center md:p-12"
        >
          <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">
            Ready to fix your phone system?
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-white/70 md:text-xl">
            Book a 15-minute call to discuss your current setup and see if we're a fit.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild variant="brand" size="lg" className="h-12 px-8 font-semibold" data-testid="button-schedule-call">
              <a href="/book">
                {CTA.primary}
                <ArrowRight className="ml-1 h-5 w-5" />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 border-white/20 px-8 font-semibold text-white hover:bg-white/10" data-testid="button-call-now">
              <a href={PRIMARY_PHONE.telHref}>
                <Phone className="mr-1 h-5 w-5" />
                Call {PRIMARY_PHONE.display}
              </a>
            </Button>
          </div>
        </motion.section>
      </div>
    </PageTemplate>
  );
}
