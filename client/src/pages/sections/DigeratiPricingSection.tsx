import { Button } from "@/components/ui/button";
import { CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { pricing, getPricingFooterText } from "@/data/pricing";
import pricingBgImage from "@assets/lucid-origin_a_cinematic_photo_of_ultra_wide_abstract_backgrou_1775876876671.jpg";


export const DigeratiPricingSection = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollButtons);
      checkScrollButtons();
      return () => container.removeEventListener('scroll', checkScrollButtons);
    }
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };
  const pricingPlans = [
    {
      name: pricing.office.name,
      monthlyPrice: pricing.office.siteMin,
      perUserPrice: pricing.office.user,
      isPopular: false,
      learnMoreUrl: "/solutions/managed-it-support",
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
      monthlyPrice: pricing.business.siteMin,
      perUserPrice: pricing.business.user,
      isPopular: true,
      learnMoreUrl: pricing.business.learnMoreUrl,
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
      monthlyPrice: pricing.enterprise.siteMin,
      perUserPrice: pricing.enterprise.user,
      isPopular: false,
      learnMoreUrl: pricing.enterprise.learnMoreUrl,
      features: [
        "Everything in Business",
        "Compliance Readiness Modules",
        "Penetration Testing (scoped)",
        "Disaster Recovery Runbooks",
        "Privileged Access + Audit Logs",
        "AI & Cloud Automation"
      ]
    }
  ];

  const containerVariants = prefersReducedMotion ? undefined : {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const cardVariants = prefersReducedMotion ? undefined : {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  return (
    <section 
      id="pricing" 
      className="relative py-10 md:py-14 lg:py-16 overflow-hidden bg-[#0a0a0a]"
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <img src={pricingBgImage} alt="" loading="lazy" className="absolute top-0 left-0 w-full h-auto opacity-[0.15]" />
      </div>
      {/* Subtle violet accent glow */}
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: "radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.06) 0%, transparent 60%)" }} />
      
      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          className="text-center mb-6 md:mb-8 lg:mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-violet-500/10 border border-violet-500/20 mb-4 md:mb-6">
            <span className="text-xs md:text-sm font-medium text-violet-300">Transparent Pricing</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-3 md:mb-4 text-white">
            ProActive Ecosystem <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">Pricing</span>
          </h2>
          <p className="text-base md:text-lg lg:text-xl text-white/60 leading-relaxed max-w-3xl mx-auto px-4">
            Clear, predictable, and compliance-ready. Packages start at ${pricing.office.user}/user/mo. <span className="font-bold text-white">Minimum billing applies</span>.
          </p>
        </motion.div>

        {/* Mobile: Horizontal scroll with navigation */}
        <div className="md:hidden relative">
          <button
            onClick={() => scroll('left')}
            className={`absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/80 backdrop-blur-sm border border-white/20 flex items-center justify-center transition-all ${
              canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            aria-label="Scroll left"
            data-testid="pricing-scroll-left"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          
          <button
            onClick={() => scroll('right')}
            className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/80 backdrop-blur-sm border border-white/20 flex items-center justify-center transition-all ${
              canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            aria-label="Scroll right"
            data-testid="pricing-scroll-right"
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>

          <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[#0a0a0a] to-transparent z-10 pointer-events-none" />

          <div 
            ref={scrollContainerRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 px-2 snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {pricingPlans.map((plan, index) => (
              <div
                key={index}
                className={`relative rounded-2xl p-5 transition-all duration-300 flex-shrink-0 w-[280px] snap-center flex flex-col ${
                  plan.isPopular 
                    ? 'bg-white border-2 border-violet-500 ring-2 ring-violet-500/30 shadow-xl shadow-violet-500/10' 
                    : 'bg-white border border-gray-200'
                }`}
                data-testid={`pricing-${plan.name.toLowerCase().replace(' ', '-')}`}
              >
                {plan.isPopular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-violet-600 to-purple-600 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">{plan.name}</h3>
                  
                  <div className="mb-1">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Starting at</span>
                  </div>
                  
                  <div className="flex items-baseline mb-1">
                    <span className="text-3xl font-bold text-violet-600 selection:bg-violet-200 selection:text-gray-900">
                      ${plan.monthlyPrice.toLocaleString()}
                    </span>
                    <span className="text-gray-500 ml-1 text-sm">/mo</span>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                  {plan.name === 'Office' ? `$${pricing.office.siteMin}/site/mo minimum` : plan.name === 'Business' ? `$${pricing.business.siteMin.toLocaleString()}/site/mo minimum` : `$${pricing.enterprise.siteMin.toLocaleString()}/site/mo minimum`}
                </div>
                </div>

                <ul className="space-y-2 mb-4 flex-grow">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-emerald-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className={`text-base text-gray-600 ${featureIndex === 0 && plan.name !== "Office" ? 'font-semibold text-gray-900' : ''}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-col gap-3 mt-auto pt-2">
                  <a href={plan.learnMoreUrl} className="block">
                    <Button 
                      className="w-full h-9 text-sm border-2 border-violet-600 text-violet-600 bg-transparent hover:bg-violet-600 hover:text-white active:bg-violet-700 active:text-white focus:bg-violet-600 focus:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 transition-all duration-200" 
                      variant="outline"
                      data-testid={`button-learn-more-${plan.name.toLowerCase()}`}
                    >
                      Learn More
                    </Button>
                  </a>
                  <a href="/book" className="block">
                    <Button 
                      className={`w-full h-9 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                        plan.isPopular 
                          ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500 active:bg-violet-700 border-0' 
                          : 'border-2 border-violet-600 text-violet-600 bg-transparent hover:bg-violet-50 active:bg-violet-100 active:text-violet-700 focus:text-violet-600'
                      }`}
                      variant={plan.isPopular ? "default" : "outline"}
                      data-testid={`button-strategy-call-${plan.name.toLowerCase()}`}
                    >
                      Book Strategy Call
                    </Button>
                  </a>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-2 mt-4">
            {pricingPlans.map((_, index) => (
              <div key={index} className="w-2 h-2 rounded-full bg-white/20" />
            ))}
          </div>
        </div>

        {/* Desktop: Grid layout */}
        <motion.div 
          className="hidden md:grid md:grid-cols-3 gap-6 md:gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {pricingPlans.map((plan, index) => (
            <motion.div
              key={index}
              variants={cardVariants}
              className={`relative rounded-2xl p-6 md:p-8 transition-all duration-300 flex flex-col ${
                plan.isPopular 
                  ? 'bg-white border-2 border-violet-500 ring-2 ring-violet-500/30 shadow-xl shadow-violet-500/10' 
                  : 'bg-white border border-gray-200 hover:border-violet-300 hover:shadow-lg'
              }`}
              data-testid={`pricing-${plan.name.toLowerCase().replace(' ', '-')}`}
            >
              {plan.isPopular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-violet-600 to-purple-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold shadow-lg">
                    Most Popular
                  </span>
                </div>
              )}
              
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">{plan.name}</h3>
                
                <div className="mb-2">
                  <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Starting at</span>
                </div>
                
                <div className="flex items-baseline mb-2">
                  <span className="text-4xl md:text-5xl font-bold text-violet-600 selection:bg-violet-200 selection:text-gray-900">
                    ${plan.monthlyPrice.toLocaleString()}
                  </span>
                  <span className="text-gray-500 ml-2 text-base">/mo</span>
                </div>
                
                <div className="text-sm text-gray-500">
                  {plan.name === 'Office' ? `$${pricing.office.siteMin}/site/mo minimum` : plan.name === 'Business' ? `$${pricing.business.siteMin.toLocaleString()}/site/mo minimum` : `$${pricing.enterprise.siteMin.toLocaleString()}/site/mo minimum`}
                </div>
              </div>

              <ul className="space-y-3 mb-4 flex-grow">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-emerald-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className={`text-base text-gray-600 ${featureIndex === 0 && plan.name !== "Office" ? 'font-semibold text-gray-900' : ''}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-4 mt-auto pt-2">
                <a href={plan.learnMoreUrl} className="block">
                  <Button 
                    className="w-full border-2 border-violet-600 text-violet-600 bg-transparent hover:bg-violet-600 hover:text-white active:bg-violet-700 active:text-white focus:bg-violet-600 focus:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 transition-all duration-200" 
                    variant="outline"
                    data-testid={`button-learn-more-${plan.name.toLowerCase()}`}
                  >
                    Learn More
                  </Button>
                </a>
                <a href="/book" className="block">
                  <Button 
                    className={`w-full font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                      plan.isPopular 
                        ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500 active:bg-violet-700 active:text-white border-0' 
                        : 'border-2 border-violet-600 text-violet-600 bg-transparent hover:bg-violet-50 active:bg-violet-100 active:text-violet-700 focus:text-violet-600'
                    }`}
                    variant={plan.isPopular ? "default" : "outline"}
                    data-testid={`button-strategy-call-${plan.name.toLowerCase()}`}
                  >
                    Book a Strategy Call
                  </Button>
                </a>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div 
          className="mt-8 text-center text-sm text-white/50"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <p>{getPricingFooterText()}</p>
          <p>Billing rule: Minimums apply when per-user total &lt; minimum.</p>
          <p>Final pricing is tailored to your users, sites, and compliance needs.</p>
        </motion.div>

        <motion.div 
          className="mt-12 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/book">
              <Button 
                size="lg" 
                className="border-2 border-white/30 text-white bg-transparent hover:bg-violet-600 hover:border-violet-600 hover:text-white active:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 transition-all duration-200"
                variant="outline"
                data-testid="button-book-intro-call"
              >
                Book a 15-Minute Intro Call
              </Button>
            </a>
            <a href="/quote-wizard">
              <Button 
                size="lg" 
                className="border-2 border-white/30 text-white bg-transparent hover:bg-violet-600 hover:border-violet-600 hover:text-white active:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 transition-all duration-200"
                variant="outline"
                data-testid="button-see-pricing"
              >
                See Full Pricing & Packages
              </Button>
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
