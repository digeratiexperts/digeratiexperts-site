import { useState, useEffect } from 'react';
import { analytics } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, ChevronLeft, Loader2 } from 'lucide-react';
import { isValidCorporateEmail } from '@/lib/emailValidator';
import { useLocation } from 'wouter';
import { useSEO } from '@/hooks/useSEO';
import { MegaMenu } from '@/components/MegaMenu';
import { DigeratiEnhancedFooterSection } from '@/pages/sections/DigeratiEnhancedFooterSection';

// Step 1: Seat sizing
const step1Schema = z.object({
  seats: z.number().min(1).max(100),
  enterpriseToggle: z.boolean(),
});

// Step 2: Needs snapshot
const step2Schema = z.object({
  connectivity: z.enum(['yes', 'no', 'not-sure']),
  devices: z.enum(['yes', 'no', 'not-sure']),
});

// Step 3: Lead capture
const step3Schema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  company: z.string().min(2, 'Company name must be at least 2 characters'),
  email: z.string().email('Invalid email format').refine(
    isValidCorporateEmail,
    'Please use your company email address, not a personal email'
  ),
  consent: z.boolean().refine(val => val === true, 'You must agree to be contacted'),
});

// Full form data
const fullFormSchema = step1Schema.merge(step2Schema).merge(step3Schema);
type FormData = z.infer<typeof fullFormSchema>;

/** Same paper-field recipe as the contact form — dark ink on white inputs. */
const paperFieldClass =
  "h-11 bg-white border-[var(--de-paper-hairline)] text-[#1A1228] placeholder:text-black/55 focus-visible:ring-2 focus-visible:ring-[#D3126A]/40 focus-visible:border-[#D3126A]";

const paperSelectClass =
  "h-11 bg-white border-[var(--de-paper-hairline)] text-[#1A1228] focus:ring-[#D3126A]/40";

const paperOutlineClass =
  "border-[var(--de-paper-hairline)] text-[#1A1228] hover:border-[#D3126A] hover:bg-de-paper hover:text-[#1A1228]";

const getPlanMatch = (data: {
  seats: number;
  enterpriseToggle: boolean;
  connectivity: string;
  devices: string;
}): { plan: string; reasons: string[] } => {
  if (data.enterpriseToggle || data.seats > 30) {
    return {
      plan: 'Enterprise',
      reasons: [
        'Full compliance modules (HIPAA, GDPR, FTC Safeguards)',
        'Penetration testing, DR runbooks, and privileged access controls',
        'AI & Cloud Automation + vCIO strategic guidance'
      ]
    };
  }

  if (data.connectivity === 'yes' && data.devices === 'yes') {
    return {
      plan: 'Business',
      reasons: [
        'Deeper security operations + 24/7 managed threat response',
        'BCDR + compliance/risk reporting + Security Awareness Training',
        'Technology + security business reviews + Cyber Insurance Readiness'
      ]
    };
  }

  if (data.connectivity === 'yes') {
    return {
      plan: 'Business',
      reasons: [
        '24/7 managed threat response with deeper security operations',
        'Advanced identity controls + BCDR / risk reporting depth',
        'Cyber insurance readiness and recurring security reviews'
      ]
    };
  }

  if (data.devices === 'yes') {
    return {
      plan: 'Office',
      reasons: [
        'Email + Calendar + Team Chat with MFA + SSO',
        'Endpoint Security + Email Protection + 24/7 MDR',
        'Managed Network + Service Desk + Endpoint Backup'
      ]
    };
  }

  return {
    plan: 'Office',
    reasons: [
      'Security-first IT with MFA, SSO, and Password Manager',
      'Endpoint Security + Email Protection + 24/7 MDR',
      'Service Desk + Managed Network + Endpoint Backup'
    ]
  };
};

