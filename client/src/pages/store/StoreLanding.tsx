import { motion, useReducedMotion } from "framer-motion";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "../sections/DigeratiEnhancedFooterSection";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  ArrowRight, Shield, Users, Building, Phone, Monitor, Wifi, 
  Headphones, Cloud, Lock, FileCheck, GraduationCap, Wrench, 
  Package, Settings, Server, User, LogOut
} from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { 
  storeProducts, 
  categoryLabels, 
  categoryDescriptions, 
  formatPrice,
  getContractOnlyProducts,
  getCheckoutEnabledProducts,
  type ProductCategory 
} from "@/data/storeProducts";
import { CartButton } from "@/components/store/CartButton";
import { useStoreAuth } from "@/hooks/useStoreAuth";

const categoryIcons: Record<ProductCategory, typeof Shield> = {
  contract_services: Building,
  comanaged_subscriptions: Users,
  comanaged_onboarding: Settings,
  networking_managed: Wifi,
  networking_projects: Server,
  ucaas_subscriptions: Phone,
  ucaas_setup: Headphones,
  hardware_provisioning: Monitor,
  hardware_physical: Package,
  hardware_handling: Wrench,
  digital_assessments: Shield,
  digital_templates: FileCheck,
  digital_training: GraduationCap,
  professional_services: Cloud,
};

