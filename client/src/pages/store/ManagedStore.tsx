import { motion, useReducedMotion } from "framer-motion";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "../sections/DigeratiEnhancedFooterSection";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  ArrowRight, Shield, Building, Calendar, CheckCircle, Phone, 
  Star, Clock, Award, Lock
} from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { 
  getContractOnlyProducts,
  categoryLabels,
  formatPrice,
  type StoreProduct
} from "@/data/storeProducts";
import { StoreClientBar } from "@/components/store/StoreClientBar";
import { StorePageAtmosphere } from "@/components/store/StorePageAtmosphere";
import { CTA } from "@/lib/ctaCopy";
import { pricing, getPricingFooterText } from "@/data/pricing";
import { ProductMedia } from "@/components/store/ProductMedia";
import { getProductVisual } from "@/data/productImages";
import { PRIMARY_PHONE } from "@/data/companyContact";

const ManagedStore = () => {
  const prefersReducedMotion = useReducedMotion();

  useSEO({
    noIndex: true,
    title: 'Managed IT Packages | Digerati Experts Store',
    description: 'Complete managed IT packages and ProActive Ecosystem plans for businesses. Full-service IT support, security, compliance, and strategy—all in one predictable subscription.',
    canonical: '/internal/warehouse/managed',
  });

  const contractOnlyProducts = getContractOnlyProducts();

  const proactiveEcosystemProducts = contractOnlyProducts.filter(p => 
    p.name.includes("ProActive Ecosystem")
  );
  
  const otherManagedProducts = contractOnlyProducts.filter(p => 
    !p.name.includes("ProActive Ecosystem")
  );

  const containerVariants = prefersReducedMotion ? undefined : {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = prefersReducedMotion ? undefined : {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  const ProductCard = ({ product, featured = false }: { product: StoreProduct; featured?: boolean }) => {
    const visual = getProductVisual(product);
    return (
    <Link href={`/internal/warehouse/product/${product.sku}`}>
      <motion.div
        variants={itemVariants}
        className={`relative overflow-hidden rounded-xl border transition-all duration-300 hover:-translate-y-1 cursor-pointer ${
          featured 
            ? 'bg-violet-500/10 border-violet-500/40 shadow-[0_0_30px_rgba(139,92,246,0.15)]' 
            : 'bg-white/[0.03] border-white/10 hover:border-violet-500/30'
        }`}
        data-testid={`product-${product.id}`}
      >
      {featured && (
        <div className="absolute top-2 right-2 z-10 px-2.5 py-0.5 bg-violet-600 text-white text-[10px] font-bold rounded-full flex items-center gap-1">
          <Star className="w-3 h-3" />
          Popular
        </div>
      )}

      <ProductMedia
        product={product}
        variant="card"
        className="rounded-none border-0 border-b border-white/10"
        categoryBadge={categoryLabels[product.category]}
      />

      <div className="p-4 sm:p-5 flex flex-col h-[calc(100%-140px)]">
      <div className="mb-2">
        <span className="text-[10px] text-white/60 uppercase tracking-wider">{categoryLabels[product.category]}</span>
        {visual.vendor && (
          <span className="ml-2 text-[10px] text-white/50">{visual.vendor.name}</span>
        )}
        <h3 className="text-base sm:text-lg font-bold text-white mt-0.5 line-clamp-1">{product.name}</h3>
      </div>

      <div className="mb-3">
        {product.basePrice === 0 ? (
          <span className="text-lg font-bold text-violet-400">Custom Quote</span>
        ) : (
          <>
            <span className="text-xl font-black text-white">${product.basePrice}</span>
            <span className="text-white/50 text-xs ml-1.5">/ {product.pricingUnit || 'user'} / month</span>
          </>
        )}
      </div>

      <p className="text-white/70 text-xs sm:text-sm mb-3 leading-relaxed line-clamp-2">
        {product.description}
      </p>

      <ul className="space-y-1 mb-4">
        {product.features.slice(0, 3).map((feature, idx) => (
          <li key={idx} className="flex items-start gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <span className="text-white/80 text-xs line-clamp-1">{feature}</span>
          </li>
        ))}
        {product.features.length > 3 && (
          <li className="pl-5 text-[11px] text-white/40">+{product.features.length - 3} more</li>
        )}
      </ul>

      <Button 
        size="sm"
        className={`w-full h-9 text-xs font-semibold mt-auto ${
          featured 
            ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-600/30' 
            : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
        }`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = '/book';
        }}
        data-testid={`button-schedule-${product.id}`}
      >
        <Calendar className="w-3.5 h-3.5 mr-1.5" />
        Schedule Consultation
      </Button>
      </div>
      </motion.div>
    </Link>
  );
  };

  return (
    <div className="relative min-h-screen bg-[#0a0a0a]">
      <StorePageAtmosphere />
      <MegaMenu />
      
      <main className="relative z-10 de-nav-clear pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <StoreClientBar />
          <div className="mb-8 flex items-center gap-2 text-sm text-white/50">
            <Link href="/internal/warehouse" className="transition-colors hover:text-white">Store</Link>
            <span>/</span>
            <span className="text-white">Managed Clients</span>
          </div>

          {/* Hero Section */}
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-de-raised border border-de-hairline mb-6">
              <Building className="w-4 h-4 text-de-accent-ink" />
              <span className="text-sm text-de-accent-ink">Managed IT Services</span>
            </div>
            <h1 className="mb-6 text-[clamp(2rem,6vw,3.25rem)] font-bold leading-[1.12] tracking-[-0.03em] text-white">
              Full-Service{" "}
              <span className="text-de-accent-ink">
                Managed IT
              </span>
            </h1>
            <p className="text-xl text-white/70 max-w-3xl mx-auto leading-relaxed">
              Complete managed IT packages designed for businesses that want predictable costs and comprehensive support. 
              Everything you need in one subscription—no surprise bills, no nickel-and-diming.
            </p>
          </motion.div>

          {/* Contract Notice */}
          <motion.div 
            className="mb-12 p-4 rounded-xl bg-de-raised border border-de-hairline flex items-start gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Lock className="w-5 h-5 text-de-accent-ink mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-white font-semibold mb-1">Contract-Based Services</h3>
              <p className="text-white/60 text-sm">
                These managed IT packages require a consultation and service agreement. 
                Schedule a call to discuss your needs and receive a customized quote tailored to your organization.
              </p>
            </div>
          </motion.div>

          {/* ProActive Ecosystem Plans */}
          <motion.section 
            className="mb-20"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">ProActive Ecosystem Plans</h2>
              <p className="text-white/60">All-inclusive managed IT packages. Choose the tier that fits your security and compliance needs.</p>
            </div>
            
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-6">
              {proactiveEcosystemProducts.map((product, idx) => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  featured={idx === 1} 
                />
              ))}
            </div>
            
            <p className="text-center text-white/55 text-sm mt-6">
              {getPricingFooterText()}. Final pricing tailored to your users, sites, and compliance needs.
            </p>
          </motion.section>

          {/* Other Managed Services */}
          {otherManagedProducts.length > 0 && (
            <motion.section 
              className="mb-20"
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <div className="text-center mb-10">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Additional Managed Services</h2>
                <p className="text-white/60">Specialized managed services for specific needs.</p>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {otherManagedProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </motion.section>
          )}

          {/* Why Choose Managed */}
          <motion.section 
            className="mb-20 rounded-2xl p-8 bg-de-raised border border-de-hairline"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Why Choose Managed IT?</h2>
            </div>
            
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { icon: Clock, value: "<15 min", label: "Response Time", description: "Guaranteed SLA" },
                { icon: Shield, value: "99.9%", label: "Uptime SLA", description: "Enterprise reliability" },
                { icon: Phone, value: "24/7", label: "Support", description: "Real humans, always" },
                { icon: Award, value: "$50K+", label: "Avg. Savings", description: "Per client annually" }
              ].map((stat, index) => (
                <div key={index} className="text-center p-4">
                  <div className="w-12 h-12 rounded-full bg-de-raised flex items-center justify-center mx-auto mb-3">
                    <stat.icon className="w-6 h-6 text-de-accent-ink" />
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
                  <div className="text-white/80 font-medium text-sm">{stat.label}</div>
                  <div className="text-white/50 text-xs">{stat.description}</div>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Final CTA */}
          <motion.section 
            className="text-center"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="mb-4 text-2xl font-bold text-white md:text-3xl">
              Need a package recommendation?
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-white/60">
              Start with a cyber risk assessment. We map the right ProActive tier to your users,
              sites, and compliance needs — then quote the contract.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                variant="brand"
                className="h-14 px-8 text-lg font-semibold"
                data-testid="button-final-cta"
              >
                <a href="/book">
                  <Calendar className="mr-2 h-5 w-5" />
                  {CTA.primary}
                </a>
              </Button>
              <Button
                asChild
                size="lg"
                className="h-14 border-2 border-white/30 bg-transparent px-8 text-lg font-semibold text-white hover:bg-white/10"
                data-testid="button-call-us"
              >
                <a href={PRIMARY_PHONE.telHref}>
                  <Phone className="mr-2 h-5 w-5" />
                  {PRIMARY_PHONE.display}
                </a>
              </Button>
            </div>
            
            <div className="mt-8">
              <Link href="/internal/warehouse/co-managed">
                <Button 
                  variant="link" 
                  className="text-de-accent-ink hover:text-de-accent-ink"
                  data-testid="button-browse-comanaged"
                >
                  Looking for individual products? Browse Co-Managed Store
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </motion.section>

        </div>
      </main>

      <DigeratiEnhancedFooterSection />
    </div>
  );
};

export default ManagedStore;
