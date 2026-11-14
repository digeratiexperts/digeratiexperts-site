/**
 * Public wording for alert monitoring. Change ALERT_MONITORING_CLAIM to
 * update every marketing use; ALERT_MONITORING_CLAIM_PHRASE follows it.
 */
export const ALERT_MONITORING_CLAIM =
  "Automated security alert monitoring, with alerts triaged by DE technicians during business hours, on plans that include it.";

/** The same wording without the closing period, for use inside a longer sentence. */
export const ALERT_MONITORING_CLAIM_PHRASE = ALERT_MONITORING_CLAIM.replace(/\.$/, "");

/** Optional, paid 24/7 MDR. Never describe this as included in a base plan. */
export const MDR_ADDON_CLAIM =
  "24/7 Managed Detection and Response, available as an add-on";
