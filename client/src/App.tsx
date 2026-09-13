import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelmetProvider } from "react-helmet-async";
import NotFound from "@/pages/not-found";
import { lazy, Suspense, useEffect } from "react";
import { analytics } from "@/lib/analytics";
import { ScrollProgress } from "@/components/ScrollProgress";
import { ExitIntentPopup } from "@/components/ExitIntentPopup";
import { StickyCTABar } from "@/components/StickyCTABar";
import { SiteBottomBar } from "@/components/SiteBottomBar";
import { MarketingChrome } from "@/components/MarketingChrome";
import { VersionFrame } from "@/pages/versions/VersionFrame";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoadingSkeleton } from "@/components/LoadingSkeleton";
import { AnnouncerProvider } from "@/components/AccessibleAnnouncer";
import { SkipToContent } from "@/components/SkipToContent";
import { DefaultCanonical } from "@/components/DefaultCanonical";
import { useGlobalShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useStoreChromeGestures } from "@/hooks/useStoreChromeGestures";
import { BookingProvider } from "@/contexts/BookingContext";
import { BookingModal } from "@/components/BookingModal";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { StagingReviewBadge } from "@/components/StagingReviewBadge";
import { isDoor2Path } from "@/lib/isDoor2Path";
import { isWarehousePath } from "@/lib/warehousePaths";

const SolutionsIndex = lazy(() => import("@/pages/solutions/SolutionsIndex"));
const ManagedITSupport = lazy(() => import("@/pages/solutions/ManagedITSupport"));
const ProActiveITEcosystemPage = lazy(() => import("@/pages/solutions/ProActiveITEcosystemPage"));
const ProActiveOfficeEcosystemPage = lazy(() => import("@/pages/solutions/ProActiveOfficeEcosystemPage"));
const ProActiveBusinessEcosystemPage = lazy(() => import("@/pages/solutions/ProActiveBusinessEcosystemPage"));
const ProActiveEnterpriseEcosystemPage = lazy(() => import("@/pages/solutions/ProActiveEnterpriseEcosystemPage"));
const StandaloneServices = lazy(() => import("@/pages/solutions/StandaloneServices"));
const ManagedWorkplace = lazy(() => import("@/pages/solutions/ManagedWorkplace"));
const BackupDisasterRecovery = lazy(() => import("@/pages/solutions/BackupDisasterRecovery"));
const ProActiveEcosystemPage = lazy(() => import("@/pages/solutions/ProActiveEcosystemPage"));
const CoManagedIT = lazy(() => import("@/pages/solutions/CoManagedIT"));
const BusinessNeedsIndex = lazy(() => import("@/pages/solutions/BusinessNeedsIndex"));
const BusinessNeedsFamily = lazy(() => import("@/pages/solutions/BusinessNeedsFamily"));
const SolutionRequest = lazy(() => import("@/pages/solutions/SolutionRequest"));
const UCaaS = lazy(() => import("@/pages/services/UCaaS"));
const Healthcare = lazy(() => import("@/pages/industries/Healthcare"));
const Accounting = lazy(() => import("@/pages/industries/Accounting"));
const LawFirms = lazy(() => import("@/pages/industries/LawFirms"));
const RealEstate = lazy(() => import("@/pages/industries/RealEstate"));
const Nonprofits = lazy(() => import("@/pages/industries/Nonprofits"));
const AnimalHospitals = lazy(() => import("@/pages/industries/AnimalHospitals"));
const IndustriesIndex = lazy(() => import("@/pages/industries/IndustriesIndex"));
const CaseStudies = lazy(() => import("@/pages/resources/CaseStudies"));
const CaseStudyDetail = lazy(() => import("@/pages/resources/CaseStudyDetail"));
const Blog = lazy(() => import("@/pages/resources/Blog"));
const BlogPost = lazy(() => import("@/pages/resources/BlogPost"));
const CyberFacts = lazy(() => import("@/pages/resources/CyberFacts"));
const SecurityUpdates = lazy(() => import("@/pages/resources/SecurityUpdates"));
const Videos = lazy(() => import("@/pages/resources/Videos"));
const SecurityChecklist = lazy(() => import("@/pages/resources/SecurityChecklist"));
const Datasheets = lazy(() => import("@/pages/resources/Datasheets"));
const DowntimeCalculator = lazy(() => import("@/pages/resources/DowntimeCalculator"));
const ResourcesIndex = lazy(() => import("@/pages/resources/ResourcesIndex"));
const KnowledgeBase = lazy(() => import("@/pages/support/KnowledgeBase"));
const RemoteSupport = lazy(() => import("@/pages/support/RemoteSupport"));
const PayInvoice = lazy(() => import("@/pages/support/PayInvoice"));
const MissionValues = lazy(() => import("@/pages/about/MissionValues"));
const Team = lazy(() => import("@/pages/about/Team"));
const Compliance = lazy(() => import("@/pages/about/Compliance"));
const SupportPage = lazy(() => import("@/pages/about/Support"));
const Insurance = lazy(() => import("@/pages/about/Insurance"));
const ComplianceCertifications = lazy(() => import("@/pages/about/ComplianceCertifications"));
const ClientBillOfRights = lazy(() => import("@/pages/about/ClientBillOfRights"));
const Guarantee = lazy(() => import("@/pages/about/Guarantee"));
const TwentyOneQuestions = lazy(() => import("@/pages/about/TwentyOneQuestions"));
const Press = lazy(() => import("@/pages/about/Press"));
const PrivacyPolicy = lazy(() => import("@/pages/legal/PrivacyPolicy"));
const TermsOfUse = lazy(() => import("@/pages/legal/TermsOfUse"));
const MSA = lazy(() => import("@/pages/legal/MSA"));
const SLA = lazy(() => import("@/pages/legal/SLA"));
const AUP = lazy(() => import("@/pages/legal/AUP"));
const DPA = lazy(() => import("@/pages/legal/DPA"));
const SampleSOW = lazy(() => import("@/pages/legal/SampleSOW"));
const TrustCenter = lazy(() => import("@/pages/trust/TrustCenter"));
const VulnerabilityDisclosure = lazy(() => import("@/pages/trust/VulnerabilityDisclosure"));
const Accessibility = lazy(() => import("@/pages/trust/Accessibility"));
const SubmitTicket = lazy(() => import("@/pages/support/SubmitTicket"));
const TicketConfirmation = lazy(() => import("@/pages/support/TicketConfirmation"));
const GenericServicePage = lazy(() => import("@/pages/GenericServicePage"));

