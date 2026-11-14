import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, MapPin, Phone, ArrowRight, Sparkles, Zap, Clock, CheckCircle, 
  Building, FileCheck, Loader2, Monitor, Lock, Cloud, Users, HeadphonesIcon
} from 'lucide-react';
import { DigeratiEnhancedFooterSection } from '@/pages/sections/DigeratiEnhancedFooterSection';
import { MegaMenu } from '@/components/MegaMenu';
import { DashboardMockup, AnimatedShield, NetworkNodes } from "@/components/graphics";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useSEO } from "@/hooks/useSEO";

const assessmentFormSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters").max(50),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().regex(/^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/, "Please enter a valid phone number"),
  company: z.string().min(2, "Company name must be at least 2 characters").max(100),
});

type AssessmentFormData = z.infer<typeof assessmentFormSchema>;

interface LocationPageProps {
  city: string;
  state: string;
  localArea: string;
  serviceRadius: string;
  title: string;
  subtitle: string;
  description: string;
  heroImage: string;
  keywordPhrase: string;
  whyChooseUs: string[];
  localProof: {
    officeLocation: string;
    yearsServing: string;
    testimonialCount: string;
    industries: string[];
  };
  serviceFocus: string[];
  neighborhoods: string[];
  cta: string;
}

const serviceIcons = [Monitor, Shield, Lock, Cloud, Users, HeadphonesIcon];

