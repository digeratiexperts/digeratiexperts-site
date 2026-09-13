/**
 * Persist consultative store answers + work email on the client.
 * Auth is started in the background from the email — never a login-page gate
 * in front of slides 2/3. Checkout still uses existing portal/store roles.
 */
import {
  DEFAULT_GUIDED_ANSWERS,
  buildGuidedRecommendation,
  type GuidedBuyingAnswers,
  type GuidedRecommendation,
} from "@/data/storeMerchandising";

export const STORE_GUIDED_SESSION_KEY = "de-store-guided-session";
export const STORE_BUYER_EMAIL_KEY = "userEmail";
export const STORE_FULL_CATALOG_PARAM = "catalog";
export const STORE_FULL_CATALOG_VALUE = "full";

export type StoreGuidedSession = {
  version: 1;
  answers: GuidedBuyingAnswers;
  completed: boolean;
  skipped: boolean;
  workEmail: string;
  authStarted: boolean;
};

export const EMPTY_GUIDED_SESSION: StoreGuidedSession = {
  version: 1,
  answers: DEFAULT_GUIDED_ANSWERS,
  completed: false,
  skipped: false,
  workEmail: "",
  authStarted: false,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isWorkEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function parseCatalogSearchParam(search: string | null | undefined): boolean {
  if (!search) return false;
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get(STORE_FULL_CATALOG_PARAM) === STORE_FULL_CATALOG_VALUE;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeAnswers(raw: Partial<GuidedBuyingAnswers> | undefined): GuidedBuyingAnswers {
  return {
    buyerType:
      raw?.buyerType === "existing_client" || raw?.buyerType === "in_house_it" || raw?.buyerType === "prospect"
        ? raw.buyerType
        : DEFAULT_GUIDED_ANSWERS.buyerType,
    objective:
      raw?.objective === "protect" ||
      raw?.objective === "operate" ||
      raw?.objective === "communicate" ||
      raw?.objective === "recover" ||
      raw?.objective === "compliance" ||
      raw?.objective === "specific"
        ? raw.objective
        : DEFAULT_GUIDED_ANSWERS.objective,
    companySize:
      raw?.companySize === "1-10" ||
      raw?.companySize === "11-49" ||
      raw?.companySize === "50-199" ||
      raw?.companySize === "200+"
        ? raw.companySize
        : DEFAULT_GUIDED_ANSWERS.companySize,
    locations:
      raw?.locations === "1" || raw?.locations === "2-5" || raw?.locations === "6+"
        ? raw.locations
        : DEFAULT_GUIDED_ANSWERS.locations,
    workEmail: typeof raw?.workEmail === "string" ? raw.workEmail.trim().toLowerCase() : "",
  };
}

export function readGuidedSession(): StoreGuidedSession | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORE_GUIDED_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoreGuidedSession>;
    if (parsed.version !== 1) return null;
    const answers = normalizeAnswers(parsed.answers);
    const workEmail = (parsed.workEmail || answers.workEmail || "").trim().toLowerCase();
    return {
      version: 1,
      answers: { ...answers, workEmail },
      completed: Boolean(parsed.completed),
      skipped: Boolean(parsed.skipped),
      workEmail,
      authStarted: Boolean(parsed.authStarted),
    };
  } catch {
    return null;
  }
}

export function writeGuidedSession(
  partial: Partial<Omit<StoreGuidedSession, "answers">> & { answers?: Partial<GuidedBuyingAnswers> },
): StoreGuidedSession {
  const current = readGuidedSession() ?? EMPTY_GUIDED_SESSION;
  const answers = normalizeAnswers({ ...current.answers, ...partial.answers });
  const workEmail = (partial.workEmail ?? answers.workEmail ?? current.workEmail).trim().toLowerCase();
  const next: StoreGuidedSession = {
    version: 1,
    answers: { ...answers, workEmail },
    completed: partial.completed ?? current.completed,
    skipped: partial.skipped ?? current.skipped,
    workEmail,
    authStarted: partial.authStarted ?? current.authStarted,
  };
  if (canUseStorage()) {
    window.localStorage.setItem(STORE_GUIDED_SESSION_KEY, JSON.stringify(next));
    if (isWorkEmail(workEmail)) {
      window.localStorage.setItem(STORE_BUYER_EMAIL_KEY, workEmail);
    }
  }
  return next;
}

export function markGuidedSkipped(): StoreGuidedSession {
  return writeGuidedSession({ skipped: true, completed: false });
}

export function markGuidedCompleted(answers: GuidedBuyingAnswers): StoreGuidedSession {
  return writeGuidedSession({
    answers,
    workEmail: answers.workEmail,
    completed: true,
    skipped: false,
  });
}

export function isGuidedFullCatalog(search?: string | null): boolean {
  if (parseCatalogSearchParam(search)) return true;
  return Boolean(readGuidedSession()?.skipped);
}

export function recommendationFromSession(): GuidedRecommendation | null {
  const session = readGuidedSession();
  if (!session?.completed || session.skipped) return null;
  return buildGuidedRecommendation(session.answers);
}

export type StoreBuyerAuthStart = {
  captured: boolean;
  sessionPresent: boolean;
  zohoConfigured: boolean;
};

/**
 * Capture work email and probe existing portal/store session.
 * Does not navigate, invent roles, or block the remaining slides.
 */
export async function startStoreBuyerAuth(email: string): Promise<StoreBuyerAuthStart> {
  const captured = isWorkEmail(email);
  if (captured) {
    writeGuidedSession({ workEmail: email, answers: { workEmail: email }, authStarted: true });
  }

  let sessionPresent = false;
  let zohoConfigured = false;

  if (typeof window === "undefined") {
    return { captured, sessionPresent, zohoConfigured };
  }

  try {
    const me = await fetch("/api/portal/me", {
      credentials: "include",
      cache: "no-store",
    });
    sessionPresent = me.ok;
  } catch {
    sessionPresent = false;
  }

  try {
    const status = await fetch("/api/portal/auth/zoho/status", { credentials: "include" });
    const data = (await status.json().catch(() => ({}))) as { configured?: boolean };
    zohoConfigured = Boolean(data?.configured);
  } catch {
    zohoConfigured = false;
  }

  return { captured, sessionPresent, zohoConfigured };
}