const StoreLanding = () => {
  const prefersReducedMotion = useReducedMotion();
  const { isLoggedIn, user, clientType, logout } = useStoreAuth();

  useSEO({
    title: 'IT Services Store | Digerati Experts',
    description: 'Browse and purchase IT services, security solutions, hardware provisioning, and professional services from Digerati Experts. Managed IT packages and co-managed solutions available.',
    canonical: '/store',
  });

  const contractOnlyProducts = getContractOnlyProducts();
  const checkoutProducts = getCheckoutEnabledProducts();

  const featuredProducts = storeProducts
    .filter(p => p.isCheckoutEnabled && !p.isClientOnly)
    .slice(0, 6);

  const categories = Object.keys(categoryLabels) as ProductCategory[];

  const containerVariants = prefersReducedMotion ? undefined : {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06 } }
  };

  const itemVariants = prefersReducedMotion ? undefined : {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <MegaMenu />
      
      <main className="pt-28 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Auth & Cart Header */}
          <div className="flex items-center justify-between mb-4">
            {isLoggedIn && user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                  <User className="w-4 h-4 text-violet-400" />
                  <span className="text-sm text-white" data-testid="text-user-greeting">
                    Welcome, <span className="font-semibold text-violet-300">{user.fullName || user.username}</span>
                  </span>
                  {clientType !== "public" && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-xs font-medium">
                      {clientType === "managed" ? "Managed Client" : "Co-Managed Client"}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="text-white/60 hover:text-white hover:bg-violet-500/10"
                  data-testid="button-store-logout"
                >
                  <LogOut className="w-4 h-4 mr-1" />
                  Logout
                </Button>
              </div>
            ) : (
              <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-500 text-white border-none"
                  data-testid="button-store-login"
                >
                  <Link href="/portal/login">
                    <User className="w-4 h-4 mr-2" />
                    Login for Client Pricing
                  </Link>
              </Button>
            )}
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
              <Package className="w-4 h-4 text-violet-400" />
              <span className="text-sm text-violet-300">Procurement Without the Guesswork</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
              Know What You Need?{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-purple-300 to-fuchsia-300">
                Start Here.
              </span>
            </h1>
            <p className="text-xl text-white/70 max-w-3xl mx-auto leading-relaxed">
              Buy a specific service, compare managed packages, or ask us to help sort out the right fit. If the catalog starts sounding like alphabet soup, call—we speak human.
            </p>
          </motion.div>

          {/* Two Client Type Cards */}
          <motion.section 
            className="mb-20"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <div className="grid md:grid-cols-2 gap-8">
              {/* Managed Clients Card */}
              <motion.div
                variants={itemVariants}
                className="relative rounded-2xl p-8 bg-gradient-to-br from-violet-900/30 to-purple-900/20 border border-violet-500/30 shadow-[0_0_40px_rgba(139,92,246,0.15)] overflow-hidden group hover:-translate-y-1 transition-all duration-300"
                data-testid="card-managed-clients"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-xl bg-violet-500/20 flex items-center justify-center mb-6">
                    <Building className="w-7 h-7 text-violet-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-3">Want One Team to Own the Whole Stack?</h2>
                  <p className="text-white/60 mb-4 leading-relaxed">
                    Our ProActive Ecosystem packages combine day-to-day IT, security, and strategic guidance under one accountable team and one predictable monthly agreement.
                  </p>
                  <div className="flex items-center gap-2 mb-6 text-sm text-violet-300">
                    <Lock className="w-4 h-4" />
                    <span>Contract-based services • Schedule a consultation</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/50 text-sm">{contractOnlyProducts.length} packages available</span>
                    <Button
                        asChild
                        className="bg-violet-600 hover:bg-violet-500 text-white"
                        data-testid="button-view-managed"
                      >
                        <Link href="/store/managed">
                          View Packages
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Link>
                    </Button>
                  </div>
                </div>
              </motion.div>

              {/* Co-Managed Clients Card */}
              <motion.div
                variants={itemVariants}
                className="relative rounded-2xl p-8 bg-white/[0.03] border border-white/10 hover:border-violet-500/30 overflow-hidden group hover:-translate-y-1 transition-all duration-300"
                data-testid="card-comanaged-clients"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-xl bg-violet-500/20 flex items-center justify-center mb-6">
                    <Users className="w-7 h-7 text-violet-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-3">Already Have IT but Need More Coverage?</h2>
                  <p className="text-white/60 mb-4 leading-relaxed">
                    Add endpoint management, security tools, communications, hardware provisioning, or project help without replacing the people who already know your environment.
                  </p>
                  <div className="flex items-center gap-2 mb-6 text-sm text-emerald-300">
                    <Shield className="w-4 h-4" />
                    <span>Checkout enabled • Purchase directly</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/50 text-sm">{checkoutProducts.length} products available</span>
                    <Button
                        asChild
                        className="bg-violet-600 hover:bg-violet-500 text-white border-none"
                        data-testid="button-view-comanaged"
                      >
                        <Link href="/store/co-managed">
                          Browse Products
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Link>
                    </Button>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.section>

          {/* Category Grid */}
          <motion.section 
            className="mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Browse by Category</h2>
              <p className="text-white/60">Browse by the job you need done. We are happy to help if two categories sound suspiciously similar.</p>
            </div>
            
            <motion.div 
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {categories.map((category) => {
                const Icon = categoryIcons[category];
                const productCount = storeProducts.filter(p => p.category === category).length;
                return (
                  <motion.div
                    key={category}
                    variants={itemVariants}
                  >
                    <Link href={`/store/co-managed?category=${category}`}>
                      <div 
                        className="p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:border-violet-500/30 hover:bg-white/[0.05] transition-all duration-300 cursor-pointer group text-center h-full"
                        data-testid={`category-${category}`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center mx-auto mb-3 group-hover:bg-violet-500/30 transition-colors">
                          <Icon className="w-5 h-5 text-violet-400" />
                        </div>
                        <h3 className="text-white font-medium text-sm mb-1">{categoryLabels[category]}</h3>
                        <p className="text-white/40 text-xs">{productCount} items</p>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.section>

          {/* Featured Products */}
          <motion.section 
            className="mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Featured Products</h2>
                <p className="text-white/60">Popular items available for immediate purchase.</p>
              </div>
              <Button
                  asChild
                  variant="outline" 
                  className="border-white/20 text-white hover:bg-white/10"
                  data-testid="button-view-all-products"
                >
                  <Link href="/store/co-managed">
                    View All
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
              </Button>
            </div>
            
            <motion.div 
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {featuredProducts.map((product) => {
                const Icon = categoryIcons[product.category];
                return (
                  <motion.div
                    key={product.id}
                    variants={itemVariants}
                    className="p-5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-violet-500/30 transition-all duration-300 group"
                    data-testid={`product-${product.id}`}
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold mb-1 truncate" title={product.name}>{product.name}</h3>
                        <p className="text-white/50 text-xs">{categoryLabels[product.category]}</p>
                      </div>
                    </div>
                    <p className="text-white/60 text-sm mb-4 line-clamp-2">{product.shortDescription}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-violet-400 font-semibold">{formatPrice(product)}</span>
                      <Button
                          asChild
                          size="sm" 
                          className="bg-violet-600/80 hover:bg-violet-600 text-white text-xs"
                          data-testid={`button-add-${product.id}`}
                        >
                          <Link href="/store/co-managed">View Details</Link>
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.section>

          {/* CTA Section */}
          <motion.section 
            className="rounded-2xl p-8 md:p-12 bg-gradient-to-br from-violet-900/30 to-purple-900/20 border border-violet-500/20 text-center"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Need Help Choosing?
            </h2>
            <p className="text-white/60 mb-8 max-w-xl mx-auto">
              Not sure which services fit your business? Schedule a free consultation with our team 
              to discuss your IT needs and find the right solution.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                  asChild
                  size="lg"
                  className="h-12 px-6 bg-violet-600 hover:bg-violet-500 text-white"
                  data-testid="button-schedule-consult"
                >
                  <a href="/book">
                    Schedule Free Consultation
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </a>
              </Button>
              <Button
                  asChild
                  size="lg"
                  className="h-12 px-6 bg-transparent border-2 border-white/30 text-white hover:bg-white/10"
                  data-testid="button-call-us"
                >
                  <a href="tel:[DE_PUBLIC_PHONE]">
                    <Phone className="w-4 h-4 mr-2" />
                    [DE_PUBLIC_PHONE]
                  </a>
              </Button>
            </div>
          </motion.section>

        </div>
      </main>

      <DigeratiEnhancedFooterSection />
    </div>
  );
};

export default StoreLanding;
