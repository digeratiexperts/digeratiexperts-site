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
import { CartButton } from "@/components/store/CartButton";
import { pricing, getPricingFooterText } from "@/data/pricing";

const ManagedStore = () => {
  const prefersReducedMotion = useReducedMotion();

  useSEO({
    title: 'Managed IT Packages | Digerati Experts Store',
    description: 'Complete managed IT packages and ProActive Ecosystem plans for businesses. Full-service IT support, security, compliance, and strategy—all in one predictable subscription.',
    canonical: '/store/managed',
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

  const ProductCard = ({ product, featured = false }: { product: StoreProduct; featured?: boolean }) => (
    <Link href={`/store/product/${product.sku}`}>
      <motion.div
        variants={itemVariants}
        className={`relative rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1 cursor-pointer ${
          featured 
            ? 'bg-violet-500/10 border-violet-500/40 shadow-[0_0_40px_rgba(139,92,246,0.2)]' 
            : 'bg-white/[0.03] border-white/10 hover:border-violet-500/30'
        }`}
        data-testid={`product-${product.id}`}
      >
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-violet-600 text-white text-xs font-bold rounded-full flex items-center gap-1">
          <Star className="w-3 h-3" />
          Most Popular
        </div>
      )}
      
      <div className="mb-4">
        <span className="text-xs text-white/40 uppercase tracking-wider">{categoryLabels[product.category]}</span>
        <h3 className="text-xl font-bold text-white mt-1">{product.name}</h3>
      </div>

      <div className="mb-4">
        {product.basePrice === 0 ? (
          <span className="text-2xl font-bold text-violet-400">Custom Quote</span>
        ) : (
          <>
            <span className="text-3xl font-black text-white">${product.basePrice}</span>
            <span className="text-white/50 text-sm ml-2">/ {product.pricingUnit || 'user'} / month</span>
          </>
        )}
      </div>

      <p className="text-white/60 text-sm mb-6 leading-relaxed">
        {product.description}
      </p>

      <ul className="space-y-2 mb-6">
        {product.features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
            <span className="text-white/80 text-sm">{feature}</span>
          </li>
        ))}
      </ul>

      <Button 
        className={`w-full ${
          featured 
            ? 'bg-violet-600 hover:bg-violet-500 text-white' 
            : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
        }`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = '/book';
        }}
        data-testid={`button-schedule-${product.id}`}
      >
        <Calendar className="w-4 h-4 mr-2" />
        Schedule Consultation
      </Button>
      </motion.div>
    </Link>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <MegaMenu />
      
      <main className="pt-28 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Breadcrumb with Cart Button */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-white/50">
              <Link href="/store" className="hover:text-white transition-colors">Store</Link>
              <span>/</span>
              <span className="text-white">Managed Clients</span>
            </div>
            <CartButton />
          </div>

          {/* Hero Section */}
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 mb-6">
              <Building className="w-4 h-4 text-violet-400" />
              <span className="text-sm text-violet-300">Managed IT Services</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
              Full-Service{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-purple-300 to-fuchsia-300">
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
            className="mb-12 p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-start gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Lock className="w-5 h-5 text-violet-400 mt-0.5 flex-shrink-0" />
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
            
            <div className="grid md:grid-cols-3 gap-6">
              {proactiveEcosystemProducts.map((product, idx) => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  featured={idx === 1} 
                />
              ))}
            </div>
            
            <p className="text-center text-white/40 text-sm mt-6">
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
            className="mb-20 rounded-2xl p-8 bg-gradient-to-br from-violet-900/20 to-purple-900/20 border border-violet-500/20"
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
                { icon: Clock, value: "Clear", label: "Response", description: "Know who owns the next step" },
                { icon: Shield, value: "Secure", label: "By Design", description: "Risk considered from the start" },
                { icon: Phone, value: "Human", label: "Support", description: "People you can actually reach" },
                { icon: Award, value: "Right-sized", label: "Recommendations", description: "Assessment before package" }
              ].map((stat, index) => (
                <div key={index} className="text-center p-4">
                  <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center mx-auto mb-3">
                    <stat.icon className="w-6 h-6 text-violet-400" />
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
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-white/60 mb-8 max-w-xl mx-auto">
              Schedule a free 15-minute call to discuss your needs. We'll help you choose the right plan 
              and provide a customized quote for your organization.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/book">
                <Button 
                  size="lg"
                  className="h-14 px-8 text-lg font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/25"
                  data-testid="button-final-cta"
                >
                  <Calendar className="w-5 h-5 mr-2" />
                  Schedule Consultation
                </Button>
              </a>
              <a href="tel:[DE_PUBLIC_PHONE]">
                <Button 
                  size="lg"
                  className="h-14 px-8 text-lg font-semibold bg-transparent border-2 border-white/30 text-white hover:bg-white/10"
                  data-testid="button-call-us"
                >
                  <Phone className="w-5 h-5 mr-2" />
                  [DE_PUBLIC_PHONE]
                </Button>
              </a>
            </div>
            
            <div className="mt-8">
              <Link href="/store/co-managed">
                <Button 
                  variant="link" 
                  className="text-violet-400 hover:text-violet-300"
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
