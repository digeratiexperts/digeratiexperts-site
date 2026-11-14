import { CANONICAL_CSRA_ONE_TIME } from "@shared/canonicalCsra";
import { ALERT_MONITORING_CLAIM_PHRASE } from "@shared/publicSecurityClaims";

export interface ServiceItem {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: 'core' | 'infrastructure' | 'security' | 'communications' | 'business_continuity' | 'compliance' | 'consulting';
  pricingType: 'per_site' | 'per_user' | 'per_endpoint' | 'flat' | 'custom';
  basePrice: number;
  pricingUnit: string;
  minQuantity: number;
  documentKey: string;
  features: string[];
  isPopular?: boolean;
  tier?: 'office' | 'business' | 'enterprise';
}

export interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  services: ServiceItem[];
}

/** Advisor knowledge only. Portal /portal/order-form uses shared/portalOrderCatalog.ts. */
export const serviceCatalog: ServiceCategory[] = [
  {
    id: 'core',
    name: 'Core IT Services',
    description: 'Foundation managed IT services',
    icon: 'Server',
    services: [
      {
        id: 'core-it-office',
        name: 'Core IT Infrastructure & Support - Office',
        shortName: 'Core IT Office',
        description: 'Essential IT management for small offices with up to 25 users',
        category: 'core',
        pricingType: 'custom',
        basePrice: 0,
        pricingUnit: 'site',
        minQuantity: 1,
        documentKey: 'de-core-it-infrastructure-and-support-2026',
        tier: 'office',
        features: [
          ALERT_MONITORING_CLAIM_PHRASE,
          'Help desk support',
          'Patch management',
          'Asset inventory',
          'Basic reporting'
        ],
        isPopular: true
      },
      {
        id: 'core-it-business',
        name: 'Core IT Infrastructure & Support - Business',
        shortName: 'Core IT Business',
        description: 'Comprehensive IT management for growing businesses',
        category: 'core',
        pricingType: 'custom',
        basePrice: 0,
        pricingUnit: 'site',
        minQuantity: 1,
        documentKey: 'de-core-it-infrastructure-and-support-2026',
        tier: 'business',
        features: [
          'Everything in Office tier',
          'Priority support',
          'Quarterly business reviews',
          'Advanced reporting',
          'Dedicated account manager'
        ],
        isPopular: true
      },
      {
        id: 'core-it-enterprise',
        name: 'Core IT Infrastructure & Support - Enterprise',
        shortName: 'Core IT Enterprise',
        description: 'Enterprise-grade IT management with service levels set in your signed agreement',
        category: 'core',
        pricingType: 'custom',
        basePrice: 0,
        pricingUnit: 'site',
        minQuantity: 1,
        documentKey: 'de-core-it-infrastructure-and-support-2026',
        tier: 'enterprise',
        features: [
          'Everything in Business tier',
          'Service levels are set in your signed agreement',
          'On-site support included',
          'Executive reporting',
          'Strategic IT planning'
        ]
      }
    ]
  },
  {
    id: 'security',
    name: 'Security Operations',
    description: 'Cybersecurity and threat protection',
    icon: 'Shield',
    services: [
      {
        id: 'security-stack-office',
        name: 'Security Stack & Operations - Office',
        shortName: 'Security Office',
        description: 'Essential cybersecurity protection',
        category: 'security',
        pricingType: 'custom',
        basePrice: 0,
        pricingUnit: 'site',
        minQuantity: 1,
        documentKey: 'de-security-stack-and-operations-2026',
        tier: 'office',
        features: [
          'Endpoint protection (EDR)',
          'Email security',
          'Web filtering',
          'Security awareness training',
          'Basic threat monitoring'
        ]
      },
      {
        id: 'security-stack-business',
        name: 'Security Stack & Operations - Business',
        shortName: 'Security Business',
        description: 'Advanced security with ' + ALERT_MONITORING_CLAIM_PHRASE,
        category: 'security',
        pricingType: 'custom',
        basePrice: 0,
        pricingUnit: 'site',
        minQuantity: 1,
        documentKey: 'de-security-stack-and-operations-2026',
        tier: 'business',
        features: [
          'Everything in Office tier',
          ALERT_MONITORING_CLAIM_PHRASE,
          'SIEM integration',
          'Incident response',
          'Vulnerability scanning'
        ],
        isPopular: true
      },
      {
        id: 'security-stack-enterprise',
        name: 'Security Stack & Operations - Enterprise',
        shortName: 'Security Enterprise',
        description: 'Enterprise security with advanced threat hunting',
        category: 'security',
        pricingType: 'custom',
        basePrice: 0,
        pricingUnit: 'site',
        minQuantity: 1,
        documentKey: 'de-security-stack-and-operations-2026',
        tier: 'enterprise',
        features: [
          'Everything in Business tier',
          'Advanced threat hunting',
          'Penetration testing',
          'Compliance reporting',
          'Executive security briefings'
        ]
      }
    ]
  },
  {
    id: 'bcdr',
    name: 'Backup & Disaster Recovery',
    description: 'Business continuity and data protection',
    icon: 'Database',
    services: [
      {
        id: 'bcdr-office',
        name: 'Backup & Disaster Recovery - Office',
        shortName: 'BCDR Office',
        description: 'Essential backup and recovery',
        category: 'business_continuity',
        pricingType: 'custom',
        basePrice: 0,
        pricingUnit: 'site',
        minQuantity: 1,
        documentKey: 'de-backup-disaster-recovery-and-continuity-2026',
        tier: 'office',
        features: [
          'Cloud backup',
          'Daily backups',
          '30-day retention',
          'File-level recovery',
          'Basic DR planning'
        ]
      },
      {
        id: 'bcdr-business',
        name: 'Backup & Disaster Recovery - Business',
        shortName: 'BCDR Business',
        description: 'Advanced backup with rapid recovery',
        category: 'business_continuity',
        pricingType: 'custom',
        basePrice: 0,
        pricingUnit: 'site',
        minQuantity: 1,
        documentKey: 'de-backup-disaster-recovery-and-continuity-2026',
        tier: 'business',
        features: [
          'Everything in Office tier',
          'Hourly backups',
          '90-day retention',
          'Full system recovery',
          'DR testing quarterly'
        ],
        isPopular: true
      },
      {
        id: 'bcdr-enterprise',
        name: 'Backup & Disaster Recovery - Enterprise',
        shortName: 'BCDR Enterprise',
        description: 'Enterprise continuity with failover',
        category: 'business_continuity',
        pricingType: 'custom',
        basePrice: 0,
        pricingUnit: 'site',
        minQuantity: 1,
        documentKey: 'de-backup-disaster-recovery-and-continuity-2026',
        tier: 'enterprise',
        features: [
          'Everything in Business tier',
          'Real-time replication',
          '1-year retention',
          'Instant failover',
          'Monthly DR testing'
        ]
      }
    ]
  },
  {
    id: 'networking',
    name: 'Network Services',
    description: 'Network infrastructure and management',
    icon: 'Network',
    services: [
      {
        id: 'network-managed',
        name: 'Managed Network Services',
        shortName: 'Managed Network',
        description: 'Complete network management and monitoring',
        category: 'infrastructure',
        pricingType: 'per_site',
        basePrice: 500,
        pricingUnit: 'site',
        minQuantity: 1,
        documentKey: 'de-network-integration-and-advanced-networking-2026',
        features: [
          'Network alert monitoring, on plans that include it',
          'Configuration management',
          'Performance optimization',
          'Security policies',
          'Quarterly reviews'
        ]
      }
    ]
  },
  {
    id: 'ucaas',
    name: 'Communications',
    description: 'Unified communications and VoIP',
    icon: 'Phone',
    services: [
      {
        id: 'ucaas-basic',
        name: 'UCaaS VoIP - Basic',
        shortName: 'UCaaS Basic',
        description: 'Business phone system with essential features',
        category: 'communications',
        pricingType: 'per_user',
        basePrice: 25,
        pricingUnit: 'user',
        minQuantity: 5,
        documentKey: 'de-ucaas-voip-2026',
        features: [
          'HD voice calls',
          'Voicemail to email',
          'Mobile app',
          'Call forwarding',
          'Auto-attendant'
        ]
      },
      {
        id: 'ucaas-professional',
        name: 'UCaaS VoIP - Professional',
        shortName: 'UCaaS Professional',
        description: 'Full unified communications suite',
        category: 'communications',
        pricingType: 'per_user',
        basePrice: 45,
        pricingUnit: 'user',
        minQuantity: 5,
        documentKey: 'de-ucaas-voip-2026',
        features: [
          'Everything in Basic',
          'Video conferencing',
          'Team messaging',
          'CRM integration',
          'Advanced analytics'
        ],
        isPopular: true
      }
    ]
  },
  {
    id: 'compliance',
    name: 'Compliance & Assessments',
    description: 'Security assessments and compliance services',
    icon: 'ClipboardCheck',
    services: [
      {
        id: 'csra-assessment',
        name: 'Ultimate Cybersecurity Risk Assessment',
        shortName: 'CSRA',
        description: 'Comprehensive security posture evaluation',
        category: 'compliance',
        pricingType: 'flat',
        basePrice: CANONICAL_CSRA_ONE_TIME,
        pricingUnit: 'assessment',
        minQuantity: 1,
        documentKey: 'csra-ultimate-cybersecurity-risk-assessment',
        features: [
          'Vulnerability assessment',
          'Penetration testing',
          'Policy review',
          'Risk prioritization',
          'Remediation roadmap'
        ]
      },
      {
        id: 'compliance-services',
        name: 'Compliance Services',
        shortName: 'Compliance',
        description: 'Regulatory compliance management',
        category: 'compliance',
        pricingType: 'custom',
        basePrice: 1500,
        pricingUnit: 'month',
        minQuantity: 1,
        documentKey: 'compliance-services',
        features: [
          'Framework mapping',
          'Policy development',
          'Evidence collection',
          'Audit preparation',
          'Ongoing monitoring'
        ]
      }
    ]
  },
  {
    id: 'consulting',
    name: 'Consulting & vCIO',
    description: 'Strategic IT consulting',
    icon: 'Users',
    services: [
      {
        id: 'vcio-services',
        name: 'vCIO Services',
        shortName: 'vCIO',
        description: 'Virtual CIO strategic IT leadership',
        category: 'consulting',
        pricingType: 'per_site',
        basePrice: 500,
        pricingUnit: 'month',
        minQuantity: 1,
        documentKey: 'de-vcio-services-2026',
        features: [
          'IT strategy development',
          'Budget planning',
          'Vendor management',
          'Technology roadmap',
          'Executive reporting'
        ]
      }
    ]
  }
];

export const coreDocuments = [
  { key: 'nda', name: 'Non-Disclosure Agreement', required: true },
  { key: 'msa', name: 'Master Services Agreement', required: true },
  { key: 'order_form', name: 'Order Form', required: true },
  { key: 'invoice-terms-and-conditions-digerati-experts', name: 'Invoice Terms & Conditions', required: true }
];

export function getServiceById(id: string): ServiceItem | undefined {
  for (const category of serviceCatalog) {
    const service = category.services.find(s => s.id === id);
    if (service) return service;
  }
  return undefined;
}

export function getDocumentKeysForServices(serviceIds: string[]): string[] {
  const docKeys = new Set<string>();
  
  for (const serviceId of serviceIds) {
    const service = getServiceById(serviceId);
    if (service) {
      docKeys.add(service.documentKey);
    }
  }
  
  return Array.from(docKeys);
}
