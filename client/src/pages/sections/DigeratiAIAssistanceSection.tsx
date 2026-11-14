import { Bot, Cpu, Brain, Sparkles, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, useReducedMotion } from "framer-motion";

import teamMeetingImg from "@assets/business-colleagues-working-office_1767027918693.png";

export const DigeratiAIAssistanceSection = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();
  
  const aiFeatures = [
    "AI-assisted signal triage and pattern detection",
    "Automated response for pre-approved workflows",
    "Risk-based vulnerability prioritization",
    "Behavior and anomaly signals for human review",
    "Clearer summaries for faster decisions",
    "Escalation paths with accountable human oversight"
  ];

  return (
    <section className="py-20 relative overflow-hidden bg-[#0a0a0a]">
      {/* Subtle violet accent glow */}
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: "radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.06) 0%, transparent 60%)" }} />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Image */}
          <motion.div 
            className="flex justify-center lg:justify-start order-2 lg:order-1"
            initial={prefersReducedMotion ? {} : { opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="relative">
              {/* Decorative elements */}
              <div className="absolute -inset-4 bg-violet-500/15 rounded-3xl blur-2xl" />
              
              {/* Main image */}
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                <img 
                  src={teamMeetingImg} 
                  alt="Expert team collaboration" 
                  loading="lazy"
                  decoding="async"
                  width={448}
                  height={300}
                  className="w-full max-w-md object-cover"
                />
                
                {/* Overlay with stats */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6">
                  <div className="flex gap-6">
                    <div className="text-center">
                      <div className="text-base font-bold text-white">Automated</div>
                      <div className="text-xs text-gray-300">Detection</div>
                    </div>
                    <div className="text-center">
                      <div className="text-base font-bold text-white">Human</div>
                      <div className="text-xs text-gray-300">Review</div>
                    </div>
                    <div className="text-center">
                      <div className="text-base font-bold text-white">Clear</div>
                      <div className="text-xs text-gray-300">Escalation</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating AI badge */}
              <motion.div 
                className="absolute -top-6 -right-6 bg-gradient-to-br from-[#1a1a2e] to-[#16162a] backdrop-blur-xl rounded-2xl p-4 shadow-2xl border border-violet-500/20"
                initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.8, y: 20 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                {/* Subtle glow effect behind the card */}
                <div className="absolute inset-0 bg-violet-500/10 rounded-2xl blur-xl -z-10" />
                
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-lg">
                      <Bot className="h-6 w-6 text-white" />
                    </div>
                    {/* Animated ring */}
                    <div className="absolute -inset-1 rounded-xl border-2 border-violet-400/30 animate-pulse" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">AI Status</div>
                    <div className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                      </span>
                      AI-Assisted
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Right side - Content */}
          <motion.div
            className="order-1 lg:order-2"
            initial={prefersReducedMotion ? {} : { opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="mb-6">
              <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 mb-4">
                <Sparkles className="h-3 w-3 mr-1" />
                Human-Led, AI-Assisted
              </Badge>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-white">
                Expert Judgment, <span className="text-violet-400">Accelerated by AI</span>
              </h2>
              <p className="text-lg text-gray-300 mb-6 leading-relaxed">
                Automation can sort signals, surface patterns, and move routine work faster. Experienced people still bring the business context, make judgment calls, and stay accountable for what happens next.
              </p>
            </div>

            <div className="space-y-3 mb-8">
              {aiFeatures.map((feature, index) => (
                <div key={index} className="flex items-start gap-3 text-gray-200">
                  <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            {/* Feature highlights */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 mb-8">
              <h3 className="text-white font-semibold mb-2">Smarter Security, Better Results</h3>
              <p className="text-gray-300 text-base">
                Automation helps sort signals and speed up routine work. People remain responsible for context, escalation, and the decisions that affect your business.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-2 border-white/50 text-white bg-transparent hover:bg-white hover:text-black hover:border-white"
                  data-testid="button-ai-action"
                >
                  <a href="/book">
                    See AI in Action
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </a>
              </Button>
              <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-2 border-white/50 text-white bg-transparent hover:bg-white hover:text-black hover:border-white"
                  data-testid="button-ai-learn-more"
                >
                  <a href="/solutions/security-operations">Learn More</a>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