export default function LeadQuoteWizard() {
  useSEO({
    title: 'Get a Quote - IT Services Pricing',
    description: 'Get an instant quote for managed IT and cybersecurity services. Simple 3-step process to find the right plan for your business.',
    canonical: '/quote',
  });

  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    analytics.quoteWizardStarted();
  }, []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [recommendedPlan, setRecommendedPlan] = useState<{ plan: string; reasons: string[] } | null>(null);
  const [formData, setFormData] = useState<Partial<FormData>>({
    seats: 10,
    enterpriseToggle: false,
    connectivity: 'not-sure',
    devices: 'not-sure',
  });
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<FormData>({
    resolver: zodResolver(
      currentStep === 1 ? step1Schema : currentStep === 2 ? step2Schema : step3Schema
    ),
    defaultValues: formData,
  });

  const handleStep1Next = async () => {
    const data = await form.trigger(['seats', 'enterpriseToggle']);
    if (data) {
      setFormData(prev => ({ ...prev, ...form.getValues() }));
      analytics.quoteWizardStep(2, "needs_snapshot");
      setCurrentStep(2);
      window.scrollTo(0, 0);
    }
  };

  const handleStep2Next = async () => {
    const data = await form.trigger(['connectivity', 'devices']);
    if (data) {
      setFormData(prev => ({ ...prev, ...form.getValues() }));
      analytics.quoteWizardStep(3, "lead_capture");
      setCurrentStep(3);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    
    try {
      const plan = getPlanMatch({
        seats: data.seats,
        enterpriseToggle: data.enterpriseToggle,
        connectivity: data.connectivity,
        devices: data.devices,
      });

      const payload = {
        seats: data.seats,
        enterpriseToggle: data.enterpriseToggle,
        connectivity: data.connectivity,
        devices: data.devices,
        recommendedPlan: plan.plan,
        firstName: data.firstName,
        lastName: data.lastName,
        company: data.company,
        email: data.email,
        consent: data.consent,
        source: 'header-instant-quote',
        pageUrl: window.location.href,
        timestamp: new Date().toISOString(),
      };

      const response = await fetch('/api/lead-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to submit form');

      analytics.quoteWizardCompleted({ users: data.seats });
      setRecommendedPlan(plan);
      setFormData(prev => ({ ...prev, ...data }));
      setShowResults(true);

      // Navigate to confirmation page with data
      sessionStorage.setItem('leadQuoteResult', JSON.stringify({
        plan: plan.plan,
        reasons: plan.reasons,
        firstName: data.firstName,
        company: data.company,
      }));

      setLocation('/quote-confirmation');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process your request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-de-bg">
      <MegaMenu />
      <main className="de-nav-clear px-4 py-16 md:py-20">
      <div className="de-paper-lift-lg mx-auto w-full max-w-2xl rounded-2xl p-6 text-[#1A1228] md:p-8">
      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex flex-1 items-center gap-2">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`h-2 flex-1 rounded-full transition-colors ${
                step <= currentStep ? 'bg-[#D3126A]' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <span className="ml-4 text-sm text-black/55">Step {currentStep} of 3</span>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Step 1: Seat Sizing */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h1 className="mb-2 text-2xl font-bold text-[#1A1228]">How many users?</h1>
                <p className="text-black/55">Includes employees and shared devices.</p>
              </div>

              <FormField
                control={form.control}
                name="seats"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#1A1228]">User Count: {field.value}</FormLabel>
                    <FormControl>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        disabled={form.watch('enterpriseToggle')}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#D3126A]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enterpriseToggle"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-3">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0 text-[#1A1228]">More than 100 users? We'll tailor enterprise sizing.</FormLabel>
                  </FormItem>
                )}
              />

              <div className="flex gap-3">
                <Button variant="outline" type="button" className={paperOutlineClass} onClick={() => setLocation('/')}>
                  Skip and talk to us
                </Button>
                <Button variant="brand" type="button" className="ml-auto" onClick={handleStep1Next}>
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Needs Snapshot */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h1 className="mb-2 text-2xl font-bold text-[#1A1228]">What do you need?</h1>
                <p className="text-black/55">Help us understand your infrastructure needs.</p>
              </div>

              <FormField
                control={form.control}
                name="connectivity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#1A1228]">Do you need secure connectivity and cloud storage?</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className={paperSelectClass}>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="not-sure">Not sure</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="devices"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#1A1228]">Do you need desktops and laptops managed?</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className={paperSelectClass}>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="not-sure">Not sure</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3">
                <Button variant="outline" type="button" className={paperOutlineClass} onClick={() => setCurrentStep(1)}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button variant="brand" type="button" className="ml-auto" onClick={handleStep2Next}>
                  See My Best Plan <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Lead Capture */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h1 className="mb-2 text-2xl font-bold text-[#1A1228]">Show Me The Best Plan!</h1>
                <p className="text-black/55">We'll need a few details to confirm your perfect fit.</p>
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem required>
                    <FormLabel className="text-[#1A1228]">Company Email *</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="your.name@company.com"
                        className={paperFieldClass}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem required>
                      <FormLabel className="text-[#1A1228]">First Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="First name" className={paperFieldClass} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem required>
                      <FormLabel className="text-[#1A1228]">Last Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Last name" className={paperFieldClass} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem required>
                    <FormLabel className="text-[#1A1228]">Company Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Your company" className={paperFieldClass} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="consent"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-3">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0 text-sm text-[#1A1228]">I agree to be contacted about my plan match</FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3">
                <Button variant="outline" type="button" className={paperOutlineClass} onClick={() => setCurrentStep(2)}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button type="submit" variant="brand" className="ml-auto" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Get My Instant Match
                </Button>
              </div>
            </div>
          )}
        </form>
      </Form>
      </div>
      </main>
      <DigeratiEnhancedFooterSection />
    </div>
  );
}
