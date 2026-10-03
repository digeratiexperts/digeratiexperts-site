import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, CheckCircle, Shield, Building, FileCheck, Phone, Loader2 } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";

// Form validation schema
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

export const DigeratiHeroSection = (): JSX.Element => {
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
          source: "hero_assessment",
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
    <section id="home" className="relative overflow-hidden">
      <div className="absolute inset-0 bg-de-bg"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-de-raised/40 to-transparent"></div>
      
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-de-raised rounded-full opacity-40 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-de-raised rounded-full opacity-40 blur-3xl"></div>
      </div>

      <div className="relative max-w-[var(--de-canvas)] mx-auto px-3 sm:px-4 lg:px-6 pt-[calc(var(--de-nav-offset)+0.5rem)] pb-24 lg:pt-[calc(var(--de-nav-offset)+2rem)] lg:pb-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-white">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              <span className="text-de-accent-ink">Hackers Don't Wait.</span>
              <br />
              <span className="text-white">Protect Your Business Now.</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-100 mb-8">
              Get 24/7 protection, cut cyber liability, and pass compliance checks — all without hiring in-house IT.
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-de-raised border border-de-hairline rounded-lg p-3">
                <CheckCircle className="h-5 w-5 text-de-accent-ink mb-1" />
                <p className="text-xs text-white/80">Insurance &<br/>Compliance-Ready</p>
              </div>
              <div className="bg-de-raised border border-de-hairline rounded-lg p-3">
                <Shield className="h-5 w-5 text-de-accent-ink mb-1" />
                <p className="text-xs text-white/80">24/7 Human-Led<br/>Monitoring</p>
              </div>
              <div className="bg-de-raised border border-de-hairline rounded-lg p-3">
                <Building className="h-5 w-5 text-de-accent-ink mb-1" />
                <p className="text-xs text-white/80">Built for Small<br/>Businesses</p>
              </div>
              <div className="bg-de-raised border border-de-hairline rounded-lg p-3">
                <FileCheck className="h-5 w-5 text-de-accent-ink mb-1" />
                <p className="text-xs text-white/80">Easy-to-Read<br/>Risk Reports</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <a 
                href="/book"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-[#D3126A] px-8 text-base font-semibold text-white hover:bg-[#e01874] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2"
                data-testid="button-hero-start"
                aria-label="Get Cyber Risk Assessment - Schedule with our experts"
              >
                {CTA.primary} <ArrowRight className="ml-2 h-5 w-5" />
              </a>
              <a
                href={PRIMARY_PHONE.telHref}
                className="inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-md border-2 border-white bg-transparent px-8 text-base font-semibold text-white hover:bg-white hover:text-[#D3126A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-bg)] group"
                data-testid="button-hero-phone"
              >
                <Phone className="h-5 w-5 group-hover:text-[#D3126A] transition-colors duration-200" />
                {PRIMARY_PHONE.display}
              </a>
            </div>
          </div>

          <div className="relative" id="assessment-form">
            <div className="relative z-10">
              <Card className="border border-de-hairline bg-white shadow-none">
                <CardHeader>
                  <CardTitle className="text-2xl">Get Started Today</CardTitle>
                  <CardDescription>Request a Cyber Risk Assessment — we’ll identify vulnerabilities and send independent findings you can use with your current IT or with us.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem required>
                            <FormLabel>Full Name *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="John Smith" 
                                data-testid="input-full-name"
                                className="focus-visible:ring-[#D3126A] focus-visible:ring-offset-0 transition-all duration-200"
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
                            <FormLabel>Email Address *</FormLabel>
                            <FormControl>
                              <Input 
                                type="email" 
                                placeholder="john@company.com" 
                                data-testid="input-email"
                                className="focus-visible:ring-[#D3126A] focus-visible:ring-offset-0 transition-all duration-200"
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
                          <FormItem required>
                            <FormLabel>Phone Number *</FormLabel>
                            <FormControl>
                              <Input 
                                type="tel" 
                                placeholder="(480) 000-0000" 
                                data-testid="input-phone"
                                className="focus-visible:ring-[#D3126A] focus-visible:ring-offset-0 transition-all duration-200"
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
                            <FormLabel>Company Name *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Your Company Inc." 
                                data-testid="input-company"
                                className="focus-visible:ring-[#D3126A] focus-visible:ring-offset-0 transition-all duration-200"
                                disabled={isSubmitting}
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <p className="text-xs text-gray-500">
                        All information submitted is protected and handled in compliance with our Privacy Policy.
                      </p>
                      
                      <Button 
                        className="w-full bg-[#D3126A] text-white hover:bg-[#e01874] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2" 
                        data-testid="button-submit"
                        type="submit"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};