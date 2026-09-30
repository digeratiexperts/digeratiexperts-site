// FROZEN — homepage version 1, snapshot of client/src/pages/sections/DigeratiLeadFormSection.tsx from git ref origin/main on 2026-09-02.
// Do not edit. Start a new version with scripts/snapshot-homepage-version.mjs.
import { motion, useReducedMotion } from "framer-motion";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Loader2, Check, Shield, Clock, CheckCircle } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";

const formSchema = z.object({
  fullName: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),
  email: z.string()
    .email("Please enter a valid email address"),
  phone: z.string().optional(),
  company: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export const DigeratiLeadFormSection = (): JSX.Element => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      company: "",
    },
  });

  const handleSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    
    try {
      const response = await fetch("/api/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: data.fullName,
          email: data.email,
          phone: data.phone || "",
          company: data.company || "",
          source: "lead_form",
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Submission failed");
      }
      
      toast({
        title: "Assessment Request Submitted!",
        description: "We'll contact you within 24 hours to schedule your Cyber Risk Assessment.",
        variant: "default",
      });
      
      form.reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const benefits = [
    { icon: Shield, text: "Complimentary security assessment" },
    { icon: Clock, text: "Results in 24-48 hours" },
    { icon: CheckCircle, text: "No obligation, no credit card" },
  ];

  return (
    <section 
      id="assessment-form"
      className="de-dark-well relative py-8 md:py-14"
    >
      <div className="mx-auto max-w-[var(--de-canvas)] px-3 sm:px-4 lg:px-6">
        <div className="de-paper-island relative px-6 py-10 sm:px-10 sm:py-14 md:px-12 md:py-16">
          <div className="max-w-4xl mx-auto relative z-10">
            <motion.div 
              className="text-center mb-10"
              initial={prefersReducedMotion ? false : revealInitial}
              whileInView={revealInView}
              viewport={revealViewport}
              transition={revealTransition}
            >
              <p className="mb-3 text-base font-semibold uppercase tracking-[0.2em] text-[#D3126A]">
                Cyber Risk Assessment
              </p>
              <h2 className="mb-4 font-heading text-3xl font-semibold leading-tight tracking-[-0.02em] text-[#1A1228] md:text-4xl lg:text-5xl">
                Get Your Free Security Assessment
              </h2>
              <p className="mx-auto max-w-2xl text-lg leading-relaxed text-black/60 md:text-xl">
                Discover vulnerabilities before attackers do. Our experts will analyze your security posture and provide actionable recommendations.
              </p>
            </motion.div>

            <motion.div
              className="de-paper-lift-lg rounded-2xl p-8 md:p-10"
              initial={prefersReducedMotion ? false : revealInitial}
              whileInView={revealInView}
              viewport={revealViewport}
              transition={revealTransition}
            >
              <div className="mb-6 grid grid-cols-1 gap-x-6 gap-y-2.5 rounded-xl border border-[var(--de-paper-hairline)] bg-white px-4 py-3.5 sm:grid-cols-3">
                <div className="flex items-baseline gap-2.5 text-[15px] font-semibold leading-snug text-[#1A1228]">
                  <span className="mt-[0.55em] h-px w-2.5 shrink-0 bg-[#D3126A]" aria-hidden="true" />
                  <span>Independent findings</span>
                </div>
                <div className="flex items-baseline gap-2.5 text-[15px] font-semibold leading-snug text-[#1A1228]">
                  <span className="mt-[0.55em] h-px w-2.5 shrink-0 bg-[#D3126A]" aria-hidden="true" />
                  <span>No switch required</span>
                </div>
                <div className="flex items-baseline gap-2.5 text-[15px] font-semibold leading-snug text-[#1A1228]">
                  <span className="mt-[0.55em] h-px w-2.5 shrink-0 bg-[#D3126A]" aria-hidden="true" />
                  <span>Arizona-based experts</span>
                </div>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem required>
                          <FormLabel className="text-base font-medium text-[#1A1228]">Full Name *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="John Smith" 
                              data-testid="input-lead-full-name"
                              className="h-12 border-[var(--de-paper-hairline)] bg-white text-base text-[#1A1228] placeholder:text-black/55 focus-visible:border-[#D3126A] focus-visible:ring-2 focus-visible:ring-[#D3126A]/40"
                              disabled={isSubmitting}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem required>
                          <FormLabel className="text-base font-medium text-[#1A1228]">Work Email *</FormLabel>
                          <FormControl>
                            <Input 
                              type="email" 
                              placeholder="john@company.com" 
                              data-testid="input-lead-email"
                              className="h-12 border-[var(--de-paper-hairline)] bg-white text-base text-[#1A1228] placeholder:text-black/55 focus-visible:border-[#D3126A] focus-visible:ring-2 focus-visible:ring-[#D3126A]/40"
                              disabled={isSubmitting}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium text-[#1A1228]">Phone (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              type="tel" 
                              placeholder="(555) 123-4567" 
                              data-testid="input-lead-phone"
                              className="h-12 border-[var(--de-paper-hairline)] bg-white text-base text-[#1A1228] placeholder:text-black/55 focus-visible:border-[#D3126A] focus-visible:ring-2 focus-visible:ring-[#D3126A]/40"
                              disabled={isSubmitting}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium text-[#1A1228]">Company (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Acme Corp" 
                              data-testid="input-lead-company"
                              className="h-12 border-[var(--de-paper-hairline)] bg-white text-base text-[#1A1228] placeholder:text-black/55 focus-visible:border-[#D3126A] focus-visible:ring-2 focus-visible:ring-[#D3126A]/40"
                              disabled={isSubmitting}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button 
                    type="submit"
                    size="lg"
                    data-testid="button-lead-submit"
                    disabled={isSubmitting}
                    className="h-14 w-full justify-center gap-2 border-0 !bg-[#D3126A] text-lg font-semibold text-white shadow-none transition-colors hover:!bg-[#e01874] hover:shadow-none focus-visible:ring-2 focus-visible:ring-[#D3126A]/70"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        {CTA.primary}
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </Button>

                  <div className="flex flex-wrap items-center justify-center gap-6 pt-4">
                    {benefits.map((benefit) => (
                      <div key={benefit.text} className="flex items-center gap-2">
                        <benefit.icon className="w-4 h-4 text-[#D3126A]" />
                        <span className="text-base text-black/60">{benefit.text}</span>
                      </div>
                    ))}
                  </div>
                </form>
              </Form>
            </motion.div>

            <motion.p 
              className="mt-6 text-center text-base text-black/70"
              initial={prefersReducedMotion ? false : { opacity: 0.55 }}
              whileInView={{ opacity: 1 }}
              viewport={revealViewport}
              transition={revealTransition}
            >
              Prefer to call?{" "}
              <a 
                href={PRIMARY_PHONE.telHref}
                data-testid="link-lead-phone"
                className="text-[#D3126A] hover:text-[#f0187a] font-medium transition-colors"
              >
                {PRIMARY_PHONE.display}
              </a>
            </motion.p>
          </div>
        </div>
      </div>
    </section>
  );
};
