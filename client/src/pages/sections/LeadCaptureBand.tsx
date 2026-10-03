import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, CheckCircle, Clock, Award } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CTA } from "@/lib/ctaCopy";

const assessmentFormSchema = z.object({
  fullName: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),
  email: z.string()
    .email("Please enter a valid email address"),
  phone: z.string()
    .regex(/^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/, "Please enter a valid phone number"),
  company: z.string()
    .min(2, "Company name must be at least 2 characters")
    .max(100, "Company name must be less than 100 characters"),
});

type AssessmentFormData = z.infer<typeof assessmentFormSchema>;

const benefits = [
  { icon: Shield, text: "Full vulnerability assessment included", color: "text-de-accent-ink" },
  { icon: CheckCircle, text: "Written findings after we review your environment", color: "text-de-accent-ink" },
  { icon: Clock, text: "No commitment required", color: "text-de-accent-ink" },
  { icon: Award, text: "Expert recommendations included", color: "text-de-accent-ink" },
];

export const LeadCaptureBand = (): JSX.Element => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<AssessmentFormData>({
    resolver: zodResolver(assessmentFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      company: "",
    },
  });

  const handleSubmit = async (data: AssessmentFormData) => {
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
          source: "lead_capture_band",
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((result as { error?: string }).error || "Submission failed");
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
        description: error?.message || "Something went wrong. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section 
      id="assessment-form"
      className="relative py-16 lg:py-20 overflow-hidden bg-de-bg"
    >
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-de-raised/30" />
      </div>

      <div className="relative z-10 mx-auto w-[min(94vw,1400px)] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          
          {/* Left side - Value proposition */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-de-hairline bg-de-raised">
              <span className="text-de-accent-ink text-base font-medium">Cyber Risk Assessment</span>
            </div>
            
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight">
              Get Your{" "}
              <span className="text-de-accent-ink">
                Cyber Risk Assessment
              </span>
            </h2>
            
            <p className="text-lg text-gray-300 leading-relaxed max-w-lg">
              Request a Cyber Risk Assessment. Our security experts will identify vulnerabilities and prioritize what to fix first.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={benefit.text}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className={`p-2 rounded-lg border border-de-hairline bg-de-raised ${benefit.color}`}>
                    <benefit.icon className="w-4 h-4" />
                  </div>
                  <span className="text-gray-300 text-base">{benefit.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right side - Form */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            {/* Glow effect behind card */}
            <div className="absolute -inset-4 bg-de-raised/40 blur-3xl" />
            
            <Card className="relative border border-de-hairline bg-white shadow-none">
              <CardHeader className="pb-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#D3126A]">
                  Cyber Risk Assessment &amp; Consultation
                </p>
                <CardTitle className="text-xl xl:text-2xl font-bold text-[#1A1228] mt-1">
                  Leave with a clear picture of your IT &amp; security risk.
                </CardTitle>
                <CardDescription className="text-sm text-[#2A2438] mt-1">
                  Drop your details below. We'll follow up with independent findings you can use immediately.
                </CardDescription>

                <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-[var(--de-paper-hairline)] bg-[var(--de-paper-raised)] px-3.5 py-2.5 sm:grid-cols-3">
                  <div className="flex items-baseline gap-2 text-xs font-semibold text-[#1A1228]">
                    <span className="mt-[0.55em] h-px w-2.5 shrink-0 bg-[#D3126A]" aria-hidden="true" />
                    <span>Independent findings</span>
                  </div>
                  <div className="flex items-baseline gap-2 text-xs font-semibold text-[#1A1228]">
                    <span className="mt-[0.55em] h-px w-2.5 shrink-0 bg-[#D3126A]" aria-hidden="true" />
                    <span>No switch required</span>
                  </div>
                  <div className="flex items-baseline gap-2 text-xs font-semibold text-[#1A1228]">
                    <span className="mt-[0.55em] h-px w-2.5 shrink-0 bg-[#D3126A]" aria-hidden="true" />
                    <span>Arizona-based experts</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem required>
                            <FormLabel className="text-sm">Full Name *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="John Smith" 
                                data-testid="input-lead-full-name"
                                className="h-11 focus-visible:ring-[#D3126A] focus-visible:ring-offset-0 transition-all duration-200"
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
                            <FormLabel className="text-sm">Email Address *</FormLabel>
                            <FormControl>
                              <Input 
                                type="email" 
                                placeholder="john@company.com" 
                                data-testid="input-lead-email"
                                className="h-11 focus-visible:ring-[#D3126A] focus-visible:ring-offset-0 transition-all duration-200"
                                disabled={isSubmitting}
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem required>
                            <FormLabel className="text-sm">Phone Number *</FormLabel>
                            <FormControl>
                              <Input 
                                type="tel" 
                                placeholder="(480) 000-0000" 
                                data-testid="input-lead-phone"
                                className="h-11 focus-visible:ring-[#D3126A] focus-visible:ring-offset-0 transition-all duration-200"
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
                          <FormItem required>
                            <FormLabel className="text-sm">Company Name *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Your Company Inc." 
                                data-testid="input-lead-company"
                                className="h-11 focus-visible:ring-[#D3126A] focus-visible:ring-offset-0 transition-all duration-200"
                                disabled={isSubmitting}
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <p className="text-xs text-gray-500 pt-1">
                      Protected in compliance with our Privacy Policy.
                    </p>
                    
                    <Button 
                      className="w-full h-12 text-base bg-de-magenta text-white hover:bg-de-magenta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-de-magenta focus-visible:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-[#D3126A]/25" 
                      data-testid="button-lead-submit"
                      type="submit"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        CTA.primary
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
