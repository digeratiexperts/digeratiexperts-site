/**
 * Normalized phone data the portal's Cytracom Phone page renders in live mode
 * (GET /api/portal/phone). Vendor field names stay inside the adapter.
 */

export type PhoneExtension = {
  /** Extension description, usually the person's name. */
  name: string;
  /** Dialing code, e.g. "201". */
  extension: string;
  /** True when a user account is assigned to the extension. */
  assigned: boolean;
};

/**
 * Parts of the sample page this provider cannot fill. The page says so
 * instead of showing figures.
 */
export type PhoneGap = "phoneStatus" | "recentCalls" | "voicemail";

export type PhoneData = {
  provider: "cytracom";
  /** The company's extensions, sorted by extension number. */
  extensions: PhoneExtension[];
  /** The signed-in user's extension, matched by email; null when none matches. */
  myExtension: PhoneExtension | null;
  unavailable: PhoneGap[];
  /** ISO time the vendor was read. */
  fetchedAt: string;
};

/** The adapter's answer for one company. */
export type PhoneLoadResult = { notMapped: true } | { data: PhoneData };
