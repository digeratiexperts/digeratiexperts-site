import { motion, useReducedMotion } from "framer-motion";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { useState } from "react";
import { SituationContinuityStrip } from "@/components/SituationContinuityStrip";
import { situationSubmitPayload, useAnonymousSituation } from "@/lib/anonymousSituation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Loader2, Shield, Clock, CheckCircle } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";
import {
  HomeChapter,
  HomeChapterHeader,
  HomeContainer,
  buttonPrimary,
  buttonSecondary,
  cardDark,
  cardPaper,
  Eyebrow,
  ledeClass,
  titleClass,
  textLinkClass,
} from "@/components/home/HomeChapter";

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
  const situation = useAnonymousSituation();

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
          ...situationSubmitPayload(),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Submission failed");
      }
      
      toast({
        title: "Assessment Request Submitted!",
        description: "We'll contact you to discuss and schedule your Cyber Risk Assessment.",
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
    { icon: Clock, text: "Findings in plain English" },
    { icon: CheckCircle, text: "No obligation, no credit card" },
  ];

  return (
    <HomeChapter tone="paper" id="assessment-form">
      <HomeContainer>
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-14">
          <motion.div
            className="lg:col-span-5"
            initial={prefersReducedMotion ? false : revealInitial}
            whileInView={revealInView}
            viewport={revealViewport}
            transition={revealTransition}
          >
            <Eyebrow tone="paper" className="mb-4">
              Cyber Risk Assessment
            </Eyebrow>
            <h2 className={`${titleClass} max-w-[20ch]`}>Get Your Free Security Assessment</h2>
            <p className={`${ledeClass("paper")} mt-5 max-w-xl`}>
              {situation
                ? "We'll size this Cyber Risk Assessment against the environment you already started in the Store. You do not need to retype users, computers, or sites."
                : "Discover vulnerabilities before attackers do. Our experts will analyze your security posture and provide actionable recommendations."}
            </p>

            <ul className="mt-8 divide-y divide-[var(--de-paper-hairline)] border-y border-[var(--de-paper-hairline)]">
              {benefits.map((benefit) => (
                <li key={benefit.text} className="flex items-center gap-3 py-3 text-base text-[#1A1228]">
                  <benefit.icon className="h-4 w-4 shrink-0 text-[#D3126A]" aria-hidden="true" />
                  <span>{benefit.text}</span>
                </li>
              ))}
            </ul>

            <p className="mt-6 text-base text-[#5A5368]">
              Prefer to call?{" "}
              <a
                href={PRIMARY_PHONE.telHref}
                data-testid="link-lead-phone"
                className="font-semibold text-de-magenta-paper-ink transition-colors hover:text-[#D3126A]"
              >
                {PRIMARY_PHONE.display}
              </a>
            </p>
          </motion.div>

          <motion.div
            className={`${cardPaper} p-6 md:p-8 lg:col-span-7`}
            initial={prefersReducedMotion ? false : revealInitial}
            whileInView={revealInView}
            viewport={revealViewport}
            transition={revealTransition}
          >
              {situation ? (
                <SituationContinuityStrip situation={situation} door="assessment" tone="paper" className="mb-6" />
              ) : null}
              <ul className="mb-6 flex flex-wrap gap-x-6 gap-y-2 border-b border-[var(--de-paper-hairline)] pb-5">
                {["Independent findings", "No switch required", "Arizona-based experts"].map((item) => (
                  <li key={item} className="flex items-baseline gap-2.5 text-[15px] font-semibold leading-snug text-[#1A1228]">
                    <span className="mt-[0.55em] h-px w-2.5 shrink-0 bg-[#D3126A]" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                    className="h-auto min-h-12 w-full justify-center gap-2 whitespace-normal border-0 px-4 py-3 text-center !bg-[#D3126A] sm:px-8 text-base font-semibold text-white shadow-none transition-colors hover:!bg-[#e01874] hover:shadow-none focus-visible:ring-2 focus-visible:ring-[#ec4899]"
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
                </form>
              </Form>
          </motion.div>
        </div>
      </HomeContainer>
    </HomeChapter>
  );
};
