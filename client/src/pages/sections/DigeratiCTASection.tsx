import { Shield, Mail, CheckCircle, KeyRound } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import ctaBgImage from "@assets/lucid-origin_a_cinematic_photo_of_ultra_wide_abstract_backgrou_1775876876672.jpg";


const badges = [
  { name: "Identity & Access", icon: KeyRound },
  { name: "Endpoints", icon: Shield },
  { name: "Backup & Recovery", icon: CheckCircle },
  { name: "Email Security", icon: Mail },
];

export const DigeratiCTASection = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <section className="py-12 lg:py-16 bg-[#0a0a0a] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <img src={ctaBgImage} alt="" loading="lazy" className="absolute top-0 left-0 w-full h-auto opacity-[0.15]" />
      </div>
      {/* Subtle purple glow */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(139, 92, 246, 0.10) 0%, transparent 60%)" }}
      />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        {/* Animated headline with light sweep */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative inline-block"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight mb-6 relative overflow-hidden">
            <span className="relative z-10">
              Start With a{" "}
              <span className="text-violet-400">
                Clear Assessment
              </span>
              {" "}of What Matters
            </span>
            {/* Light sweep animation - hidden for reduced motion */}
            {!prefersReducedMotion && (
              <motion.span
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
                initial={{ x: "-100%" }}
                animate={{ x: "200%" }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  repeatDelay: 4,
                  ease: "easeInOut",
                }}
              />
            )}
          </h2>
        </motion.div>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg md:text-xl text-gray-300 leading-relaxed mb-2"
        >
          We will look at the environment first, explain the meaningful risks, and recommend what fits—without forcing a package before we understand the problem.
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-sm text-gray-400 mb-6"
        >
          Scope, deliverables, timing, and any applicable credit are confirmed in writing before work begins.
        </motion.p>
        
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="text-gray-300 mb-10 font-semibold"
        >
          No scare tactics. No mystery score. No handoff after the sale.
        </motion.p>
        
        {/* CTA Button with intense glow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.7 }}
        >
          <motion.button
            className="h-14 px-10 rounded-xl bg-white text-black text-lg font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all duration-300 hover:bg-white/90"
            data-testid="button-cta-assessment"
            onClick={() => {
              document.getElementById('assessment-form')?.scrollIntoView({ behavior: 'smooth' });
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Request My Assessment
          </motion.button>
        </motion.div>
        
        {/* Floating Badge Strip */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="mt-16"
        >
          <p className="text-gray-500 text-sm uppercase tracking-wider mb-6">
            What the assessment covers
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {badges.map((badge, index) => {
              const IconComponent = badge.icon;
              return (
                <motion.div
                  key={badge.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 1 + index * 0.1 }}
                  whileHover={{ 
                    scale: 1.05,
                    borderColor: "rgba(139,92,246,0.5)"
                  }}
                  className="flex items-center gap-2 px-5 py-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full transition-all duration-300 hover:bg-white/10"
                  data-testid={`badge-${badge.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <IconComponent className="h-4 w-4 text-violet-400" />
                  <span className="text-base font-medium text-gray-300">{badge.name}</span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
      
      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0118] to-transparent pointer-events-none" />
    </section>
  );
};