// Location pages
const ChandlerAZ = lazy(() => import("@/pages/locations/ChandlerAZ"));
const PhoenixAZ = lazy(() => import("@/pages/locations/PhoenixAZ"));
const MesaAZ = lazy(() => import("@/pages/locations/MesaAZ"));
const GilbertAZ = lazy(() => import("@/pages/locations/GilbertAZ"));
const TempeAZ = lazy(() => import("@/pages/locations/TempeAZ"));
const ScottsdalAZ = lazy(() => import("@/pages/locations/ScottsdalAZ"));

// Portal pages
const PortalLogin = lazy(() => import("@/pages/portal/PortalLogin"));
const PortalSignup = lazy(() => import("@/pages/portal/PortalSignup"));
const PortalForgotPassword = lazy(() => import("@/pages/portal/PortalForgotPassword"));
const PortalResetPassword = lazy(() => import("@/pages/portal/PortalResetPassword"));
const PortalDashboard = lazy(() => import("@/pages/portal/PortalDashboard"));
const PortalTickets = lazy(() => import("@/pages/portal/PortalTickets"));
const PortalTicketDetail = lazy(() => import("@/pages/portal/PortalTicketDetail"));
const PortalCreateTicket = lazy(() => import("@/pages/portal/PortalCreateTicket"));
const PortalServices = lazy(() => import("@/pages/portal/PortalServices"));
const PortalInvoices = lazy(() => import("@/pages/portal/PortalInvoices"));
const PortalPayment = lazy(() => import("@/pages/portal/PortalPayment"));
const PortalKB = lazy(() => import("@/pages/portal/PortalKB"));
const PortalStatus = lazy(() => import("@/pages/portal/PortalStatus"));
const PortalLearning = lazy(() => import("@/pages/portal/PortalLearning"));
const PortalChat = lazy(() => import("@/pages/portal/PortalChat"));
const PortalAgent = lazy(() => import("@/pages/portal/PortalAgent"));
const PortalSettings = lazy(() => import("@/pages/portal/PortalSettings"));
const PortalShipCenter = lazy(() => import("@/pages/portal/PortalShipCenter"));
const PortalProcurementStore = lazy(() => import("@/pages/portal/PortalProcurementStore"));
const PortalAdvancedForms = lazy(() => import("@/pages/portal/PortalAdvancedForms").then(m => ({ default: m.PortalAdvancedForms })));
const PortalSatisfactionSurvey = lazy(() => import("@/pages/portal/PortalSatisfactionSurvey").then(m => ({ default: m.PortalSatisfactionSurvey })));
const PortalApprovals = lazy(() => import("@/pages/portal/PortalApprovals").then(m => ({ default: m.PortalApprovals })));
const PortalPeople = lazy(() => import("@/pages/portal/PortalPeople").then(m => ({ default: m.PortalPeople })));
const PortalInfrastructure = lazy(() => import("@/pages/portal/PortalInfrastructure").then(m => ({ default: m.PortalInfrastructure })));
const PortalQuestionnaireCalendar = lazy(() => import("@/pages/portal/PortalQuestionnaireCalendar").then(m => ({ default: m.PortalQuestionnaireCalendar })));
const PortalVPN = lazy(() => import("@/pages/portal/PortalVPN"));
const PortalCytracom = lazy(() => import("@/pages/portal/PortalCytracom"));
const PortalFiles = lazy(() => import("@/pages/portal/PortalFiles"));
const PortalOrders = lazy(() => import("@/pages/portal/PortalOrders"));
const PortalMarketplace = lazy(() => import("@/pages/portal/PortalMarketplace"));
const PortalOrderDetail = lazy(() => import("@/pages/portal/PortalOrderDetail"));
const PortalBilling = lazy(() => import("@/pages/portal/PortalBilling"));
const PortalCompany = lazy(() => import("@/pages/portal/PortalCompany"));
const AdminImportPage = lazy(() => import("@/pages/portal/AdminImport").then(m => ({ default: m.AdminImport })));
const AdminAgentsPage = lazy(() => import("@/pages/portal/AdminAgents").then(m => ({ default: m.AdminAgents })));
const AdminOpenAIPage = lazy(() => import("@/pages/portal/AdminOpenAI").then(m => ({ default: m.AdminOpenAI })));
const AdminCompaniesPage = lazy(() => import("@/pages/portal/AdminCompanies").then(m => ({ default: m.AdminCompanies })));
const AdminLoginKnocksPage = lazy(() => import("@/pages/portal/AdminLoginKnocks").then(m => ({ default: m.AdminLoginKnocks })));
const AdminLifecyclePage = lazy(() => import("@/pages/portal/AdminLifecycle").then(m => ({ default: m.AdminLifecycle })));
const AdminContractsPage = lazy(() => import("@/pages/portal/AdminContracts").then(m => ({ default: m.AdminContracts })));
const PortalContracts = lazy(() => import("@/pages/portal/PortalContracts").then(m => ({ default: m.PortalContracts })));
const OrderForm = lazy(() => import("@/pages/portal/OrderForm").then(m => ({ default: m.OrderForm })));
const LeadQuoteWizard = lazy(() => import("@/pages/LeadQuoteWizard"));
const QuoteConfirmation = lazy(() => import("@/pages/QuoteConfirmation"));
const ThankYouSuccess = lazy(() => import("@/pages/ThankYouSuccess"));
const SalesProcess = lazy(() => import("@/pages/portal/SalesProcess"));
const PortalRoadmap = lazy(() => import("@/pages/portal/PortalRoadmap"));
const PortalQBR = lazy(() => import("@/pages/portal/PortalQBR"));
const ProActiveEcosystemPricing = lazy(() => import("@/pages/ProActiveEcosystemPricing"));
const EcosystemPricing = lazy(() => import("@/pages/EcosystemPricing"));
const EcosystemMatrixOfficial = lazy(() => import("@/pages/EcosystemMatrixOfficial"));
const NetworkPlannerOfficial = lazy(() => import("@/pages/NetworkPlannerOfficial"));
const Ebook = lazy(() => import("@/pages/resources/Ebook"));
const BookingPage = lazy(() => import("@/pages/BookingPage"));
const ContactPage = lazy(() => import("@/pages/Contact"));
const DigeratiHomepage = lazy(() => import("@/pages/DigeratiHomepage").then((m) => ({ default: m.DigeratiHomepage })));

