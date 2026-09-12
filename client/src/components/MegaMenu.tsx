import { useState, useRef, useEffect, useCallback, useId } from 'react';
import { Link } from 'wouter';
import { ChevronDown, Shield, Server, Users, FileCheck, Phone, ExternalLink, X, ArrowRight, Monitor, Cloud, Lock, Zap, HeadphonesIcon, Building, BarChart3, ClipboardCheck, Layers, TrendingUp, Star, CheckCircle, Award, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DE_LOGO_REVERSE } from '@/lib/brandAssets';
import ebookCover from '@/assets/images/ebook-defending-digital-realm-cover.png';
import { motion, AnimatePresence } from 'framer-motion';
import * as Tooltip from '@radix-ui/react-tooltip';
import { pricing } from '@/data/pricing';
import { useBooking } from '@/contexts/BookingContext';
import { useOptionalFullPageScroll } from '@/components/FullPageScroll';
import { HomepageOnPageNav } from '@/components/HomepageSectionNav';
import { PORTAL_LOGIN } from '@/lib/portalUrls';
import { CTA } from '@/lib/ctaCopy';
import { PRIMARY_PHONE } from '@/data/companyContact';

const NoiseTexture = ({ id }: { id: string }) => (
  <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.025]" aria-hidden="true">
    <defs>
      <filter id={`noise-${id}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
      </filter>
    </defs>
    <rect width="100%" height="100%" filter={`url(#noise-${id})`}/>
  </svg>
);

const DotMatrixTexture = () => (
  <div 
    className="absolute inset-0 pointer-events-none opacity-[0.04]"
    style={{
      backgroundImage: `radial-gradient(circle at center, white 1px, transparent 1px)`,
      backgroundSize: '10px 10px',
    }}
    aria-hidden="true"
  />
);

const HexagonPattern = ({ id }: { id: string }) => (
  <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.02]" aria-hidden="true">
    <defs>
      <pattern id={`hex-${id}`} width="50" height="43.3" patternUnits="userSpaceOnUse" patternTransform="scale(1)">
        <polygon 
          points="25,0 50,14.4 50,43.3 25,28.9 0,43.3 0,14.4" 
          fill="none" 
          stroke="rgba(139,92,246,1)" 
          strokeWidth="0.5"
        />
        <polygon 
          points="25,14.4 50,28.9 50,57.7 25,43.3 0,57.7 0,28.9" 
          fill="none" 
          stroke="rgba(139,92,246,1)" 
          strokeWidth="0.5"
          transform="translate(25, 0)"
        />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill={`url(#hex-${id})`}/>
  </svg>
);

