import { Mail, Shield, Lock, TrendingUp, Users, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { motion, useReducedMotion } from "framer-motion";
import { PatternOverlay, DiagonalDivider } from "@/components/SectionPatterns";

// Import avatar strip image
import avatarsImg from "@assets/Frame-2131330726_1767027918695.png";

export const DigeratiNewsletterSection = (): JSX.Element => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to subscribe');
      }
      
      toast({
        title: "Successfully Subscribed!",
        description: "You'll receive our security updates and expert insights.",
        variant: "default",
      });
      
      setEmail("");
      setIsSubscribed(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to subscribe. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const benefits = [
    { icon: Shield, label: "Security Alerts", color: "text-violet-600" },
    { icon: Lock, label: "Best Practices", color: "text-violet-600" },
    { icon: TrendingUp, label: "Industry Trends", color: "text-violet-600" },
    { icon: Users, label: "Expert Insights", color: "text-violet-600" },
  ];

  return (
    <section 
      className="py-14 md:py-24 pt-16 md:pt-32 pb-16 md:pb-32 relative overflow-hidden"
      style={{ 
        background: 'linear-gradient(135deg, #F7FAFC 0%, #EDF2F7 50%, #E2E8F0 100%)'
      }}
    >
      {/* Subtle diagonal transition with violet accent */}
      <DiagonalDivider position="bottom" toColor="#0a0a0a" height={50} angle="right" />
      
      {/* Pattern overlay */}
      <PatternOverlay variant="dots" opacity={0.025} />
      
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-violet-200/30 rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto">
          <motion.div 
            className="text-center"
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Avatar strip */}
            <div className="flex justify-center mb-8">
              <img 
                src={avatarsImg} 
                alt="Our community members" 
                loading="lazy"
                decoding="async"
                width={168}
                height={56}
                className="h-12 md:h-14"
              />
            </div>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-4 text-gray-900">
              Subscribe to Our Newsletter & <span className="text-violet-600">Stay Secure</span>
            </h2>
            <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Enter your email to receive expert updates and personalized security advice.
            </p>

            {/* Email form - Clean card style */}
            <div className="max-w-xl mx-auto mb-10">
              {isSubscribed ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white shadow-xl border border-emerald-200"
                  data-testid="newsletter-success"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">You're Subscribed!</h3>
                  <p className="text-gray-600 text-center">Check your inbox for a confirmation email. Welcome to our security community!</p>
                  <Button
                    variant="ghost"
                    onClick={() => setIsSubscribed(false)}
                    className="text-violet-600 hover:text-violet-700"
                  >
                    Subscribe another email
                  </Button>
                </motion.div>
              ) : (
                <form 
                  onSubmit={handleSubmit} 
                  className="flex flex-col sm:flex-row gap-3 p-2 rounded-2xl bg-white shadow-xl border border-gray-200"
                >
                  <Input
                    type="email"
                    placeholder="Enter your work email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="input-newsletter-email"
                    className="flex-1 h-12 border-0 shadow-none focus-visible:ring-0 text-gray-900 placeholder:text-gray-400"
                    disabled={isSubmitting}
                    required
                  />
                  <Button
                    type="submit"
                    size="lg"
                    data-testid="button-newsletter-submit"
                    className="h-12 px-8 bg-violet-600 hover:bg-violet-700 text-white font-semibold shadow-lg"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Subscribing...
                      </>
                    ) : (
                      <>
                        Subscribe
                        <Mail className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto mb-8">
              {benefits.map((benefit) => (
                <div key={benefit.label} className="flex items-center justify-center gap-2 text-gray-700">
                  <benefit.icon className={`h-5 w-5 ${benefit.color}`} />
                  <span className="text-base">{benefit.label}</span>
                </div>
              ))}
            </div>

            {/* Trust indicator */}
            <p className="text-base text-gray-500">
              Practical monthly security insights for busy Arizona business leaders.
              <br />
              <span className="text-sm text-gray-400">Unsubscribe anytime. We respect your privacy.</span>
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
