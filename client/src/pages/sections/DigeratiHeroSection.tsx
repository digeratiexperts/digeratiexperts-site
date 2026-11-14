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
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast({
        title: "Assessment Request Submitted!",
        description: "We'll contact you within 24 hours to schedule your free assessment.",
        variant: "default",
      });
      
      form.reset();
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="home" className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-purple-700/50 to-transparent"></div>
      
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-400 rounded-full opacity-30 blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-400 rounded-full opacity-30 blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-24 lg:pt-36 lg:pb-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-white">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              <span className="text-yellow-400" style={{color: '#FFD700'}}>Hackers Don't Wait.</span>
              <br />
              <span className="text-white">Protect Your Business Now.</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-100 mb-8">
              Strengthen protection, reduce avoidable cyber risk, and stay ready for compliance conversations—without building an entire IT department in-house.
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                <CheckCircle className="h-5 w-5 text-green-400 mb-1" />
                <p className="text-xs text-gray-100">Insurance &<br/>Compliance-Ready</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                <Shield className="h-5 w-5 text-blue-400 mb-1" />
                <p className="text-xs text-gray-100">24/7 Human-Led<br/>Monitoring</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                <Building className="h-5 w-5 text-purple-400 mb-1" />
                <p className="text-xs text-gray-100">Built for Small<br/>Businesses</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                <FileCheck className="h-5 w-5 text-yellow-400 mb-1" />
                <p className="text-xs text-gray-100">Easy-to-Read<br/>Risk Reports</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <a 
                href="/book"
                target="_blank"
                rel="noopener noreferrer"
                className="h-12 px-8 rounded-md bg-white text-purple-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-purple-600 transition-all duration-200 shadow-lg hover:shadow-xl inline-flex items-center justify-center gap-2 whitespace-nowrap text-base font-semibold"
                data-testid="button-hero-start"
                aria-label="Get free assessment - Schedule with our experts"
              >
                Get Free Assessment <ArrowRight className="ml-2 h-5 w-5" />
              </a>
              <a
                href="tel:[DE_PUBLIC_PHONE]"
                className="h-12 px-8 rounded-md border-2 border-white bg-transparent text-white hover:bg-white hover:text-purple-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-purple-600 transition-all duration-200 inline-flex items-center justify-center gap-2 whitespace-nowrap text-base font-semibold group"
                data-testid="button-hero-phone"
              >
                <Phone className="h-5 w-5 group-hover:text-purple-600 transition-colors duration-200" />
                [DE_PUBLIC_PHONE]
              </a>
            </div>
          </div>

          <div className="relative" id="assessment-form">
            <div className="relative z-10">
              <Card className="backdrop-blur-md bg-white/95 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-2xl">Get Started Today</CardTitle>
                  <CardDescription>Lock In 80% Off Your Cyber Risk Assessment — Act Now to Identify Vulnerabilities Before Hackers Do.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="John Smith" 
                                data-testid="input-full-name"
                                className="focus-visible:ring-purple-600 focus-visible:ring-offset-0 transition-all duration-200"
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
                          <FormItem>
                            <FormLabel>Email Address *</FormLabel>
                            <FormControl>
                              <Input 
                                type="email" 
                                placeholder="john@company.com" 
                                data-testid="input-email"
                                className="focus-visible:ring-purple-600 focus-visible:ring-offset-0 transition-all duration-200"
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
                            <FormLabel>Phone Number *</FormLabel>
                            <FormControl>
                              <Input 
                                type="tel" 
                                placeholder="(480) 000-0000" 
                                data-testid="input-phone"
                                className="focus-visible:ring-purple-600 focus-visible:ring-offset-0 transition-all duration-200"
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
                            <FormLabel>Company Name *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Your Company Inc." 
                                data-testid="input-company"
                                className="focus-visible:ring-purple-600 focus-visible:ring-offset-0 transition-all duration-200"
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
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2 transition-all duration-200 shadow-md hover:shadow-lg" 
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
                          "Get My Free Assessment"
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