const CircuitLines = ({ id }: { id: string }) => (
  <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none overflow-hidden opacity-[0.08]" aria-hidden="true">
    <svg className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`circuit-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="transparent"/>
          <stop offset="20%" stopColor="rgba(139,92,246,1)"/>
          <stop offset="80%" stopColor="rgba(139,92,246,1)"/>
          <stop offset="100%" stopColor="transparent"/>
        </linearGradient>
      </defs>
      <path d="M0,20 L100,20 L120,10 L200,10 L220,20 L350,20 L370,30 L450,30" stroke={`url(#circuit-${id})`} strokeWidth="1" fill="none"/>
      <path d="M500,25 L600,25 L620,15 L700,15 L720,25 L850,25" stroke={`url(#circuit-${id})`} strokeWidth="1" fill="none"/>
      <circle cx="120" cy="10" r="2" fill="rgba(139,92,246,0.5)"/>
      <circle cx="370" cy="30" r="2" fill="rgba(139,92,246,0.5)"/>
      <circle cx="620" cy="15" r="2" fill="rgba(139,92,246,0.5)"/>
    </svg>
  </div>
);

const DiagonalLinesBadge = ({ children, variant }: { children: React.ReactNode; variant: 'popular' | 'bestValue' | 'compliance' }) => {
  const baseClasses = variant === 'popular' 
    ? 'bg-de-raised text-de-accent-ink border border-de-hairline'
    : variant === 'bestValue'
    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
    : 'bg-de-raised text-de-accent-ink border border-de-hairline';
    
  return (
    <span className={`relative text-xs px-1.5 py-0.5 rounded font-medium overflow-hidden ${baseClasses}`}>
      <span 
        className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, white 0px, white 1px, transparent 1px, transparent 4px)`,
        }}
        aria-hidden="true"
      />
      <span className="relative">{children}</span>
    </span>
  );
};

/** Right-rail offer — must earn a stop, not sit as a muted leftover card. */
function MenuFeaturedRail({
  href,
  eyebrow,
  title,
  body,
  cta,
  testId,
  linkTestId,
  onNavigate,
  image,
  imageAlt,
}: {
  href: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  testId: string;
  linkTestId: string;
  onNavigate: () => void;
  image?: string;
  imageAlt?: string;
}) {
  return (
    <motion.div
      className={`flex flex-1 flex-col overflow-hidden rounded-xl border border-de-hairline bg-de-raised ${image ? "min-h-[22rem]" : ""}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
      data-testid={testId}
    >
      {image ? (
        <div className="flex items-center justify-center bg-de-bg px-5 pt-5">
          <img
            src={image}
            alt={imageAlt || ""}
            className="h-44 w-auto max-w-full rounded-sm object-contain shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D3126A]">{eyebrow}</p>
        <h4 className="mt-2 font-heading text-lg font-semibold leading-snug text-white md:text-xl">{title}</h4>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-white/70">{body}</p>
        <Link
          href={href}
          onClick={onNavigate}
          className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#D3126A] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#f0187a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-de-raised"
          data-testid={linkTestId}
        >
          {cta}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </motion.div>
  );
}

interface MegaMenuItem {
  title: string;
  icon?: JSX.Element;
  url?: string;
  description?: string;
  badge?: string;
  price?: string;
}

interface MegaMenuSection {
  title: string;
  items: MegaMenuItem[];
  featured?: boolean;
  viewAllUrl?: string;
}

interface NavItem {
  name: string;
  sections?: MegaMenuSection[];
  href?: string;
  isSimple?: boolean;
  featuredPanel?: {
    title: string;
    stats: { value: string; label: string }[];
    cta: { text: string; url: string };
  };
}

export function MegaMenu() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [isScrolled, setIsScrolled] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const { openBooking } = useBooking();
  // Top assessment announcement strip (reference direction). Dismiss lasts the
  // tab session so it never nags on every navigation.
  const [announceDismissed, setAnnounceDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.sessionStorage.getItem('de-assessment-announce-dismissed') === '1';
    } catch {
      return false;
    }
  });
  const dismissAnnounce = () => {
    setAnnounceDismissed(true);
    try {
      window.sessionStorage.setItem('de-assessment-announce-dismissed', '1');
    } catch {
      /* private mode — dismiss for this render only */
    }
  };
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const utilityBarRef = useRef<HTMLDivElement>(null);
  const navBarRef = useRef<HTMLDivElement>(null);
  const spyBarRef = useRef<HTMLDivElement>(null);
  const navButtonsRef = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const dropdownRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dropdownScrollRef = useRef<HTMLDivElement | null>(null);
  const [dropdownCanScroll, setDropdownCanScroll] = useState(false);
  const [dropdownAtEnd, setDropdownAtEnd] = useState(true);
  const columnRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const rafRef = useRef<number | null>(null);
  /** Unscrolled utility height — kept so page offset does not shrink when the bar collapses. */
  const utilityNaturalHRef = useRef(0);
  const uniqueId = useId();
  const scrollContext = useOptionalFullPageScroll();
  const isMenuOpen = Boolean(activeMenu) || mobileMenuOpen;
  // Solid dark strip over light page sections so the white/gold logo stays legible.
  // Keep the live translucent bar over dark hero sections.
  const isOverLight = scrollContext?.currentTheme === 'light';
  const useSolidChrome = isOverLight || isMenuOpen;

  const handleColumnMouseMove = useCallback((e: React.MouseEvent, columnIdx: number) => {
    if (rafRef.current) return;
    
    rafRef.current = requestAnimationFrame(() => {
      const rect = columnRefs.current.get(columnIdx)?.getBoundingClientRect();
      if (rect) {
        setCursorPos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
      rafRef.current = null;
    });
  }, []);

  const navItems: NavItem[] = [
    {
      name: 'Solutions',
      href: '/solutions',
      sections: [
        {
          title: 'Ways to Work With Us',
          viewAllUrl: '/solutions',
          items: [
            { title: 'ProActive Ecosystem', description: 'Cybersecurity-first operating model: IT → Office → Business → Enterprise', icon: <Layers className="h-5 w-5" />, url: '/solutions/proactive-ecosystem' },
            { title: 'Co-Managed IT', description: 'Extend your internal IT team without replacing it', icon: <Users className="h-5 w-5" />, url: '/solutions/co-managed-it' },
            { title: 'Standalone Services', description: 'A specific gap — backup, UCaaS, awareness, or a project', icon: <Server className="h-5 w-5" />, url: '/solutions/standalone-services' },
            { title: 'Solve a Business Need', description: 'Curated DE solutions organized around the outcome you need', icon: <ClipboardCheck className="h-5 w-5" />, url: '/store' },
            { title: 'Cyber Risk Assessment', description: 'Match the operating model to your environment', icon: <ClipboardCheck className="h-5 w-5" />, url: '/book' },
          ]
        },
        {
          title: 'ProActive Ecosystem',
          viewAllUrl: '/proactive-ecosystem-pricing',
          items: [
            { title: 'IT', description: pricing.it.idealBuyer, icon: <Monitor className="h-5 w-5" />, url: pricing.it.learnMoreUrl, price: `From $${pricing.it.user}/user` },
            { title: 'Office', description: pricing.office.idealBuyer, icon: <Building className="h-5 w-5" />, url: pricing.office.learnMoreUrl, price: `From $${pricing.office.user}/user` },
            { title: 'Business', description: pricing.business.idealBuyer, icon: <BarChart3 className="h-5 w-5" />, url: pricing.business.learnMoreUrl, price: `From $${pricing.business.user}/user` },
            { title: 'Enterprise', description: pricing.enterprise.idealBuyer, icon: <Award className="h-5 w-5" />, url: pricing.enterprise.learnMoreUrl, price: `From $${pricing.enterprise.user}/user` },
            { title: 'Compare All Packages', description: 'Capabilities and operating depth — not a ranking', icon: <LayoutGrid className="h-5 w-5" />, url: '/proactive-ecosystem-pricing' },
          ]
        },
        {
          title: 'Managed IT & Workplace',
          viewAllUrl: '/solutions',
          items: [
            { title: 'Managed IT Support', description: 'Service desk and day-to-day issue ownership', icon: <HeadphonesIcon className="h-5 w-5" />, url: '/solutions/managed-it-support' },
            { title: 'Managed Workplace', description: 'Identity, devices, apps, and employee lifecycle', icon: <Building className="h-5 w-5" />, url: '/solutions/managed-workplace' },
            { title: 'Identity & Access', description: 'SSO, MFA, and access architecture', icon: <Lock className="h-5 w-5" />, url: '/solutions/unified-security' },
            { title: 'Managed Network & Connectivity', description: 'Firewall, Wi-Fi, and connectivity operations', icon: <Server className="h-5 w-5" />, url: '/solutions/managed-it-support' },
            { title: 'Cloud / SaaS Backup', description: 'Endpoint, M365, and Google backup — not BCDR', icon: <Cloud className="h-5 w-5" />, url: '/solutions/cloud-backup' },
            { title: 'UCaaS', description: 'Unified phone and meeting systems', icon: <Phone className="h-5 w-5" />, url: '/services/ucaas' },
          ]
        },
        {
          title: 'Cybersecurity & Resilience',
          viewAllUrl: '/solutions',
          items: [
            { title: 'Endpoint & Email Protection', description: 'Device and mailbox defenses', icon: <Shield className="h-5 w-5" />, url: '/solutions/threat-detection' },
            { title: 'Threat Detection & Response', description: 'Find and contain attacks before damage spreads', icon: <Zap className="h-5 w-5" />, url: '/solutions/threat-detection' },
            { title: 'Security Operations / SOC', description: 'Human-led monitoring and response', icon: <Lock className="h-5 w-5" />, url: '/solutions/security-operations' },
            { title: 'Security Awareness', description: 'Training and phishing simulations for staff', icon: <Users className="h-5 w-5" />, url: '/solutions/security-awareness' },
            { title: 'Data Encryption', description: 'Protect data even if an endpoint is lost', icon: <Shield className="h-5 w-5" />, url: '/solutions/data-encryption' },
            { title: 'Backup & Disaster Recovery', description: 'Continuity, RPO/RTO, failover, and restore testing', icon: <Server className="h-5 w-5" />, url: '/solutions/backup-disaster-recovery' },
          ]
        },
        {
          title: 'Strategy & Compliance',
          viewAllUrl: '/solutions',
          items: [
            { title: 'vCIO', description: 'Executive technology and security guidance', icon: <BarChart3 className="h-5 w-5" />, url: '/solutions/vcio-strategy' },
            { title: 'Compliance & Risk Reporting', description: 'Evidence and reporting for audits and insurers', icon: <ClipboardCheck className="h-5 w-5" />, url: '/solutions/compliance-reports' },
            { title: 'Cyber Insurance Readiness', description: 'Controls and documentation carriers typically ask for', icon: <FileCheck className="h-5 w-5" />, url: '/solutions/compliance-reports' },
          ]
        }
      ]
    },
    {
      name: 'Industries',
      href: '/industries',
      sections: [
        {
          title: 'Industries We Serve',
          items: [
            { title: 'Healthcare', description: 'HIPAA compliance made simple', icon: <Shield className="h-5 w-5" />, url: '/industries/healthcare' },
            { title: 'Law Firms', description: 'Protect client confidentiality', icon: <FileCheck className="h-5 w-5" />, url: '/industries/law-firms' },
            { title: 'Accounting', description: 'Secure tax & financial data', icon: <Server className="h-5 w-5" />, url: '/industries/accounting-finance' },
          ]
        },
        {
          title: 'More Industries',
          items: [
            { title: 'Real Estate', description: 'Prevent wire fraud attacks', icon: <Building className="h-5 w-5" />, url: '/industries/real-estate' },
            { title: 'Nonprofits', description: 'Affordable IT for mission', icon: <Users className="h-5 w-5" />, url: '/industries/nonprofits' },
            { title: 'Professional Services', description: 'Secure client data', icon: <BarChart3 className="h-5 w-5" />, url: '/industries/professional-services' },
          ]
        }
      ]
    },
    {
      name: 'Resources',
      href: '/resources',
      sections: [
        {
          title: 'Learn',
          items: [
            { title: 'Case Studies', description: 'Real Arizona success stories', icon: <TrendingUp className="h-5 w-5" />, url: '/resources/case-studies' },
            { title: 'Digerati Journal', description: 'Cybersecurity & managed IT field notes', icon: <FileCheck className="h-5 w-5" />, url: '/resources/blog' },
            { title: 'Cyber Facts', description: 'Interactive credibility stats & sources', icon: <Shield className="h-5 w-5" />, url: '/resources/cyber-facts' },
            { title: 'Videos & Webinars', description: 'Educational content library', icon: <Monitor className="h-5 w-5" />, url: '/resources/videos' },
          ]
        },
        {
          title: 'Tools',
          items: [
            { title: 'Downtime Calculator', description: 'See what downtime really costs', icon: <BarChart3 className="h-5 w-5" />, url: '/resources/downtime-calculator' },
            { title: 'Security Checklist', description: 'Assess your security posture', icon: <ClipboardCheck className="h-5 w-5" />, url: '/resources/security-checklist' },
            { title: 'Datasheets', description: 'Package PDFs and sample reports', icon: <FileCheck className="h-5 w-5" />, url: '/resources/datasheets' },
            { title: 'Executive briefs', description: 'Short buyer-ready operating notes', icon: <ClipboardCheck className="h-5 w-5" />, url: '/resources/briefs' },
            { title: 'Campaign offers', description: 'Single-offer pages for ads and search', icon: <BarChart3 className="h-5 w-5" />, url: '/go' },
          ]
        }
      ]
    },
    {
      name: 'Pricing',
      href: '/proactive-ecosystem-pricing',
      isSimple: true
    },
    {
      name: 'About',
      href: '/about/mission-values',
      sections: [
        {
          title: 'Is This You?',
          items: [
            { title: 'Frustrated with IT?', description: 'Slow response and recurring issues', icon: <Zap className="h-5 w-5" />, url: '/contact' },
            { title: 'Worried about Security?', description: 'Concerned about ransomware', icon: <Shield className="h-5 w-5" />, url: '/solutions/threat-detection' },
            { title: 'Need Compliance?', description: 'HIPAA, SOC 2, or FTC needs', icon: <ClipboardCheck className="h-5 w-5" />, url: '/solutions/compliance-reports' },
          ]
        },
        {
          title: 'Company',
          items: [
            { title: 'Mission & Values', description: 'Our commitment to partnership', icon: <Star className="h-5 w-5" />, url: '/about/mission-values' },
            { title: 'Case Studies', description: 'Arizona business success stories', icon: <TrendingUp className="h-5 w-5" />, url: '/resources/case-studies' },
            { title: 'Meet The Experts', description: 'Chandler, AZ team', icon: <Users className="h-5 w-5" />, url: '/about/team' },
            { title: 'Client Bill of Rights', description: 'Our 8 pledges to you', icon: <Award className="h-5 w-5" />, url: '/about/client-bill-of-rights' },
            { title: '100% Guarantee', description: '30-day money-back promise', icon: <CheckCircle className="h-5 w-5" />, url: '/about/guarantee' },
            { title: '21 Questions to Ask', description: 'Before hiring any IT company', icon: <ClipboardCheck className="h-5 w-5" />, url: '/about/21-questions' },
          ]
        }
      ]
    },
    {
      name: 'Store',
      href: '/store',
      isSimple: true
    },
    {
      name: 'Contact',
      href: '/contact',
      isSimple: true
    }
  ];

  const closeMenu = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setActiveMenu(null);
    setFocusedIndex(-1);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      closeMenu();
      closeMobileMenu();
      if (activeMenu && navButtonsRef.current.get(activeMenu)) {
        navButtonsRef.current.get(activeMenu)?.focus();
      }
      return;
    }

    if (!mobileMenuOpen && activeMenu) {
      const menuItems = navItems.filter(item => !item.isSimple);
      const currentIndex = menuItems.findIndex(item => item.name === activeMenu);

      if (event.key === 'ArrowLeft' && currentIndex > 0) {
        const prevItem = menuItems[currentIndex - 1];
        setActiveMenu(prevItem.name);
        navButtonsRef.current.get(prevItem.name)?.focus();
      } else if (event.key === 'ArrowRight' && currentIndex < menuItems.length - 1) {
        const nextItem = menuItems[currentIndex + 1];
        setActiveMenu(nextItem.name);
        navButtonsRef.current.get(nextItem.name)?.focus();
      }
    }
  }, [activeMenu, mobileMenuOpen, closeMenu, closeMobileMenu, navItems]);

  const handleMouseEnter = useCallback((name: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setActiveMenu(name);
  }, []);

  const handleMouseLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      closeMenu();
    }, 150);
  }, [closeMenu]);

  const handleDropdownMouseEnter = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  const handleNavButtonClick = useCallback((name: string, event: React.MouseEvent) => {
    // Allow modified clicks (new tab / middle-click) to follow the hub href.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      closeMenu();
      return;
    }
    event.preventDefault();
    if (activeMenu === name) {
      closeMenu();
    } else {
      setActiveMenu(name);
    }
  }, [activeMenu, closeMenu]);

  const handleLinkClick = useCallback(() => {
    closeMenu();
    closeMobileMenu();
  }, [closeMenu, closeMobileMenu]);

  useEffect(() => {
    if (!activeMenu) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      const isButtonClick = target.closest('button[data-menu-trigger]');
      if (isButtonClick) {
        return;
      }
      
      const isDropdownClick = target.closest('.mega-menu-dropdown');
      if (isDropdownClick) {
        return;
      }
      
      closeMenu();
    };

    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside, true);
    }, 0);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [activeMenu, closeMenu]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  useEffect(() => {
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 50);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Safety-net fade: only when a short viewport still overflows after density.
  useEffect(() => {
    const el = dropdownScrollRef.current;
    if (!activeMenu || !el) {
      setDropdownCanScroll(false);
      setDropdownAtEnd(true);
      return;
    }

    const update = () => {
      const overflow = el.scrollHeight > el.clientHeight + 2;
      setDropdownCanScroll(overflow);
      setDropdownAtEnd(!overflow || el.scrollTop + el.clientHeight >= el.scrollHeight - 4);
    };

    update();
    const frame = window.requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, [activeMenu]);

  // Publish sticky chrome height so pages can clear the fixed MegaMenu centrally.
  useEffect(() => {
    const root = document.documentElement;
    const BREATHING_PX = 12;

    const publish = () => {
      const utilityEl = utilityBarRef.current;
      const navEl = navBarRef.current;
      const navH = navEl?.offsetHeight ?? 0;
      const spyH = spyBarRef.current?.offsetHeight ?? 0;
      const liveBottom = menuContainerRef.current?.getBoundingClientRect().bottom ?? 0;
      root.style.setProperty('--de-spy-h', `${Math.round(spyH)}px`);

      const isDesktopNav = window.innerWidth >= 1024;
      if (!isDesktopNav) {
        utilityNaturalHRef.current = 0;
        root.style.setProperty('--de-utility-h', '0px');
      } else if (utilityEl && !isScrolled && utilityEl.offsetHeight > 0) {
        utilityNaturalHRef.current = utilityEl.offsetHeight;
        root.style.setProperty('--de-utility-h', `${utilityEl.offsetHeight}px`);
      }

      // Live bottom tracks the collapsed/expanded chrome for drawers + dropdowns.
      if (liveBottom > 0) {
        root.style.setProperty('--de-nav-current-bottom', `${Math.round(liveBottom)}px`);
      }

      // Content offset must stay at worst-case (utility + full nav) so padding does
      // not jump when the utility bar collapses on scroll.
      if (!isScrolled && navH > 0) {
        const utilityH = utilityNaturalHRef.current || utilityEl?.offsetHeight || 0;
        const chromeH = utilityH + navH + spyH;
        root.style.setProperty('--de-nav-chrome', `${Math.round(chromeH)}px`);
        root.style.setProperty('--de-nav-offset', `${Math.round(chromeH + BREATHING_PX)}px`);
      }
    };

    publish();
    const ro = new ResizeObserver(() => publish());
    if (utilityBarRef.current) ro.observe(utilityBarRef.current);
    if (navBarRef.current) ro.observe(navBarRef.current);
    if (spyBarRef.current) ro.observe(spyBarRef.current);
    window.addEventListener('resize', publish);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', publish);
    };
  }, [isScrolled]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  // Close mobile menu when resizing to desktop viewport
  useEffect(() => {
    const handleResize = () => {
      const isDesktop = window.innerWidth >= 1024; // lg breakpoint
      if (isDesktop && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
      if (!isDesktop && activeMenu) {
        setActiveMenu(null);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mobileMenuOpen, activeMenu]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <Tooltip.Provider delayDuration={0}>
      <>
        {/* Top Utility Bar - solid dark violet with fade effect */}
      <div 
        ref={utilityBarRef}
        className={`fixed top-0 de-fixed-in-canvas z-[60] hidden lg:block transition-all duration-300 ${
          /* Never lock height to --de-utility-h: that chicken-eggs measurement and
             clips enlarged utility glyphs above the viewport (only letter bottoms show). */
          isScrolled
            ? 'h-0 min-h-0 overflow-hidden opacity-0 pointer-events-none'
            : 'h-auto min-h-[var(--de-utility-h)] overflow-visible opacity-100'
        }`}
        style={{
          background: '#0a0a0a',
        }}
      >
        {/* Fade-in gradient from left (black) to right (subtle purple tint) */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, #0a0a0a 0%, #0a0a0a 40%, rgba(18, 8, 31, 0.8) 70%, rgba(13, 6, 20, 0.9) 100%)',
          }}
        />
        {/* Bottom edge fade line - only visible on right side */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, transparent 50%, rgba(139, 92, 246, 0.3) 80%, rgba(139, 92, 246, 0.2) 100%)',
          }}
        />
        {/* Assessment announcement strip — reference-style top bar */}
        {!announceDismissed && (
          <div className="relative z-10 w-full border-b border-white/[0.08] bg-black">
            <div className="max-w-[var(--de-canvas)] mx-auto relative flex w-full items-center justify-center gap-x-4 px-12 py-2">
              <p className="text-base font-medium leading-snug text-white/90">
                <span aria-hidden="true" className="mr-1.5">🚀</span>
                Get Your Free Cybersecurity Assessment &ndash; See Where You Stand Today!
              </p>
              <button
                type="button"
                onClick={() => openBooking('announcement-bar')}
                className="inline-flex shrink-0 items-center gap-1.5 text-base font-semibold leading-snug text-white underline underline-offset-4 transition-colors hover:text-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded"
                data-testid="announce-start-assessment"
              >
                Start My Assessment
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={dismissAnnounce}
                className="absolute right-3 lg:right-5 flex h-7 w-7 items-center justify-center rounded text-white/60 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                aria-label="Dismiss announcement"
                data-testid="announce-dismiss"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
        <div className="max-w-[var(--de-canvas)] mx-auto px-3 lg:px-5 flex flex-col md:flex-row items-center justify-end py-1.5 relative z-10 w-full">
          <div className="flex items-center flex-wrap gap-x-5 gap-y-1.5 md:gap-x-7 justify-center md:justify-end">
            <a
              href={PRIMARY_PHONE.telHref}
              className="flex items-center text-white/95 hover:text-de-magenta-ink text-base font-semibold leading-none tracking-wide transition-colors"
              data-testid="utility-phone"
            >
              <Phone className="h-4 w-4 mr-1.5 text-de-magenta-ink shrink-0" />
              <span className="hidden sm:inline">{PRIMARY_PHONE.display}</span>
              <span className="sm:hidden">Call</span>
            </a>

            {/* Restored from 61f25fc / live release 20260810193831 — Assist near Portal */}
            <a
              href="https://assist.zoho.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-white/90 hover:text-de-magenta-ink text-base font-medium leading-none transition-colors"
              data-testid="utility-zoho-assist"
            >
              <Monitor className="h-4 w-4 mr-1.5 text-de-magenta-ink shrink-0" />
              <span>Support</span>
            </a>

            <a
              href={PORTAL_LOGIN}
              className="flex items-center text-white/90 hover:text-de-magenta-ink text-base font-medium leading-none transition-colors"
              data-testid="utility-portal"
            >
              <span className="hidden sm:inline">Client Portal</span>
              <span className="sm:hidden">Portal</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main Navigation — live presence + solid chrome only when needed */}
      <nav 
        className={`fixed de-fixed-in-canvas z-[55] mega-menu-container transition-all duration-300 ${
          isScrolled ? 'top-0' : 'top-[var(--de-utility-h)]'
        } ${
          useSolidChrome
            ? 'bg-[#050312] border-b border-white/[0.10] shadow-[0_10px_28px_rgba(0,0,0,0.45)]'
            : isScrolled
              ? 'bg-black/95 backdrop-blur-xl border-b border-white/[0.08]'
              : 'bg-black/90 backdrop-blur-xl border-b border-white/[0.05]'
        }`}
        ref={menuContainerRef}
        role="navigation"
        aria-label="Main navigation"
        data-nav-theme={isOverLight ? 'over-light' : 'over-dark'}
      >
        <div className="max-w-[var(--de-canvas)] mx-auto w-full">
          <div
            ref={navBarRef}
            className={`flex items-center justify-between gap-3 px-3 xl:px-5 transition-all duration-300 max-lg:overflow-hidden ${
            isScrolled ? 'min-h-[var(--de-nav-h-scrolled)] h-[var(--de-nav-h-scrolled)] overflow-hidden' : 'min-h-[var(--de-nav-h)] h-[var(--de-nav-h)] overflow-visible'
          }`}>
            {/* Logo — the real DE logo stays (Preservation Law §18: recognizable
                branded elements are canonical; the speech-bubble glyph belongs
                to Ask DE chrome, not the masthead). */}
            <a
              href="/"
              className="flex items-center flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-de-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded"
              aria-label="Digerati Experts home"
            >
              <img
                src={DE_LOGO_REVERSE}
                alt="Digerati Experts Logo"
                className={`transition-all duration-300 ${
                  isScrolled ? 'h-10' : 'h-[3.25rem]'
                }`}
                style={{ width: 'auto', maxWidth: '220px' }}
                data-testid="logo-header"
              />
            </a>

            {/* Desktop Navigation - Center */}
            <div className="hidden lg:flex items-center space-x-1 xl:space-x-1.5 mega-menu-nav overflow-visible">
              {navItems.map((item, index) => (
                <div
                  key={item.name}
                  className="relative overflow-visible"
                  onMouseEnter={() => !item.isSimple && handleMouseEnter(item.name)}
                  onMouseLeave={handleMouseLeave}
                >
                  {item.isSimple ? (
                    <a
                      href={item.href}
                      className="group relative inline-flex items-center px-3 xl:px-4 py-2 text-lg xl:text-xl leading-normal text-white/90 hover:text-white font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-de-accent focus:ring-offset-2 focus:ring-offset-black rounded whitespace-nowrap overflow-visible"
                      data-testid={`nav-${item.name.toLowerCase()}`}
                      onClick={handleLinkClick}
                      aria-label={`Go to ${item.name}`}
                    >
                      {item.name}
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-de-accent group-hover:w-full transition-all duration-300" />
                    </a>
                  ) : (
                    <a
                      href={item.href || '#'}
                      ref={(el) => {
                        if (el) navButtonsRef.current.set(item.name, el);
                      }}
                      className={`group relative inline-flex items-center px-3 xl:px-4 py-2 text-lg xl:text-xl leading-normal text-white/90 hover:text-white font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-de-accent focus:ring-offset-2 focus:ring-offset-black rounded whitespace-nowrap overflow-visible ${
                        activeMenu === item.name ? 'text-white' : ''
                      }`}
                      data-testid={`nav-${item.name.toLowerCase()}`}
                      data-menu-trigger="true"
                      onClick={(e) => handleNavButtonClick(item.name, e)}
                      aria-expanded={activeMenu === item.name}
                      aria-haspopup="true"
                      aria-label={`${item.name} menu`}
                    >
                      {item.name}
                      <ChevronDown 
                        className={`ml-1 h-4 w-4 shrink-0 transition-transform ${
                          activeMenu === item.name ? 'rotate-180' : ''
                        }`} 
                        aria-hidden="true"
                      />
                      <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 bg-de-accent transition-all duration-300 ${
                        activeMenu === item.name ? 'w-full' : 'w-0 group-hover:w-full'
                      }`} />
                    </a>
                  )}

                  {/* Mega Menu Dropdown — opacity-only motion (no transform) so
                      position:fixed stays viewport-sized, not nav-trigger-sized. */}
                  <AnimatePresence>
                    {item.sections && activeMenu === item.name && (
                      <motion.div
                        ref={(el) => {
                          if (el) dropdownRefs.current.set(item.name, el);
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className={`mega-menu-dropdown fixed inset-x-0 top-[var(--de-nav-current-bottom)] mx-auto flex flex-col overflow-hidden ${
                          item.name === 'Solutions' || item.name === 'About'
                            ? 'w-[min(98vw,92rem)]'
                            : 'w-[min(96vw,72rem)]'
                        } ${item.name === 'Solutions' ? 'mega-menu-dropdown--dense' : ''} bg-[#0a0118] backdrop-blur-xl border border-white/15 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.6),0_0_40px_rgba(139,92,246,0.2)]`}
                        onMouseEnter={handleDropdownMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        role="menu"
                        aria-label={`${item.name} submenu`}
                        data-testid={item.name === 'Solutions' ? 'mega-menu-solutions' : `mega-menu-${item.name.toLowerCase()}`}
                        data-can-scroll={dropdownCanScroll ? 'true' : 'false'}
                      >
                        {/* Texture Overlays */}
                        <NoiseTexture id={uniqueId} />
                        <DotMatrixTexture />
                        {item.name === 'Solutions' && <CircuitLines id={uniqueId} />}

                        <div
                          ref={dropdownScrollRef}
                          className="mega-menu-dropdown-scroll relative min-h-0 flex-1"
                        >
                        <div className={`relative ${
                          item.name === 'Solutions' 
                            ? 'grid grid-cols-5 divide-x divide-white/5' 
                            : item.name === 'About'
                              ? 'p-8 grid grid-cols-3 gap-8 items-start'
                              : item.name === 'Industries'
                                ? 'p-8 grid grid-cols-3 gap-8 items-start'
                                : item.sections.length === 3 
                                  ? 'p-8 grid grid-cols-3 gap-8 items-start' 
                                  : 'p-8 flex gap-8 items-start'
                        }`}>
                          {item.sections.map((section, sectionIdx) => (
                            <motion.div 
                              key={section.title}
                              ref={(el) => {
                                if (el && item.name === 'Solutions') columnRefs.current.set(sectionIdx, el);
                              }}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: sectionIdx * 0.05 }}
                              className={`relative overflow-hidden ${
                                item.name === 'Solutions' 
                                  ? 'mega-menu-col min-w-0 px-4 py-4' 
                                  : 'flex-1 min-w-0'
                              }`}
                              onMouseMove={(e) => item.name === 'Solutions' && handleColumnMouseMove(e, sectionIdx)}
                              onMouseEnter={() => item.name === 'Solutions' && setHoveredColumn(sectionIdx)}
                              onMouseLeave={() => item.name === 'Solutions' && setHoveredColumn(null)}
                            >
                              {/* Cursor-following radial gradient for Solutions columns */}
                              {item.name === 'Solutions' && hoveredColumn === sectionIdx && (
                                <div 
                                  className="absolute inset-0 pointer-events-none transition-opacity duration-200"
                                  style={{
                                    background: `radial-gradient(200px circle at ${cursorPos.x}px ${cursorPos.y}px, rgba(139,92,246,0.1), transparent 70%)`,
                                  }}
                                  aria-hidden="true"
                                />
                              )}
                              {/* Section Header */}
                              <div className={item.name === 'Solutions' ? 'mb-2' : 'mb-4'}>
                                <h3 
                                  className={`font-bold text-xs uppercase tracking-[0.18em] flex items-center gap-2 ${
                                    section.featured ? 'text-de-accent-ink' : 'text-gray-400'
                                  }`}
                                  id={`menu-section-${section.title.replace(/\s+/g, '-')}`}
                                >
                                  {section.title}
                                </h3>
                                <div className={`h-px mt-2 ${
                                  section.featured 
                                    ? 'bg-de-raised' 
                                    : 'bg-white/5'
                                }`} />
                              </div>
                              
                              <ul 
                                className="space-y-1"
                                role="menu"
                                aria-labelledby={`menu-section-${section.title.replace(/\s+/g, '-')}`}
                                onMouseLeave={() => setHoveredItem(null)}
                              >
                                {section.items.map((subItem, itemIdx) => {
                                  const itemKey = `${section.title}-${subItem.title}`;
                                  const isHovered = hoveredItem === itemKey;
                                  
                                  return (
                                  <motion.li 
                                    key={subItem.title} 
                                    role="none"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: itemIdx * 0.03, duration: 0.2, ease: 'easeOut' }}
                                  >
                                    <Tooltip.Root>
                                      <Tooltip.Trigger asChild>
                                        <a
                                          href={subItem.url || '#'}
                                          className={`group/item flex items-start rounded-xl transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-de-accent border ${
                                            item.name === 'Solutions'
                                              ? 'gap-2.5 px-2.5 py-1.5'
                                              : 'gap-3.5 px-3 py-3'
                                          } ${
                                            isHovered 
                                              ? 'bg-de-raised border-de-hairline' 
                                              : 'border-transparent hover:bg-white/[0.03]'
                                          }`}
                                          onClick={handleLinkClick}
                                          onMouseEnter={() => setHoveredItem(itemKey)}
                                          role="menuitem"
                                        >
                                          {subItem.icon && (
                                            <span className={`mt-0.5 transition-colors flex-shrink-0 ${
                                              isHovered ? 'text-de-accent-ink' : 'text-de-accent-ink/60 group-hover/item:text-de-accent-ink'
                                            }`} aria-hidden="true">
                                              <div className="scale-100">{subItem.icon}</div>
                                            </span>
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className={`font-semibold transition-colors leading-snug ${
                                                item.name === 'Solutions' ? 'text-sm' : 'text-[15px]'
                                              } ${
                                                isHovered ? 'text-white' : 'text-gray-200 group-hover/item:text-white'
                                              }`}>
                                                {subItem.title}
                                              </span>
                                              {subItem.badge && (
                                                <DiagonalLinesBadge
                                                  variant={
                                                    subItem.badge === 'Popular' ? 'popular' : subItem.badge === 'Best Value' ? 'bestValue' : 'compliance'
                                                  }
                                                >
                                                  {subItem.badge}
                                                </DiagonalLinesBadge>
                                              )}
                                            </div>
                                            {subItem.description && (
                                              <p className={`text-white/70 group-hover/item:text-gray-400 transition-colors leading-snug ${
                                                item.name === 'Solutions'
                                                  ? 'mt-0.5 text-[13px] line-clamp-1'
                                                  : 'mt-1 text-sm line-clamp-2'
                                              }`}>
                                                {subItem.description}
                                              </p>
                                            )}
                                          </div>
                                        </a>
                                      </Tooltip.Trigger>
                                      {subItem.description && (
                                        <Tooltip.Portal>
                                          <Tooltip.Content
                                            className="z-[100] max-w-[250px] bg-[#1a0b2e] border border-white/20 px-3 py-2 rounded-lg text-xs text-gray-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
                                            sideOffset={5}
                                            side="right"
                                          >
                                            {subItem.description}
                                            <Tooltip.Arrow className="fill-[#1a0b2e] stroke-white/20" />
                                          </Tooltip.Content>
                                        </Tooltip.Portal>
                                      )}
                                    </Tooltip.Root>
                                  </motion.li>
                                  );
                                })}
                              </ul>
                              
                              {/* View All Link */}
                              {section.viewAllUrl && (
                                <a
                                  href={section.viewAllUrl}
                                  className={`inline-flex items-center gap-1.5 px-3 text-xs font-bold text-white/70 hover:text-de-accent-ink transition-colors group/view uppercase tracking-wider ${
                                    item.name === 'Solutions' ? 'mt-2' : 'mt-3'
                                  }`}
                                  onClick={handleLinkClick}
                                >
                                  Explore
                                  <ArrowRight className="w-3.5 h-3.5 group-hover/view:translate-x-0.5 transition-transform" />
                                </a>
                              )}
                            </motion.div>
                          ))}
                          
                          {item.featuredPanel && (
                            <motion.div 
                              className="relative bg-white/[0.02] p-6 flex flex-col justify-between overflow-hidden min-h-[22rem]"
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.15 }}
                            >
                              <HexagonPattern id={uniqueId} />
                              
                              <div className="relative z-10">
                                <h4 className="font-bold text-white text-base mb-4 flex items-center gap-2">
                                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                                  {item.featuredPanel.title}
                                </h4>
                                <div className="space-y-3">
                                  {item.featuredPanel.stats.map((stat, idx) => (
                                    <div key={idx} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                                      <span className="text-gray-400 text-xs uppercase tracking-wider font-semibold">{stat.label}</span>
                                      <span className="text-de-accent-ink font-bold text-base">{stat.value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <a
                                href={item.featuredPanel.cta.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="relative z-10 mt-6 w-full inline-flex items-center justify-center px-4 py-3 bg-de-accent hover:bg-de-accent text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-none"
                                onClick={handleLinkClick}
                              >
                                {item.featuredPanel.cta.text}
                                <ArrowRight className="w-3 h-3 ml-1.5" />
                              </a>
                            </motion.div>
                          )}
                          
                          {item.name === 'Industries' && (
                            <MenuFeaturedRail
                              href="/#industries"
                              eyebrow="Arizona practices"
                              title="HIPAA, privilege, tax data, and wire fraud"
                              body="Healthcare, legal, accounting, and real estate each fail in a different place. Start with the industry that matches how you actually operate."
                              cta="See industries we serve"
                              testId="menu-featured-industries"
                              linkTestId="link-featured-industries"
                              onNavigate={handleLinkClick}
                            />
                          )}

                          {item.name === 'About' && (
                            <MenuFeaturedRail
                              href="/about/team"
                              eyebrow="Chandler, Arizona"
                              title="You know who owns the ticket"
                              body="Principal-led MSP/MSSP. An Arizona team you can reach — not an anonymous remote queue."
                              cta="Meet the experts"
                              testId="menu-featured-about"
                              linkTestId="link-featured-team-about"
                              onNavigate={handleLinkClick}
                            />
                          )}

                          {item.name === 'Resources' && (
                            <MenuFeaturedRail
                              href="/resources/ebook/defending-digital-realm"
                              eyebrow="Free ebook"
                              title="Defending the Digital Realm"
                              body="What a cyber risk assessment finds in identity, email, backups, and insurance gaps — before an incident finds it for you."
                              cta="Read the ebook"
                              testId="menu-ebook-feature"
                              linkTestId="link-featured-ebook"
                              onNavigate={handleLinkClick}
                              image={ebookCover}
                              imageAlt="Defending the Digital Realm ebook cover"
                            />
                          )}
                        </div>
                        </div>
                        {dropdownCanScroll && !dropdownAtEnd ? (
                          <div className="mega-menu-dropdown-fade" aria-hidden="true" />
                        ) : null}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            {/* Right Side Actions — short label on lg so Schedule isn’t truncated */}
          <div className="flex items-center space-x-2 lg:space-x-3 flex-shrink-0">
            <button
              type="button"
              className="hidden lg:inline-flex items-center justify-center bg-[#D3126A] hover:bg-[#e01874] text-white px-3 xl:px-4 py-2 rounded-lg text-base font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              data-testid="nav-cta"
              onClick={() => { handleLinkClick(); openBooking("megamenu"); }}
              aria-label={CTA.primary}
            >
              <span className="xl:hidden">{CTA.primaryNavCompact}</span>
              <span className="hidden xl:inline">{CTA.primaryShort}</span>
            </button>

            {/* Mobile/Tablet Menu Button */}
            <button
              className="lg:hidden relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-de-hairline bg-de-raised hover:border-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-black transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="mobile-menu-toggle"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              <div className="relative w-6 h-6 flex items-center justify-center" aria-hidden="true">
                <span className="absolute w-5 h-0.5 -translate-y-1.5 bg-white rounded-full" />
                <span className="absolute w-5 h-0.5 bg-white rounded-full" />
                <span className="absolute w-5 h-0.5 translate-y-1.5 bg-white rounded-full" />
              </div>
            </button>
          </div>
        </div>
        </div>

        <div
          ref={spyBarRef}
          className={`w-full overflow-hidden motion-reduce:transition-none max-lg:!hidden ${
            isScrolled ? "hidden" : "hidden lg:block"
          }`}
          aria-hidden={isScrolled || undefined}
        >
          <HomepageOnPageNav />
        </div>

        {/* Mobile/Tablet Menu — charcoal field, magenta pop */}
        <div 
          className={`lg:hidden fixed de-fixed-in-canvas z-40 transition-all duration-300 ${
            mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'pointer-events-none hidden'
          }`}
          hidden={!mobileMenuOpen}
          aria-hidden={!mobileMenuOpen}
          style={{ 
            top: 'var(--de-nav-current-bottom)',
            height: 'calc(100dvh - var(--de-nav-current-bottom))'
          }}
        >
          <div 
            className={`absolute inset-0 bg-black/70 transition-opacity duration-300 ${
              mobileMenuOpen ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={() => setMobileMenuOpen(false)}
          />
          
          <div 
            className={`absolute right-0 top-0 h-full w-full max-w-md border-l border-de-hairline bg-[#050312] shadow-[0_24px_60px_rgba(0,0,0,0.55)] transform transition-transform duration-300 ease-out overflow-hidden ${
              mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
            role="dialog"
            aria-label="Navigation menu"
          >
            <div className="relative h-full overflow-y-auto overscroll-contain p-5 pb-24 space-y-2">
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-de-hairline">
                <span className="font-heading text-lg font-semibold text-white">
                  Menu
                </span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-de-hairline bg-de-raised hover:border-white/25 transition-colors"
                  aria-label="Close menu"
                  data-testid="mobile-menu-close"
                >
                  <X className="w-5 h-5 text-white/70" />
                </button>
              </div>

              {scrollContext && (
                <div className="mb-5">
                  <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-[#D3126A]">
                    On this page
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {scrollContext.sections
                      .map((section, index) => ({ section, index }))
                      .filter(({ section }) => section.showInNav !== false)
                      .map(({ section, index }) => (
                        <a
                          key={section.id}
                          href={`#${section.id}`}
                          onClick={(event) => {
                            event.preventDefault();
                            scrollContext.scrollToSection(index);
                            setMobileMenuOpen(false);
                          }}
                          className="inline-flex min-h-11 items-center rounded-lg border border-de-hairline bg-de-raised px-3 text-sm font-semibold text-white/90 hover:border-[#D3126A] hover:text-white"
                          data-testid={`mobile-page-${section.id}`}
                        >
                          {section.label}
                        </a>
                      ))}
                  </div>
                </div>
              )}

              {/* Navigation Items */}
              {navItems.map((item, index) => (
                <div 
                  key={item.name}
                  className="transform transition-all duration-300"
                  style={{ 
                    transitionDelay: mobileMenuOpen ? `${index * 50}ms` : '0ms',
                    opacity: mobileMenuOpen ? 1 : 0,
                    transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(20px)'
                  }}
                >
                  {item.isSimple ? (
                    <a
                      href={item.href}
                      className="group flex items-center justify-between py-4 px-4 text-white hover:text-[#D3126A] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] rounded-xl transition-all text-lg bg-white/0 hover:bg-white/[0.04] border border-transparent hover:border-de-hairline"
                      onClick={() => setMobileMenuOpen(false)}
                      data-testid={`mobile-nav-${item.name.toLowerCase()}`}
                      aria-label={`Go to ${item.name}`}
                    >
                      {item.name}
                      <ArrowRight className="w-5 h-5 text-white/55 group-hover:text-[#D3126A] transform group-hover:translate-x-1 transition-all" />
                    </a>
                  ) : (
                    <details className="group">
                      <summary 
                        className="flex items-center justify-between py-4 px-4 text-white hover:text-[#D3126A] font-semibold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] rounded-xl transition-all text-lg bg-white/0 hover:bg-white/[0.04] border border-transparent hover:border-de-hairline list-none [&::-webkit-details-marker]:hidden"
                        data-testid={`mobile-nav-${item.name.toLowerCase()}`}
                      >
                        <span className="flex items-center gap-3">
                          {item.name}
                        </span>
                        <ChevronDown className="h-5 w-5 text-white/55 transition-transform duration-300 group-open:rotate-180 group-open:text-[#D3126A]" aria-hidden="true" />
                      </summary>
                      {item.sections && (
                        <div className="mt-2 ml-1 space-y-1 rounded-xl border border-de-hairline bg-de-raised p-3">
                          {item.sections.map((section) => (
                            <div key={section.title} className="mb-4 last:mb-0">
                              <h4 className="mb-3 px-2 pt-1 text-sm font-semibold uppercase tracking-[0.16em] text-[#D3126A]">
                                {section.title}
                              </h4>
                              <div className="space-y-1">
                                {section.items.map((subItem) => (
                                  <a
                                    key={subItem.title}
                                    href={subItem.url || '#'}
                                    className="group/item flex items-center gap-3 py-3 px-3 text-base text-white/75 hover:text-white hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] rounded-lg transition-all border border-transparent hover:border-de-hairline"
                                    onClick={() => setMobileMenuOpen(false)}
                                    data-testid={`mobile-submenu-${subItem.title.toLowerCase().replace(/\s+/g, '-')}`}
                                    aria-label={`${subItem.title}: ${subItem.description || ''}`}
                                  >
                                    {subItem.icon && (
                                      <span className="text-[#D3126A] group-hover/item:text-[#f0187a] transition-colors">
                                        {subItem.icon}
                                      </span>
                                    )}
                                    <span className="flex-1">{subItem.title}</span>
                                    {subItem.badge && (
                                      <span className="text-sm border border-de-hairline bg-[#0a0a0a] px-2 py-0.5 rounded-full text-white/80">
                                        {subItem.badge}
                                      </span>
                                    )}
                                  </a>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </details>
                  )}
                </div>
              ))}
              
              {/* Divider with gradient */}
              <div className="py-4">
                <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              </div>
              
              {/* Contact Actions */}
              <div 
                className="space-y-3 transform transition-all duration-300"
                style={{ 
                  transitionDelay: mobileMenuOpen ? `${navItems.length * 50}ms` : '0ms',
                  opacity: mobileMenuOpen ? 1 : 0,
                  transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(20px)'
                }}
              >
                <a
                  href={PRIMARY_PHONE.telHref}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-de-hairline bg-de-raised hover:border-white/25 transition-all group"
                  data-testid="mobile-call"
                  aria-label={`Call us at ${PRIMARY_PHONE.display}`}
                >
                  <div className="w-10 h-10 rounded-lg border border-de-hairline bg-[#0a0a0a] flex items-center justify-center">
                    <Phone className="h-5 w-5 text-[#D3126A]" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-base text-white/55">Call Us</div>
                    <div className="font-semibold text-white group-hover:text-[#D3126A] transition-colors">{PRIMARY_PHONE.display}</div>
                  </div>
                </a>

                <a
                  href="https://assist.zoho.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-de-hairline bg-de-raised hover:border-white/25 transition-all group"
                  data-testid="mobile-zoho-assist"
                  aria-label="Open Support remote session"
                >
                  <div className="w-10 h-10 rounded-lg border border-de-hairline bg-[#0a0a0a] flex items-center justify-center">
                    <Monitor className="h-5 w-5 text-[#D3126A]" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-base text-gray-400">Remote Support</div>
                    <div className="font-semibold text-white group-hover:text-[#D3126A] transition-colors">Support</div>
                  </div>
                </a>
                
                <a
                  href={PORTAL_LOGIN}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all group"
                  data-testid="mobile-portal"
                  aria-label="Access client portal"
                >
                  <div className="w-10 h-10 rounded-lg border border-de-hairline bg-[#0a0a0a] flex items-center justify-center">
                    <ExternalLink className="h-5 w-5 text-[#D3126A]" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-base text-gray-400">Existing Client?</div>
                    <div className="font-semibold text-white group-hover:text-[#D3126A] transition-colors">Client Portal</div>
                  </div>
                </a>
              </div>
              
              {/* CTA Button */}
              <div 
                className="pt-4 transform transition-all duration-300"
                style={{ 
                  transitionDelay: mobileMenuOpen ? `${(navItems.length + 1) * 50}ms` : '0ms',
                  opacity: mobileMenuOpen ? 1 : 0,
                  transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(20px)'
                }}
              >
                <button
                  type="button"
                  className="w-full inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#D3126A] px-4 py-4 text-base font-semibold text-white transition-colors hover:bg-[#f0187a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050312] sm:text-lg"
                  onClick={() => { setMobileMenuOpen(false); openBooking("megamenu_mobile"); }}
                  data-testid="mobile-cta"
                  aria-label={CTA.primary}
                >
                  {CTA.primary}
                  <ArrowRight className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
              
              {/* Bottom Branding */}
              <div className="pt-8 pb-4 text-center">
                <p className="text-base text-gray-400">
                  Digerati Experts • Arizona's MSP Leader
                </p>
              </div>
            </div>
          </div>
        </div>
    </nav>
      </>
    </Tooltip.Provider>
  );
}