export function LocationServicePage(props: LocationPageProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useSEO({
    title: props.title,
    description: props.description,
    canonical: `/locations/${props.city.toLowerCase().replace(/\s+/g, '-')}-az`,
  });

  useEffect(() => {
    
    // Add local business JSON-LD schema
    const existingSchema = document.querySelector('script[data-schema="local-business"]');
    if (existingSchema) existingSchema.remove();
    
    const schema = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": "Digerati Experts",
      "description": props.description,
      "url": `https://digeratiexperts.com/locations/${props.city.toLowerCase().replace(/\s+/g, '-')}-az`,
      "telephone": "[DE_PUBLIC_PHONE]",
      "email": "info@digeratiexperts.com",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "3165 S Alma School Rd Suite 29",
        "addressLocality": "Chandler",
        "addressRegion": "AZ",
        "postalCode": "85248",
        "addressCountry": "US"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 33.2826,
        "longitude": -111.8407
      },
      "areaServed": {
        "@type": "City",
        "name": props.city,
        "containedInPlace": {
          "@type": "State",
          "name": "Arizona"
        }
      },
      "openingHoursSpecification": [
        {
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          "opens": "07:00",
          "closes": "18:00"
        }
      ],
      "priceRange": "$$",
      "image": "https://digeratiexperts.com/logo.png",
      "sameAs": [
        "https://www.linkedin.com/company/digerati-experts",
        "https://www.facebook.com/digeratiexperts",
        "https://twitter.com/digerati_experts"
      ],
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "IT Services",
        "itemListElement": props.serviceFocus.map(service => ({
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": service
          }
        }))
      }
    };
    
    const scriptTag = document.createElement('script');
    scriptTag.type = 'application/ld+json';
    scriptTag.setAttribute('data-schema', 'local-business');
    scriptTag.textContent = JSON.stringify(schema);
    document.head.appendChild(scriptTag);
    
    return () => {
      const schemaToRemove = document.querySelector('script[data-schema="local-business"]');
      if (schemaToRemove) schemaToRemove.remove();
    };
  }, [props.title, props.description, props.city, props.serviceFocus]);

  const form = useForm<AssessmentFormData>({
    resolver: zodResolver(assessmentFormSchema),
    defaultValues: { fullName: "", email: "", phone: "", company: "" },
  });

  const handleSubmit = async (data: AssessmentFormData) => {
    setIsSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast({
        title: "Assessment Request Submitted!",
        description: `We'll contact you within 24 hours to schedule your free ${props.city} assessment.`,
      });
      form.reset();
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const stats = [
    { icon: Shield, value: "Secure", label: "By Design" },
    { icon: Zap, value: "Clear", label: "Next Steps" },
    { icon: Clock, value: "Local", label: "Accountability" },
  ];

  const features = [
    { icon: FileCheck, text: "Insurance & Compliance-Ready", color: "text-violet-400" },
    { icon: Shield, text: "24/7 Human-Led Monitoring", color: "text-violet-400" },
    { icon: Building, text: `Built for ${props.city} Businesses`, color: "text-violet-400" },
    { icon: CheckCircle, text: "Easy-to-Read Risk Reports", color: "text-violet-400" },
  ];

  return (
    <>
      <MegaMenu />
      
      {/* Hero Section - Matches homepage dark theme */}
      <section className="relative min-h-screen overflow-hidden">
        {/* Animated gradient mesh background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a0118] via-[#1a0a2e] to-[#0f0720]" />
          
          <motion.div
            className="absolute top-[-20%] right-[-10%] w-[1000px] h-[1000px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 60%)" }}
            animate={{ scale: [1, 1.15, 1], x: [0, 60, 0], y: [0, 30, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-[-20%] left-[-15%] w-[900px] h-[900px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, transparent 60%)" }}
            animate={{ scale: [1.1, 1, 1.1], x: [0, -40, 0], y: [0, -60, 0] }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          />
          
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: "linear-gradient(rgba(139, 92, 246, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.15) 1px, transparent 1px)",
            backgroundSize: "80px 80px"
          }} />
          
          
        </div>

        {/* Main content */}
        <div className="relative z-10 w-full px-4 sm:px-6 md:px-10 lg:px-12 xl:px-16 2xl:px-24 pt-28 pb-12 sm:pt-32 lg:pt-36 xl:pt-40 lg:pb-16 xl:pb-20">
          <div className="mx-auto w-[min(94vw,1680px)]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 xl:gap-16 items-center">
              
              {/* Left column - Form with integrated info */}
              <motion.div 
                className="flex flex-col gap-6 w-full"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                {/* Location Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 backdrop-blur-sm w-fit">
                  <MapPin className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-purple-300">{props.localArea}</span>
                </div>

                {/* Headline */}
                <h1 className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl font-bold leading-[1.1] tracking-tight">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400">
                    {props.city} Businesses
                  </span>
                  <br />
                  <span className="text-white">
                    Deserve{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-400">Better IT.</span>
                  </span>
                </h1>

                <p className="text-lg text-gray-300 leading-relaxed max-w-xl">
                  {props.description}
                </p>

                {/* Feature pills */}
                <div className="grid grid-cols-2 gap-3">
                  {features.map((feature) => (
                    <div key={feature.text} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
                      <feature.icon className={`h-4 w-4 ${feature.color} flex-shrink-0`} />
                      <span className="text-xs text-gray-300 leading-tight">{feature.text}</span>
                    </div>
                  ))}
                </div>

                {/* Form Card */}
                <motion.div className="relative" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
                  <div className="absolute -inset-1 bg-gradient-to-r from-purple-600/20 via-transparent to-fuchsia-600/20 blur-2xl" />
                  
                  <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField control={form.control} name="fullName" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm text-gray-300">Full Name</FormLabel>
                              <FormControl>
                                <Input placeholder="John Smith" data-testid={`input-${props.city.toLowerCase()}-name`} className="h-11 bg-white/10 border-white/20 text-white placeholder:text-gray-500 focus-visible:ring-purple-500" disabled={isSubmitting} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="email" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm text-gray-300">Email Address</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="john@company.com" data-testid={`input-${props.city.toLowerCase()}-email`} className="h-11 bg-white/10 border-white/20 text-white placeholder:text-gray-500 focus-visible:ring-purple-500" disabled={isSubmitting} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="phone" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm text-gray-300">Phone Number</FormLabel>
                              <FormControl>
                                <Input type="tel" placeholder="(480) 000-0000" data-testid={`input-${props.city.toLowerCase()}-phone`} className="h-11 bg-white/10 border-white/20 text-white placeholder:text-gray-500 focus-visible:ring-purple-500" disabled={isSubmitting} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="company" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm text-gray-300">Company Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Your Company Inc." data-testid={`input-${props.city.toLowerCase()}-company`} className="h-11 bg-white/10 border-white/20 text-white placeholder:text-gray-500 focus-visible:ring-purple-500" disabled={isSubmitting} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                          <Button type="submit" size="lg" data-testid={`button-${props.city.toLowerCase()}-submit`} disabled={isSubmitting} className="flex-1 h-12 text-base font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border-0 shadow-lg shadow-purple-500/25">
                            {isSubmitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Submitting...</> : <>Get Free {props.city} Assessment<ArrowRight className="w-5 h-5 ml-2" /></>}
                          </Button>
                          <a href="tel:[DE_PUBLIC_PHONE]" className="sm:flex-shrink-0">
                            <Button type="button" variant="outline" size="lg" className="w-full sm:w-auto h-12 px-6 text-base font-semibold border-white/20 bg-white/5 hover:bg-white/10 text-white">
                              <Phone className="w-5 h-5 mr-2" />[DE_PUBLIC_PHONE]
                            </Button>
                          </a>
                        </div>
                      </form>
                    </Form>
                  </div>
                </motion.div>

                {/* Stats row */}
                <div className="flex flex-wrap gap-3">
                  {stats.map((stat, index) => (
                    <motion.div key={stat.label} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 + index * 0.1 }}>
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
                        <stat.icon className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <div className="text-xl font-bold text-white">{stat.value}</div>
                        <div className="text-xs text-gray-400">{stat.label}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Trust badges */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-gray-500">Trusted by:</span>
                  {["SOC 2 Type II", "Microsoft Partner", "Apple Consultants"].map((badge) => (
                    <div key={badge} className="px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs text-gray-400">{badge}</div>
                  ))}
                </div>
              </motion.div>

              {/* Right column - Dashboard Visual */}
              <div className="relative flex justify-center lg:justify-end w-full mt-8 lg:mt-0">
                <motion.div className="relative w-full max-w-[500px] lg:max-w-[550px] xl:max-w-[600px]" initial={{ opacity: 0, x: 60, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={{ duration: 0.9, delay: 0.5 }}>
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-600/30 via-indigo-600/15 to-cyan-600/30 blur-3xl scale-110" />
                  <motion.div className="relative" style={{ transform: "perspective(1200px) rotateY(-8deg) rotateX(3deg)", transformStyle: "preserve-3d" }} animate={{ rotateY: [-8, -5, -8], rotateX: [3, 4, 3] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}>
                    <DashboardMockup className="w-full drop-shadow-2xl" />
                  </motion.div>
                  <motion.div className="absolute -top-8 -left-4 w-24 h-28 z-30" animate={{ y: [0, -12, 0], rotate: [0, 5, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
                    <AnimatedShield className="w-full h-full drop-shadow-lg" />
                  </motion.div>
                  <motion.div className="absolute bottom-4 -right-6 w-32 h-40 opacity-60" animate={{ y: [0, 8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}>
                    <NetworkNodes className="w-full h-full" />
                  </motion.div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0118] to-transparent z-10" />
      </section>

      {/* Services Section - Dark themed */}
      <section className="py-20 bg-gradient-to-b from-[#0a0118] via-[#0d0720] to-[#0a0118]">
        <div className="mx-auto w-[min(94vw,1400px)] px-4">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              IT Services for <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-400">{props.city}</span> Businesses
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">{props.serviceRadius}</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {props.serviceFocus.map((service, index) => {
              const IconComponent = serviceIcons[index % serviceIcons.length];
              return (
                <motion.div key={service} className="group p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-purple-500/50 transition-all duration-300" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }}>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <IconComponent className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">{service}</h3>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-20 bg-gradient-to-b from-[#0a0118] to-[#0d0720]">
        <div className="mx-auto w-[min(94vw,1400px)] px-4">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Why {props.city} Chooses <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-400">Digerati Experts</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {props.whyChooseUs.map((reason, index) => (
              <motion.div key={index} className="flex gap-4 p-5 rounded-xl bg-white/5 border border-white/10" initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }}>
                <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="text-gray-300">{reason}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Industries Section */}
      <section className="py-20 bg-[#0d0720]">
        <div className="mx-auto w-[min(94vw,1400px)] px-4">
          <motion.div className="text-center mb-12" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Industries We Serve in {props.city}</h2>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-4">
            {props.localProof.industries.map((industry, index) => (
              <motion.div key={industry} className="px-6 py-3 rounded-full bg-gradient-to-r from-purple-500/10 to-fuchsia-500/10 border border-purple-500/30 text-gray-300" initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }}>
                {industry}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Service Areas */}
      <section className="py-20 bg-gradient-to-b from-[#0d0720] to-[#0a0118]">
        <div className="mx-auto w-[min(94vw,1400px)] px-4 text-center">
          <motion.h2 className="text-3xl md:text-4xl font-bold text-white mb-4" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            Neighborhoods We Serve
          </motion.h2>
          <p className="text-gray-400 mb-8">{props.serviceRadius}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {props.neighborhoods.map((area) => (
              <span key={area} className="px-5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-300">{area}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-purple-900/50 via-[#0a0118] to-indigo-900/50">
        <div className="mx-auto w-[min(94vw,1200px)] px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">{props.cta}</h2>
            <p className="text-xl text-gray-300 mb-8">Contact our {props.city} team today for your free consultation</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/book">
                <Button size="lg" className="px-8 py-6 text-lg font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/25">
                  Start Your Free Assessment <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </a>
              <a href="tel:[DE_PUBLIC_PHONE]">
                <Button variant="outline" size="lg" className="px-8 py-6 text-lg font-semibold border-white/20 bg-white/5 hover:bg-white/10 text-white">
                  <Phone className="mr-2 w-5 h-5" /> Call [DE_PUBLIC_PHONE]
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <DigeratiEnhancedFooterSection />
    </>
  );
}
