import { Card, CardContent } from "@/components/ui/card";
import { Star, ChevronLeft, ChevronRight, Quote, Building2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion, useScroll, useTransform } from "framer-motion";
import testimonialsBgImage from "@assets/lucid-origin_a_cinematic_photo_of_ultra_wide_abstract_backgrou_1775876425988.jpg";

import avatar1 from "@assets/stock_images/professional_busines_96e20e69.jpg";
import avatar2 from "@assets/stock_images/doctor_physician_med_6ae69a73.jpg";
import avatar3 from "@assets/stock_images/office_manager_profe_89dfed13.jpg";
import avatar4 from "@assets/stock_images/real_estate_broker_p_f7fb1c14.jpg";
import avatar5 from "@assets/stock_images/professional_busines_525b74f5.jpg";

interface Testimonial {
  rating: number;
  text: string;
  author: string;
  role: string;
  company: string;
  avatar: string;
}

export const DigeratiTestimonialsSection = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  });

  // Parallax transforms - reduced for smoother scroll
  const backgroundY = useTransform(scrollYProgress, [0, 1], prefersReducedMotion ? ["0%", "0%"] : ["-3%", "3%"]);
  const floatingY1 = useTransform(scrollYProgress, [0, 1], [prefersReducedMotion ? 0 : 20, prefersReducedMotion ? 0 : -20]);
  const floatingY2 = useTransform(scrollYProgress, [0, 1], [prefersReducedMotion ? 0 : -15, prefersReducedMotion ? 0 : 15]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [prefersReducedMotion ? 1 : 0.99, 1, prefersReducedMotion ? 1 : 0.99]);
  
  const testimonials: Testimonial[] = [
    {
      rating: 5,
      text: "I need security explained in business terms, with a clear plan my team can actually follow—not another dashboard full of noise.",
      author: "The Business Owner",
      role: "Manufacturing perspective",
      company: "Representative Arizona client",
      avatar: avatar1
    },
    {
      rating: 5,
      text: "Client confidentiality is non-negotiable. I want to know who is watching the environment, who calls us, and what happens next if something looks wrong.",
      author: "The Managing Partner",
      role: "Legal perspective",
      company: "Representative Arizona client",
      avatar: avatar2
    },
    {
      rating: 5, 
      text: "I need the controls and the documentation to tell the same story. When an auditor asks, my team should know where the evidence is and why it matters.",
      author: "The Practice Owner",
      role: "Healthcare perspective",
      company: "Representative Arizona client",
      avatar: avatar3
    },
    {
      rating: 5,
      text: "Email is where our biggest transactions move. We need layers that protect the business without making every agent fight the technology.",
      author: "The Broker-Owner",
      role: "Real estate perspective",
      company: "Representative Arizona client",
      avatar: avatar4
    },
    {
      rating: 5,
      text: "When something breaks, I don’t want to coordinate five vendors. I want one accountable partner who knows the environment and owns the next step.",
      author: "The Operations Leader",
      role: "Veterinary perspective",
      company: "Representative Arizona client",
      avatar: avatar5
    }
  ];

  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [[page, direction], setPage] = useState([0, 0]);

  const handlePrevious = () => {
    setPage([page - 1, -1]);
    setCurrentTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const handleNext = () => {
    setPage([page + 1, 1]);
    setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
  };

  const goToTestimonial = (index: number) => {
    const newDirection = index > currentTestimonial ? 1 : -1;
    setPage([page + newDirection, newDirection]);
    setCurrentTestimonial(index);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        handlePrevious();
      } else if (event.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [page]);

  const slideVariants = prefersReducedMotion ? {
    enter: { opacity: 1 },
    center: { zIndex: 1, opacity: 1 },
    exit: { zIndex: 0, opacity: 1 },
  } : {
    enter: (direction: number) => ({
      x: direction > 0 ? 80 : -80,
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 80 : -80,
      opacity: 0,
      scale: 0.95,
    }),
  };

  return (
    <section 
      ref={sectionRef}
      className="relative py-10 md:py-14 lg:py-16 overflow-hidden"
      style={{
        position: 'relative',
        background: 'linear-gradient(180deg, #0a0a0a 0%, #0f0f1a 50%, #0a0a0a 100%)'
      }}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <img src={testimonialsBgImage} alt="" loading="lazy" decoding="async" className="absolute top-0 left-0 w-full h-auto opacity-[0.15]" />
      </div>
      {/* Parallax Background Elements */}
      <motion.div 
        className="absolute inset-0 pointer-events-none"
        style={{ y: backgroundY }}
      >
        {/* Large gradient orb - top right */}
        <div 
          className="absolute -top-20 -right-20 w-[600px] h-[600px] opacity-30"
          style={{ 
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, rgba(168, 85, 247, 0.1) 40%, transparent 70%)",
            filter: "blur(60px)"
          }}
        />
        {/* Smaller orb - bottom left */}
        <div 
          className="absolute -bottom-20 -left-20 w-[400px] h-[400px] opacity-20"
          style={{ 
            background: "radial-gradient(circle, rgba(192, 38, 211, 0.3) 0%, rgba(139, 92, 246, 0.1) 40%, transparent 70%)",
            filter: "blur(40px)"
          }}
        />
      </motion.div>

      {/* Floating decorative elements with parallax */}
      <motion.div 
        className="absolute top-20 left-10 w-20 h-20 opacity-10 pointer-events-none"
        style={{ y: floatingY1 }}
      >
        <div className="w-full h-full rounded-full border-2 border-violet-500" />
      </motion.div>
      <motion.div 
        className="absolute bottom-32 right-16 w-12 h-12 opacity-10 pointer-events-none"
        style={{ y: floatingY2 }}
      >
        <div className="w-full h-full rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 rotate-45" />
      </motion.div>
      <motion.div 
        className="absolute top-1/2 right-8 w-8 h-8 opacity-5 pointer-events-none"
        style={{ y: floatingY1 }}
      >
        <Star className="w-full h-full text-violet-400" />
      </motion.div>

      <motion.div 
        className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 z-10"
        style={{ scale }}
      >
        {/* Header */}
        <motion.div 
          className="text-center mb-8 md:mb-12 lg:mb-16"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.35 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-violet-500/10 border border-violet-500/20 mb-4 md:mb-6">
            <Building2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-violet-400" />
            <span className="text-xs md:text-sm font-medium text-violet-300">Representative Client Perspectives</span>
          </div>
          
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6 text-white px-4">
            Built Around What <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">Arizona Leaders</span> Actually Need
          </h2>
          
          <p className="mx-auto mb-5 max-w-3xl px-4 text-sm leading-relaxed text-white/55 md:text-base">
            These perspectives capture common conversations with local business leaders. Named client stories will appear only with their approval.
          </p>

          <div className="flex items-center justify-center gap-1 mb-2 md:mb-4" role="img" aria-label="Five priorities highlighted">
            {[...Array(5)].map((_, i) => (
              <Star 
                key={i} 
                className="h-5 w-5 md:h-7 md:w-7 fill-current" 
                style={{
                  color: '#fbbf24',
                  filter: 'drop-shadow(0 0 6px rgba(251, 191, 36, 0.6))'
                }}
                aria-hidden="true"
                data-testid={`star-rating-${i}`}
              />
            ))}
            <span className="ml-2 md:ml-3 text-base md:text-lg font-semibold text-amber-400">5 priorities</span>
          </div>
        </motion.div>

        {/* Testimonial Card */}
        <motion.div 
          className="max-w-4xl mx-auto"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="relative">
            {/* Gradient border wrapper */}
            <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-br from-violet-500/50 via-purple-500/30 to-fuchsia-500/50 opacity-60" />
            
            {/* Quote decoration */}
            <motion.div 
              className="absolute -top-4 md:-top-6 -left-1 md:-left-6 z-20 pointer-events-none"
              style={{ y: floatingY2 }}
            >
              <div className="w-12 h-12 md:w-20 md:h-20 rounded-xl md:rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-xl shadow-violet-500/30">
                <Quote className="w-6 h-6 md:w-10 md:h-10 text-white" />
              </div>
            </motion.div>

            <Card className="relative bg-[#111111]/90 backdrop-blur-xl border-0 rounded-2xl md:rounded-3xl overflow-hidden">
              <CardContent className="px-6 py-8 md:p-12">
                {/* Stars row */}
                <div className="flex items-center justify-center gap-1 mb-4 md:mb-8" role="img" aria-label="A representative client priority">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      className="h-4 w-4 md:h-5 md:w-5 fill-current"
                      style={{
                        color: '#fbbf24',
                        filter: 'drop-shadow(0 0 4px rgba(251, 191, 36, 0.5))'
                      }}
                      aria-hidden="true"
                      data-testid={`testimonial-star-${i}`}
                    />
                  ))}
                  <span className="ml-2 md:ml-3 text-xs md:text-sm font-medium text-white/60">What good partnership feels like</span>
                </div>
                
                {/* Testimonial content with animation */}
                <div className="relative min-h-[200px] md:min-h-[180px] mb-6 md:mb-8 px-1 md:px-8">
                  <AnimatePresence initial={false} custom={direction} mode="wait">
                    <motion.div
                      key={currentTestimonial}
                      custom={direction}
                      variants={slideVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{
                        x: { type: "spring", stiffness: 300, damping: 30 },
                        opacity: { duration: 0.25 },
                        scale: { duration: 0.25 },
                      }}
                      className="absolute inset-0"
                    >
                      <p className="text-base md:text-xl lg:text-2xl text-white/90 italic text-center leading-relaxed mb-6 md:mb-8" data-testid="testimonial-text">
                        "{testimonials[currentTestimonial].text}"
                      </p>
                      
                      {/* Author info */}
                      <div className="flex items-center justify-center gap-3 md:gap-4">
                        <div className="relative">
                          <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 opacity-70 blur-sm" />
                          <img 
                            src={testimonials[currentTestimonial].avatar}
                            alt={testimonials[currentTestimonial].author}
                            loading="lazy"
                            decoding="async"
                            width={56}
                            height={56}
                            className="relative w-10 h-10 md:w-14 md:h-14 rounded-full object-cover border-2 border-white/20"
                          />
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-base md:text-lg text-white" data-testid="testimonial-author">
                            {testimonials[currentTestimonial].author}
                          </div>
                          <div className="text-violet-400 font-medium text-sm md:text-base" data-testid="testimonial-role">
                            {testimonials[currentTestimonial].role}
                          </div>
                          <div className="text-white/50 text-xs md:text-sm">
                            {testimonials[currentTestimonial].company}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
            
            {/* Navigation arrows - positioned outside card on mobile */}
            <button
              onClick={handlePrevious}
              className="absolute top-1/2 -translate-y-1/2 -left-2 md:left-4 z-10 p-2 md:p-3 rounded-full bg-black/60 md:bg-white/5 backdrop-blur-sm border border-white/20 md:border-white/10 hover:bg-violet-500/20 hover:border-violet-500/40 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-violet-500 group"
              data-testid="testimonial-prev"
              aria-label="Previous testimonial"
              type="button"
            >
              <ChevronLeft className="h-4 w-4 md:h-5 md:w-5 text-white/70 group-hover:text-white transition-colors" />
            </button>

            <button
              onClick={handleNext}
              className="absolute top-1/2 -translate-y-1/2 -right-2 md:right-4 z-10 p-2 md:p-3 rounded-full bg-black/60 md:bg-white/5 backdrop-blur-sm border border-white/20 md:border-white/10 hover:bg-violet-500/20 hover:border-violet-500/40 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-violet-500 group"
              data-testid="testimonial-next"
              aria-label="Next testimonial"
              type="button"
            >
              <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-white/70 group-hover:text-white transition-colors" />
            </button>
          </div>

          {/* Pagination dots */}
          <div className="flex justify-center mt-6 md:mt-8 gap-2 md:gap-3">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => goToTestimonial(index)}
                className={`h-2 md:h-3 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] hover:scale-125 ${
                  currentTestimonial === index 
                    ? 'w-6 md:w-10 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 shadow-lg shadow-violet-500/40' 
                    : 'w-2 md:w-3 bg-white/20 hover:bg-white/40'
                }`}
                aria-label={`Go to testimonial ${index + 1}`}
                data-testid={`testimonial-indicator-${index}`}
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
};
