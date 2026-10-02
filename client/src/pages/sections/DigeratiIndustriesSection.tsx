import { Briefcase, Calculator, Stethoscope, Home, Heart, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { IconWell } from "@/components/visual/IconWell";
import { HomeChapter, HomeChapterHeader, HomeContainer, buttonPrimary } from "@/components/home/HomeChapter";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";

import lawBooksImg from "@assets/Rectangle-152058_1767027918697.webp";
import lawScalesImg from "@assets/Rectangle-152058-1_1767027918697.webp";
import healthcareImg from "@assets/Rectangle-152058-2_1767027918698.webp";
import realEstateImg from "@assets/Rectangle-152058-3_1767027918698.webp";
import animalHospitalImg from "@assets/Rectangle-152058-4_1767027918698.webp";

export const DigeratiIndustriesSection = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const industries = [
    { 
      icon: Briefcase, 
      name: "Law Firms", 
      testId: "industry-law",
      slug: "law-firms",
      description: "Protect client privilege and meet ABA compliance requirements",
      image: lawScalesImg
    },
    { 
      icon: Calculator, 
      name: "CPA Firms", 
      testId: "industry-cpa",
      slug: "accounting-finance",
      description: "Secure tax data and ensure IRS/FTC compliance",
      image: lawBooksImg
    },
    { 
      icon: Stethoscope, 
      name: "Medical Practices", 
      testId: "industry-medical",
      slug: "healthcare",
      description: "HIPAA compliance and patient data protection",
      image: healthcareImg
    },
    { 
      icon: Home, 
      name: "Real Estate Firms", 
      testId: "industry-realestate",
      slug: "real-estate",
      description: "Wire fraud prevention and transaction security",
      image: realEstateImg
    },
    { 
      icon: Heart, 
      name: "Animal Hospitals", 
      testId: "industry-animal",
      slug: "animal-hospitals",
      description: "Veterinary practice and client data protection",
      image: animalHospitalImg
    }
  ];

  const checkScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollButtons);
      checkScrollButtons();
      return () => container.removeEventListener('scroll', checkScrollButtons);
    }
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const containerVariants = prefersReducedMotion ? undefined : {
    hidden: { opacity: 0.7 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.045,
        delayChildren: 0,
      },
    },
  };

  const cardVariants = prefersReducedMotion ? undefined : {
    hidden: { opacity: 0.55, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: revealTransition,
    },
  };

  const titleVariants = prefersReducedMotion ? undefined : {
    hidden: { opacity: 0.55, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: revealTransition,
    },
  };

  return (
    <HomeChapter tone="surface" className="overflow-hidden">
      <HomeContainer>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={titleVariants}
        >
          <HomeChapterHeader
            tone="surface"
            eyebrow="Specialized solutions"
            title="Industries We Serve"
            lede="Specialized cybersecurity solutions for Arizona's essential sectors."
            link={{ label: "See all industries", href: "/industries", plain: true }}
          />
        </motion.div>

        {/* Mobile: Horizontal scroll with navigation arrows */}
        <div className="lg:hidden relative">
          {/* Left scroll button */}
          <button
            onClick={() => scroll('left')}
            className={`absolute left-0 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/80 backdrop-blur-sm border border-white/20 flex items-center justify-center transition-all ${
              canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            aria-label="Scroll left"
            data-testid="industries-scroll-left"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          
          {/* Right scroll button */}
          <button
            onClick={() => scroll('right')}
            className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/80 backdrop-blur-sm border border-white/20 flex items-center justify-center transition-all ${
              canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            aria-label="Scroll right"
            data-testid="industries-scroll-right"
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>

          {/* Gradient fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-de-surface to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-de-surface to-transparent z-10 pointer-events-none" />

          {/* Scrollable container */}
          <div 
            ref={scrollContainerRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 px-2 snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {industries.map((industry) => (
              <a 
                key={industry.testId}
                href={`/industries/${industry.slug}`}
                className="group relative block w-[280px] flex-shrink-0 snap-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-surface)]"
                data-testid={industry.testId}
              >
                <div className="relative h-[300px] overflow-hidden rounded-xl border border-[var(--de-hairline)] transition-colors duration-200 hover:border-[#D3126A] group-focus-visible:border-[#D3126A]">
                  <div
                    className="absolute inset-0 bg-cover bg-center grayscale transition-[filter] duration-300 group-hover:grayscale-0 group-focus-visible:grayscale-0"
                    style={{ backgroundImage: `url(${industry.image})` }}
                  />
                  
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/20" />
                  
                  {/* Content */}
                  <div className="absolute inset-0 p-5 flex flex-col justify-end">
                    <IconWell icon={industry.icon} size="sm" surface="dark" className="mb-3" />
                    
                    <h3 className="text-lg font-semibold text-white mb-1.5">
                      {industry.name}
                    </h3>
                    <p className="text-white/80 text-sm leading-relaxed">
                      {industry.description}
                    </p>
                    <p className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-de-magenta-ink">
                      View {industry.name}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </p>
                  </div>
                </div>
              </a>
            ))}
          </div>

          {/* Scroll indicator dots */}
          <div className="flex justify-center gap-2 mt-4">
            {industries.map((_, index) => (
              <div 
                key={index}
                className="w-2 h-2 rounded-full bg-white/20"
              />
            ))}
          </div>
        </div>

        {/* Desktop: Grid layout */}
        <motion.div 
          className="hidden lg:grid grid-cols-5 gap-5"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
        >
          {industries.map((industry) => (
            <motion.a 
              key={industry.testId}
              href={`/industries/${industry.slug}`}
              className="group relative block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-surface)]"
              data-testid={industry.testId}
              variants={cardVariants}
            >
              <div className="relative h-72 overflow-hidden rounded-xl border border-[var(--de-hairline)] transition-colors duration-200 hover:border-[#D3126A] group-focus-visible:border-[#D3126A]">
                <div
                  className="absolute inset-0 bg-cover bg-center grayscale transition-[filter] duration-300 group-hover:grayscale-0 group-focus-visible:grayscale-0"
                  style={{ backgroundImage: `url(${industry.image})` }}
                />
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                
                {/* Content */}
                <div className="absolute inset-0 p-5 flex flex-col justify-end">
                  <IconWell icon={industry.icon} size="sm" surface="dark" className="mb-3" />
                  
                  <h3 className="text-lg font-semibold text-white mb-1.5">
                    {industry.name}
                  </h3>
                  <p className="text-sm leading-relaxed text-white/80">
                    {industry.description}
                  </p>
                  <p className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-de-magenta-ink">
                    View {industry.name}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                  </p>
                </div>
              </div>
            </motion.a>
          ))}
        </motion.div>

        <motion.div
          className="mt-8"
          initial={prefersReducedMotion ? false : revealInitial}
          whileInView={revealInView}
          viewport={revealViewport}
          transition={revealTransition}
        >
          <a href="/book" className={buttonPrimary("surface")} data-testid="button-industries-cta">
            Get Industry-Specific Protection
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </motion.div>
      </HomeContainer>
    </HomeChapter>
  );
};
