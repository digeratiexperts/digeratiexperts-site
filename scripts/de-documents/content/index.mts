// Every DE document the system builds, in resourceRegistry.v2.json order.
import type { Doc } from "../system/families.mts";
import { backupChecklist } from "./backup-bcdr-checklist.mts";
import { cyberRiskSample } from "./cyber-risk-assessment-sample.mts";
import { proactiveIt } from "./proactive-it.mts";
import { proactiveBusiness, proactiveEnterprise, proactiveOffice } from "./proactive-tiers.mts";
import { complianceReports, qbrSample } from "./reports.mts";
import { securityChecklist } from "./security-readiness-checklist.mts";
import { coManaged, ecosystemOverview, managedWorkplace, ucaas } from "./services.mts";

export const DOCUMENTS: Doc[] = [
  cyberRiskSample,
  securityChecklist,
  backupChecklist,
  ecosystemOverview,
  managedWorkplace,
  proactiveIt,
  proactiveOffice,
  proactiveBusiness,
  proactiveEnterprise,
  coManaged,
  ucaas,
  complianceReports,
  qbrSample,
];