// Homepage versions: a frozen, reachable copy of every homepage the site has
// had or is considering (client/src/pages/versions/README.md). Reference only.
const VersionsIndex = lazy(() => import("@/pages/versions/VersionsIndex"));
const VersionTwoForward = lazy(() => import("@/pages/versions/VersionTwoForward"));
const HomepageV1 = lazy(() => import("@/pages/versions/v1/DigeratiHomepage").then((m) => ({ default: m.DigeratiHomepage })));
const ExperienceInSite = lazy(() => import("@/pages/ExperienceInSite"));
const HomepageV3 = lazy(() => import("@/pages/versions/v3/DigeratiHomepage").then((m) => ({ default: m.DigeratiHomepage })));

const WarehouseGate = lazy(() => import("@/pages/store/WarehouseGate"));
const PublicStoreCheckout = lazy(() => import("@/pages/store/PublicStoreCheckout"));

// Internal DE sales pages were removed from the public bundle for security.
// They now live behind authentication in the Intelligence Hub (techsales).

import { servicePageData, industryPageData, supportPageData } from "@/pages/routes/servicePages";

function Router() {
  return (
    <Switch>
      {/* Homepage */}
      <Route path="/" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <DigeratiHomepage />
        </Suspense>
      )} />

      {/* Experience v1 in the site's own chrome — review only, noindex, not in navigation */}
      <Route path="/experience" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <ExperienceInSite />
        </Suspense>
      )} />

      {/* Homepage versions — reference archive, noindex, not in navigation */}
      <Route path="/versions" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <VersionsIndex />
        </Suspense>
      )} />
      <Route path="/version-1" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <VersionFrame n={1}>
            <HomepageV1 />
          </VersionFrame>
        </Suspense>
      )} />
      <Route path="/version-2" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <VersionTwoForward />
        </Suspense>
      )} />
      <Route path="/version-3" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <VersionFrame n={3}>
            <HomepageV3 />
          </VersionFrame>
        </Suspense>
      )} />

      {/* Solutions Pages */}
      <Route path="/solutions" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <SolutionsIndex />
        </Suspense>
      )} />
      <Route path="/solutions/managed-it-support" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <ManagedITSupport />
        </Suspense>
      )} />
      <Route path="/solutions/managed-workplace" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <ManagedWorkplace />
        </Suspense>
      )} />
      <Route path="/solutions/backup-disaster-recovery" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <BackupDisasterRecovery />
        </Suspense>
      )} />
      <Route path="/solutions/ProActive-Ecosystem-Packages">{() => <Redirect to="/solutions/proactive-ecosystem" />}</Route>
      <Route path="/solutions/proactive-ecosystem-packages">{() => <Redirect to="/solutions/proactive-ecosystem" />}</Route>
      <Route path="/solutions/proactive-ecosystem" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <ProActiveEcosystemPage />
        </Suspense>
      )} />
      <Route path="/solutions/proactive-it-ecosystem" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <ProActiveITEcosystemPage />
        </Suspense>
      )} />
      <Route path="/solutions/proactive-office-ecosystem" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <ProActiveOfficeEcosystemPage />
        </Suspense>
      )} />
      <Route path="/solutions/proactive-business-ecosystem" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <ProActiveBusinessEcosystemPage />
        </Suspense>
      )} />
      <Route path="/solutions/proactive-enterprise-ecosystem" component={() => (
        <ErrorBoundary>
          <Suspense fallback={<PageLoadingSkeleton />}>
            <ProActiveEnterpriseEcosystemPage />
          </Suspense>
        </ErrorBoundary>
      )} />
      <Route path="/solutions/standalone-services" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <StandaloneServices />
        </Suspense>
      )} />
      <Route path="/solutions/co-managed-it" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <CoManagedIT />
        </Suspense>
      )} />
      <Route path="/solutions/business-needs/:family" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <BusinessNeedsFamily />
        </Suspense>
      )} />
      <Route path="/solutions/business-needs" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <BusinessNeedsIndex />
        </Suspense>
      )} />
      <Route path="/store/solutions/:family" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <BusinessNeedsFamily />
        </Suspense>
      )} />
      <Route path="/store/solution" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PublicStoreCheckout />
        </Suspense>
      )} />
      <Route path="/store/checkout" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PublicStoreCheckout />
        </Suspense>
      )} />
      <Route path="/store" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <BusinessNeedsIndex />
        </Suspense>
      )} />
      <Route path="/solutions/request" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <SolutionRequest />
        </Suspense>
      )} />
      {Object.entries(servicePageData).filter(([key]) => !['managed-workplace', 'backup-disaster-recovery', 'co-managed-it', 'managed-it-support', 'ProActive-Ecosystem-Packages'].includes(key)).map(([key, data]) => (
        <Route key={key} path={`/solutions/${key}`} component={() => (
          <Suspense fallback={<PageLoadingSkeleton />}>
            <GenericServicePage {...data} serviceKey={key} canonical={`/solutions/${key}`} />
          </Suspense>
        )} />
      ))}
      
      <Route path="/internal/warehouse/*" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <WarehouseGate />
        </Suspense>
      )} />
      <Route path="/internal/warehouse" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <WarehouseGate />
        </Suspense>
      )} />
      
      {/* Services Pages */}
      <Route path="/services/ucaas" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <UCaaS />
        </Suspense>
      )} />
      
      {/* Industries Pages */}
      <Route path="/industries" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <IndustriesIndex />
        </Suspense>
      )} />
      <Route path="/industries/healthcare" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <Healthcare />
        </Suspense>
      )} />
      <Route path="/industries/accounting-finance" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <Accounting />
        </Suspense>
      )} />
      <Route path="/industries/law-firms" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <LawFirms />
        </Suspense>
      )} />
      <Route path="/industries/real-estate" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <RealEstate />
        </Suspense>
      )} />
      <Route path="/industries/nonprofits" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <Nonprofits />
        </Suspense>
      )} />
      <Route path="/industries/animal-hospitals" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <AnimalHospitals />
        </Suspense>
      )} />
      {Object.entries(industryPageData).map(([key, data]) => (
        <Route key={key} path={`/industries/${key}`} component={() => (
          <Suspense fallback={<PageLoadingSkeleton />}>
            <GenericServicePage {...data} serviceKey={key} canonical={`/industries/${key}`} />
          </Suspense>
        )} />
      ))}
      
      {/* Resources Pages */}
      <Route path="/resources" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <ResourcesIndex />
        </Suspense>
      )} />
      <Route path="/resources/case-studies/:slug" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <CaseStudyDetail />
        </Suspense>
      )} />
      <Route path="/resources/case-studies" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <CaseStudies />
        </Suspense>
      )} />
      <Route path="/resources/blog" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <Blog />
        </Suspense>
      )} />
      <Route path="/resources/blog/:slug" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <BlogPost />
        </Suspense>
      )} />
      <Route path="/resources/cyber-facts" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <CyberFacts />
        </Suspense>
      )} />
      <Route path="/resources/ebook/defending-digital-realm" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <Ebook />
        </Suspense>
      )} />
      <Route path="/resources/security-updates" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <SecurityUpdates />
        </Suspense>
      )} />
      <Route path="/resources/videos" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <Videos />
        </Suspense>
      )} />
      <Route path="/resources/security-checklist" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <SecurityChecklist />
        </Suspense>
      )} />
      <Route path="/resources/datasheets" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <Datasheets />
        </Suspense>
      )} />
      <Route path="/resources/downtime-calculator" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <DowntimeCalculator />
        </Suspense>
      )} />
      {/* About Pages */}
      <Route path="/about/mission">{() => <Redirect to="/about/mission-values" />}</Route>
      <Route path="/about/mission-values" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <MissionValues />
        </Suspense>
      )} />
      <Route path="/about/team" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <Team />
        </Suspense>
      )} />
      <Route path="/about/compliance" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <Compliance />
        </Suspense>
      )} />
      <Route path="/about/support" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <SupportPage />
        </Suspense>
      )} />
      <Route path="/about/insurance" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <Insurance />
        </Suspense>
      )} />
      <Route path="/about/compliance-certifications" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <ComplianceCertifications />
        </Suspense>
      )} />
      <Route path="/about/client-bill-of-rights" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <ClientBillOfRights />
        </Suspense>
      )} />
      <Route path="/about/guarantee" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <Guarantee />
        </Suspense>
      )} />
      <Route path="/about/21-questions" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <TwentyOneQuestions />
        </Suspense>
      )} />
      <Route path="/about/press" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <Press />
        </Suspense>
      )} />
      
      {/* Support Pages */}
      <Route path="/support/ticket-confirmation" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <TicketConfirmation />
        </Suspense>
      )} />
      <Route path="/support/submit-ticket" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <SubmitTicket />
        </Suspense>
      )} />
      <Route path="/support/knowledge-base" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <KnowledgeBase />
        </Suspense>
      )} />
      <Route path="/support/remote-support" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <RemoteSupport />
        </Suspense>
      )} />
      <Route path="/support/pay-invoice" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PayInvoice />
        </Suspense>
      )} />
      {Object.entries(supportPageData).map(([key, data]) => (
        <Route key={key} path={`/support/${key}`} component={() => (
          <Suspense fallback={<PageLoadingSkeleton />}>
            <GenericServicePage {...data} canonical={`/support/${key}`} />
          </Suspense>
        )} />
      ))}
      
      <Route path="/privacy">{() => <Redirect to="/legal/privacy-policy" />}</Route>
      <Route path="/terms">{() => <Redirect to="/legal/terms-of-use" />}</Route>

      {/* Legal Pages */}
      <Route path="/legal/privacy-policy" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PrivacyPolicy />
        </Suspense>
      )} />
      <Route path="/legal/terms-of-use" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <TermsOfUse />
        </Suspense>
      )} />
      <Route path="/legal/msa" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <MSA />
        </Suspense>
      )} />
      <Route path="/legal/sla" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <SLA />
        </Suspense>
      )} />
      <Route path="/legal/aup" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <AUP />
        </Suspense>
      )} />
      <Route path="/legal/dpa" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <DPA />
        </Suspense>
      )} />
      <Route path="/legal/sample-sow" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <SampleSOW />
        </Suspense>
      )} />
      
      {/* Trust Pages */}
      <Route path="/trust">{() => <Redirect to="/trust/trust-center" />}</Route>
      <Route path="/trust/trust-center" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <TrustCenter />
        </Suspense>
      )} />
      <Route path="/trust/vulnerability-disclosure" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <VulnerabilityDisclosure />
        </Suspense>
      )} />
      <Route path="/trust/accessibility" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <Accessibility />
        </Suspense>
      )} />
      
      {/* Location Pages */}
      <Route path="/locations/chandler-az" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <ChandlerAZ />
        </Suspense>
      )} />
      <Route path="/locations/phoenix-az" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PhoenixAZ />
        </Suspense>
      )} />
      <Route path="/locations/mesa-az" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <MesaAZ />
        </Suspense>
      )} />
      <Route path="/locations/gilbert-az" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <GilbertAZ />
        </Suspense>
      )} />
      <Route path="/locations/tempe-az" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <TempeAZ />
        </Suspense>
      )} />
      <Route path="/locations/scottsdale-az" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <ScottsdalAZ />
        </Suspense>
      )} />
      
      {/* Short portal aliases (bookmarks / mistyped URLs) */}
      <Route path="/login">
        <Redirect to="/portal/login" />
      </Route>
      <Route path="/signup">
        <Redirect to="/portal/signup" />
      </Route>

      {/* Portal root redirect */}
      <Route path="/portal">
        <Redirect to="/portal/login" />
      </Route>

      {/* Portal Pages */}
      <Route path="/portal/login" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalLogin />
        </Suspense>
      )} />
      <Route path="/portal/signup" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalSignup />
        </Suspense>
      )} />
      <Route path="/portal/forgot-password" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalForgotPassword />
        </Suspense>
      )} />
      <Route path="/portal/reset-password" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalResetPassword />
        </Suspense>
      )} />
      <Route path="/portal/dashboard" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalDashboard />
        </Suspense>
      )} />
      <Route path="/portal/tickets" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalTickets />
        </Suspense>
      )} />
      <Route path="/portal/tickets/create" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalCreateTicket />
        </Suspense>
      )} />
      <Route path="/portal/tickets/new" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalCreateTicket />
        </Suspense>
      )} />
      <Route path="/portal/tickets/:id" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalTicketDetail />
        </Suspense>
      )} />
      <Route path="/portal/services" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalServices />
        </Suspense>
      )} />
      <Route path="/portal/files" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalFiles />
        </Suspense>
      )} />
      <Route path="/portal/invoices" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalInvoices />
        </Suspense>
      )} />
      <Route path="/portal/orders" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalOrders />
        </Suspense>
      )} />
      <Route path="/portal/orders/:id" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalOrderDetail />
        </Suspense>
      )} />
      <Route path="/portal/invoices/:id/pay" component={({ params }) => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalPayment invoiceId={params.id || ""} />
        </Suspense>
      )} />
      <Route path="/portal/kb" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalKB />
        </Suspense>
      )} />
      <Route path="/portal/status" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalStatus />
        </Suspense>
      )} />
      <Route path="/portal/learning" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalLearning />
        </Suspense>
      )} />
      <Route path="/portal/chat" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalChat />
        </Suspense>
      )} />
      <Route path="/portal/agent" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalAgent />
        </Suspense>
      )} />
      <Route path="/portal/settings" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalSettings />
        </Suspense>
      )} />
      <Route path="/portal/billing" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalBilling />
        </Suspense>
      )} />
      <Route path="/portal/company" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalCompany />
        </Suspense>
      )} />
      <Route path="/portal/ship-center" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalShipCenter />
        </Suspense>
      )} />
      <Route path="/portal/procurement" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalProcurementStore />
        </Suspense>
      )} />
      <Route path="/portal/marketplace" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalMarketplace />
        </Suspense>
      )} />
      <Route path="/portal/forms" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalAdvancedForms />
        </Suspense>
      )} />
      <Route path="/portal/surveys" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalSatisfactionSurvey />
        </Suspense>
      )} />
      <Route path="/portal/approvals" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalApprovals />
        </Suspense>
      )} />
      <Route path="/portal/people" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalPeople />
        </Suspense>
      )} />
      <Route path="/portal/infrastructure" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalInfrastructure />
        </Suspense>
      )} />
      <Route path="/portal/vpn" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalVPN />
        </Suspense>
      )} />
      <Route path="/portal/cytracom" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalCytracom />
        </Suspense>
      )} />
      <Route path="/portal/questionnaires" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalQuestionnaireCalendar />
        </Suspense>
      )} />
      <Route path="/portal/admin/import" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <AdminImportPage />
        </Suspense>
      )} />
      <Route path="/portal/admin/agents" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <AdminAgentsPage />
        </Suspense>
      )} />
      <Route path="/portal/admin/openai" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <AdminOpenAIPage />
        </Suspense>
      )} />
      <Route path="/portal/admin/companies" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <AdminCompaniesPage />
        </Suspense>
      )} />
      <Route path="/portal/admin/login-knocks" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <AdminLoginKnocksPage />
        </Suspense>
      )} />
      <Route path="/portal/admin/lifecycle" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <AdminLifecyclePage />
        </Suspense>
      )} />
      <Route path="/portal/admin/contracts" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <AdminContractsPage />
        </Suspense>
      )} />
      <Route path="/portal/contracts" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalContracts />
        </Suspense>
      )} />
      <Route path="/portal/order-form" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <OrderForm />
        </Suspense>
      )} />
      <Route path="/portal/sales-process" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <SalesProcess />
        </Suspense>
      )} />
      <Route path="/portal/roadmap" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalRoadmap />
        </Suspense>
      )} />
      <Route path="/portal/qbr" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <PortalQBR />
        </Suspense>
      )} />
      
      {/* Lead Quote */}
      <Route path="/quote-wizard" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <LeadQuoteWizard />
        </Suspense>
      )} />
      <Route path="/quote-confirmation" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <QuoteConfirmation />
        </Suspense>
      )} />
      <Route path="/thank-you-success-page" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <ThankYouSuccess />
        </Suspense>
      )} />
      
      {/* ProActive Ecosystem Pricing */}
      <Route path="/proactive-ecosystem-pricing" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <ProActiveEcosystemPricing />
        </Suspense>
      )} />
      <Route path="/pricing" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <ProActiveEcosystemPricing />
        </Suspense>
      )} />
      
      {/* Ecosystem Pricing - Service Matrix */}
      <Route path="/ecosystem-pricing" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <EcosystemPricing />
        </Suspense>
      )} />
      
      <Route path="/de-ecosystem-matrix-offical" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <EcosystemMatrixOfficial />
        </Suspense>
      )} />
      <Route path="/official-network-planner" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <NetworkPlannerOfficial />
        </Suspense>
      )} />
      
      <Route path="/book" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <BookingPage />
        </Suspense>
      )} />

      {/* Legacy / shorthand URLs → canonical routes */}
      <Route path="/assessment">{() => <Redirect to="/book" />}</Route>
      <Route path="/contact" component={() => (
        <Suspense fallback={<PageLoadingSkeleton />}>
          <ContactPage />
        </Suspense>
      )} />
      <Route path="/case-studies">{() => <Redirect to="/resources/case-studies" />}</Route>
      <Route path="/solutions/endpoint-management">{() => <Redirect to="/solutions/threat-detection" />}</Route>
      <Route path="/solutions/identity-management">{() => <Redirect to="/solutions/unified-security" />}</Route>
      <Route path="/solutions/email-security">{() => <Redirect to="/solutions/security-operations" />}</Route>

      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function SpaPageViews() {
  const [location] = useLocation();
  useEffect(() => {
    analytics.pageView(location, document.title);
  }, [location]);
  return null;
}

