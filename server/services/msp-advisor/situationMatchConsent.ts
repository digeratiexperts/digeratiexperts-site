export type SituationMatchConsentRecord = {
  version: string;
  at: number;
  sessionId: string;
};

const records: SituationMatchConsentRecord[] = [];
const MAX_RECORDS = 1000;

/** Store the notice version and a server-set timestamp for a granted match consent. */
export function recordSituationMatchConsent(input: {
  version: string;
  sessionId: string;
}): SituationMatchConsentRecord {
  const record: SituationMatchConsentRecord = {
    version: input.version,
    at: Date.now(),
    sessionId: input.sessionId,
  };
  records.push(record);
  if (records.length > MAX_RECORDS) records.shift();
  return record;
}

export function situationMatchConsentFor(sessionId: string): SituationMatchConsentRecord | undefined {
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].sessionId === sessionId) return records[i];
  }
  return undefined;
}

/** Test helper */
export function _resetSituationMatchConsentForTests(): void {
  records.length = 0;
}
