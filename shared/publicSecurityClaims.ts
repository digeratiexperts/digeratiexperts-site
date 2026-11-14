/**
 * Public wording for alert monitoring. Change ALERT_MONITORING_CLAIM to
 * update every marketing use; ALERT_MONITORING_CLAIM_PHRASE follows it.
 */
export const ALERT_MONITORING_CLAIM =
  "Automated security alert monitoring, with alerts triaged by DE technicians during business hours, on plans that include it.";

/** The same wording without the closing period, for use inside a longer sentence. */
export const ALERT_MONITORING_CLAIM_PHRASE = ALERT_MONITORING_CLAIM.replace(/\.$/, "");

/** Optional, paid 24/7 MDR for IT, Office, Business, and Business GCC High. Never describe this as included in those plans. */
export const MDR_ADDON_CLAIM =
  "24/7 Managed Detection and Response, available as an add-on";

/** ProActive Enterprise and Enterprise GCC High include 24/7 MDR by default. Use only for those tiers. */
export const ENTERPRISE_MDR_PHRASE =
  "includes 24/7 human-led threat monitoring and response";

export const ENTERPRISE_MDR_CLAIM =
  "Includes 24/7 human-led threat monitoring and response";