/*
 * Page families keep one hue of their own. It only ever colours topical
 * signals — eyebrows, glyphs, chips, inline links — while the field, type,
 * spacing and primary CTA stay identical sitewide. Anything unlisted inherits
 * the brand magenta default.
 */
const ACCENT_BY_PREFIX: ReadonlyArray<readonly [string, string]> = [
  ["/internal/warehouse", "electric"],
  ["/store", "electric"],
  ["/support", "cyan"],
  ["/resources/blog", "amber"],
];

function accentFor(location: string): string | undefined {
  const match = ACCENT_BY_PREFIX.find(([prefix]) => location.startsWith(prefix));
  return match?.[1];
}

function AppContent() {
  useGlobalShortcuts();
  const [location] = useLocation();
  useStoreChromeGestures(location);
  const isPortal = location.startsWith("/portal");
  const isHome = location === "/";
  const hideDoor2HelpDock = isDoor2Path(location) && !["/store", "/solutions/business-needs"].includes(location.split("?")[0]);
  const hideWarehouseChrome = isWarehousePath(location);
  const accent = isPortal ? undefined : accentFor(location);

  useEffect(() => {
    document.documentElement.classList.toggle("de-marketing-canvas", !isPortal);
    return () => document.documentElement.classList.remove("de-marketing-canvas");
  }, [isPortal]);

  return (
    <AnnouncerProvider>
      <DefaultCanonical />
      <SkipToContent />
      <ScrollProgress />
      <SpaPageViews />
      <div
        id="app-canvas"
        data-accent={accent}
        className={isPortal ? undefined : "de-site-canvas"}
      >
        <Router />
      </div>
      <MarketingChrome />
      {!isHome && !hideDoor2HelpDock && !hideWarehouseChrome && <SiteBottomBar />}
      <StickyCTABar />
      <ExitIntentPopup delay={5000} />
      <CookieConsentBanner />
      <StagingReviewBadge />
    </AnnouncerProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <BookingProvider>
            <TooltipProvider>
              <Toaster />
              <BookingModal />
              <AppContent />
            </TooltipProvider>
          </BookingProvider>
        </QueryClientProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}

export default App;
