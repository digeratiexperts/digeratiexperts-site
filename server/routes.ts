import express, { type Express, type Request, type Response, NextFunction } from "express";
import { storage } from "./storage";
import { randomBytes, randomInt, createHash } from "crypto";
import rateLimit from "express-rate-limit";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";
import { zohoClient, zohoDeskService, splitVisitorName, zohoCRMService, zohoBillingService } from "./zoho";
import {
  parseZohoTicketId,
  validatePortalTicketUpload,
  PortalTicketUploadError,
} from "./portalTicketUploads";
import { PORTAL_TICKET_MAX_FILE_BYTES } from "@shared/portalTicketFileRules";
import { validatePortalOrderSelection } from "@shared/portalOrderCatalog";
import {
  clearZohoPkceCookie,
  createZohoStartPayload,
  exchangeZohoAuthCode,
  fetchZohoUserInfo,
  getZohoPortalConfig,
  isEmailAllowedForPortalOAuth,
  isMasterPortalEmail,
  portalLoginErrorRedirect,
  readZohoPkceCookie,
  marketplaceReturnTo,
  setZohoPkceCookie,
  verifyZohoOAuthState,
} from "./portalZohoAuth";
import { verifyTurnstile } from "./middleware/security";
import { eventBus, EventTypes } from "./eventBus";
import { notificationService } from "./services/notificationService";
import { logger } from "./logger";
import {
  initPortalAuthStore,
  getUser as portalAuthGetUser,
  hasUser as portalAuthHasUser,
  setUser as portalAuthSetUser,
  removeUserKeys as portalAuthRemoveUserKeys,
  listUniqueUsers as portalAuthListUsers,
  getClient as portalAuthGetClient,
  setClient as portalAuthSetClient,
  listClients as portalAuthListClients,
  createProspectClientForUser,
  saveOrderForm,
  updateUserOrgFields,
  ensureInternalMspClient,
} from "./portalAuthStore";
import { annotateTicketOrg, resolveTicketCreateTarget } from "./portalTicketCreate";
import {
  initPortalChatStore,
  conversationIdForUser,
  listMessages as listLiveChatMessages,
  appendMessage as appendLiveChatMessage,
  ensureWelcomeMessage,
  getChatStoreStatus,
} from "./portalChatStore";
import {
  initPortalSurveyStore,
  listSurveysForUser,
  getSurveyById,
  getUserResponseForSurvey,
  submitSurveyResponse,
  getSurveyStoreStatus,
} from "./portalSurveyStore";
import {
  initPortalOrg,
  canInitiateChat,
  canAccessApprovals,
  canManageOrg,
  orgPublicUser,
  listClientUsers,
  listDepartments,
  createDepartment,
  updateDepartment,
  findUserById,
  validateManagerApproverEmail,
  managerSummaryForUser,
  type OrgUserFields,
} from "./portalOrg";
import {
  initPortalApprovals,
  createApprovalRequest,
  listApprovalsForUser,
  getApprovalWithSteps,
  actOnApproval,
  attachFulfillmentTicket,
} from "./portalApprovalsStore";
import {
  initPortalLoginKnocks,
  recordLoginKnock,
  listLoginKnocks,
  summarizeLoginKnocks,
  clientIpFromReq,
  type KnockKind,
} from "./portalLoginKnocksStore";
import {
  initLifecycleOrchestrator,
  lifecycleIntegrationStatus,
  runLifecycle,
  listLifecycleEvents,
} from "./lifecycleOrchestrator";
import {
  buildLearningPayload,
  resolveLearningAudience,
  LEARNING_HUB_DOC_SLUGS,
  LEARNING_LESSONS,
} from "./portalLearningCatalog";
import {
  fetchHubCompanyDocuments,
  fetchHubCompanyOrders,
  fetchHubContractDownload,
  persistHubAccountId,
  resolvePortalCompanyName,
  resolvePortalHubAccountId,
} from "./integrations/techSalesClient";
import { registerDeSyncRoutes } from "./integrations/deSyncRoutes";
import { resolveJwtSecret } from "./config/authSecrets";
import { loginRateLimiter, formSubmissionRateLimiter, apiGeneralRateLimiter } from "./middleware/rateLimiter";
import { enqueueOutbox } from "./integrations/deSyncStore";
import { PRIMARY_PHONE } from "@shared/companyContact";

// Canonical JWT secret — resolved per call so dotenv/env load order cannot
// split signing and verification across different secrets (see config/authSecrets).
const jwtSecret = () => resolveJwtSecret();
const SALT_ROUNDS = 12;

/** HttpOnly JWT cookie — survives localStorage loss; shared across digeratexperts.com hosts. */
const PORTAL_AUTH_COOKIE = "portalAuth";

function portalCookieOptions(maxAgeMs = 24 * 60 * 60 * 1000) {
  const isProd = process.env.NODE_ENV === "production";
  const opts: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax";
    maxAge: number;
    path: string;
    domain?: string;
  } = {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: maxAgeMs,
    path: "/",
  };
  // Share session between digeratexperts.com and portal.digeratiexperts.com
  if (isProd) {
    opts.domain = ".digeratiexperts.com";
  }
  return opts;
}

function setPortalAuthCookie(res: Response, token: string, maxAgeMs?: number) {
  res.cookie(PORTAL_AUTH_COOKIE, token, portalCookieOptions(maxAgeMs));
}

function clearPortalAuthCookies(res: Response) {
  const opts = portalCookieOptions();
  res.clearCookie("sessionId", opts);
  res.clearCookie(PORTAL_AUTH_COOKIE, opts);
}

// Utility function for generating IDs
const randomId = () => randomBytes(16).toString('hex');

// HTML-escape user-supplied strings interpolated into server-rendered HTML
// (e.g. the order receipt). CSP allows inline scripts, so escaping is the guard.
const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Types
interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: any;
}

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  storeRole?: string;
  clientId?: string | null;
  orgRole?: string | null;
  departmentId?: string | null;
  managerUserId?: string | null;
  isCompanyItContact?: boolean;
  iat?: number;
  exp?: number;
}

// Session store for tracking active sessions with rotation (module-level for authMiddleware access)
export const sessionStore = new Map<string, { userId: string; createdAt: number; lastRotated: number }>();
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// ========== MIDDLEWARE ==========

// JWT-based auth: Authorization Bearer and/or httpOnly portalAuth cookie
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const bearer =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";
  const cookieToken =
    typeof req.cookies?.[PORTAL_AUTH_COOKIE] === "string"
      ? req.cookies[PORTAL_AUTH_COOKIE]
      : "";
  // Browser sessions are canonical across digeratiexperts.com + portal subdomains.
  // Prefer the shared HttpOnly cookie; Bearer remains a fallback for non-browser/API clients.
  const token = cookieToken || bearer;
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  try {
    const decoded = jwt.verify(token, jwtSecret()) as JWTPayload;
    const live = portalAuthGetUser(decoded.email) || (decoded.userId ? findUserById(decoded.userId) : null);
    // Fail closed: a validly-signed JWT for a user with no live record (deleted, never
    // indexed, or a store that has not finished loading) must be denied, not fall back to
    // trusting the token's embedded role/storeRole/clientId claims. See docs/MASTER-GUARDRAILS.md #7-8.
    if (!live) {
      return res.status(401).json({ error: "Account not found. Please log in again." });
    }
    if (
      (live as any).disabled ||
      (live as any).status === "disabled" ||
      (live as any).status === "revoked" ||
      (live as any).isActive === false
    ) {
      return res.status(401).json({ error: "Account disabled or revoked" });
    }

    // JWT proves the session; the live Portal record is authoritative for
    // authorization and tenancy on every request.
    const liveRole = live.role || "user";
    const isLiveAdmin = liveRole === "admin";

    req.user = {
      id: live.id,
      email: live.email,
      role: liveRole,
      storeRole:
        (live as any).storeRole ??
        (isLiveAdmin ? "admin" : "public"),
      clientId: live.clientId ?? null,
      orgRole:
        live.orgRole ??
        (isLiveAdmin ? "company_it_contact" : "staff"),
      departmentId: live.departmentId ?? null,
      managerUserId: live.managerUserId ?? null,
      isCompanyItContact:
        live.isCompanyItContact ?? isLiveAdmin,
      fullName: live.fullName,
      impersonatingCompanyId: isLiveAdmin
        ? (decoded as any).impersonatingCompanyId || null
        : null,
      impersonatingCompanyName: isLiveAdmin
        ? (decoded as any).impersonatingCompanyName || null
        : null,
    };
    req.userId = live.id;
    
    // Optional session validation from cookies
    const sessionId = req.cookies?.sessionId;
    if (sessionId) {
      const session = sessionStore.get(sessionId);
      if (session) {
        // Validate session belongs to same user and hasn't expired
        const now = Date.now();
        if (session.userId === decoded.userId && (now - session.createdAt) < SESSION_EXPIRY_MS) {
          // Session is valid, attach session info
          (req as any).sessionId = sessionId;
          (req as any).sessionValid = true;
        } else {
          // Session expired or user mismatch - remove stale session but allow JWT auth to proceed
          sessionStore.delete(sessionId);
          (req as any).sessionValid = false;
        }
      } else {
        // Session ID present but not found in store - allow JWT auth to proceed
        (req as any).sessionValid = false;
      }
    }
    
    next();
  } catch (e: any) {
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Token expired" });
    }
    res.status(401).json({ error: "Invalid token" });
  }
}

// Store role types for RBAC
export type StoreRole = 'public' | 'prospect' | 'managed' | 'comanaged' | 'admin';

// Role-based access control middleware for store routes
export function requireRole(...allowedRoles: StoreRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const userStoreRole = req.user.storeRole || 'public';
    if (!allowedRoles.includes(userStoreRole as StoreRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Middleware that requires admin role for portal admin routes
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function asOrgUser(req: AuthenticatedRequest): OrgUserFields {
  return {
    id: req.user?.id || req.userId || "",
    email: req.user?.email || "",
    fullName: req.user?.fullName || req.user?.email || "",
    role: req.user?.role || "user",
    orgRole: req.user?.orgRole || "staff",
    clientId: req.user?.clientId || null,
    departmentId: req.user?.departmentId || null,
    managerUserId: req.user?.managerUserId || null,
    isCompanyItContact: !!req.user?.isCompanyItContact,
  };
}

function requireChatAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Authentication required" });
  if (!canInitiateChat(asOrgUser(req))) {
    return res.status(403).json({
      error: "Live Chat is limited to your company's IT Contact. Submit a ticket or request instead.",
      code: "CHAT_IT_CONTACT_ONLY",
    });
  }
  next();
}

function requireApprovalsAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Authentication required" });
  // Staff may view their own submissions; mutating actions check assignee in store
  next();
}

function requireOrgManage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Authentication required" });
  if (!canManageOrg(asOrgUser(req))) {
    return res.status(403).json({ error: "Company IT Contact or DE admin required" });
  }
  next();
}

function buildPortalJwtClaims(user: any, storeRole: StoreRole) {
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    storeRole,
    clientId: user.clientId || null,
    orgRole: user.orgRole || (user.role === "admin" ? "company_it_contact" : "staff"),
    departmentId: user.departmentId || null,
    managerUserId: user.managerUserId || null,
    isCompanyItContact: !!user.isCompanyItContact || user.role === "admin",
  };
}

function publicPortalUser(user: any, storeRole: StoreRole) {
  const org = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    orgRole: user.orgRole || "staff",
    clientId: user.clientId || null,
    departmentId: user.departmentId || null,
    managerUserId: user.managerUserId || null,
    isCompanyItContact: !!user.isCompanyItContact,
  };
  return {
    username: user.username,
    storeRole,
    ...orgPublicUser(org),
  };
}

// Generate JWT token
function generateToken(userId: string, email: string, role: string = "user"): string {
  return jwt.sign({ userId, email, role }, jwtSecret(), { expiresIn: '24h' });
}

// Hash password securely
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Verify password
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Rate limiters
const chatRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: "Too many chat messages",
});

const leadQuoteRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  message: "Too many quote requests. Please try again later.",
});

const widgetTicketRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many support requests. Please try again later.",
});

const advisorChatRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many chat messages. Please try again shortly." },
});

// Widget polls every ~2.5s for portal agent replies — must NOT share the chat budget
// (20/15min would exhaust in ~50s and silently drop agent messages).
const advisorPollRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many poll requests. Please try again shortly." },
});

const advisorActionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again shortly." },
});

const speechRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many audio requests. Please wait a moment." },
});

// Input validation middleware
const validateInput = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Basic size check
  if (JSON.stringify(req.body).length > 1024 * 1024) {
    return res.status(413).json({ error: "Payload too large" });
  }
  next();
};

// Security event logger (+ durable login-door knocks for auth-related events)
const SECURITY_KNOCK_MAP: Record<string, KnockKind> = {
  PORTAL_LOGIN_FAILED: "login_failed",
  PORTAL_USER_LOGIN: "login_success",
  PORTAL_LOGIN_UNVERIFIED: "login_failed",
  MFA_VERIFICATION_FAILED: "mfa_failed",
  MFA_VERIFICATION_SUCCESS: "mfa_success",
  MFA_LOCKED_OUT: "locked_out",
  TURNSTILE_FAILED: "turnstile_failed",
};

const logSecurityEvent = (event: string, req: AuthenticatedRequest, data: any) => {
  console.log(`[SECURITY] ${event}`, { userId: req.user?.id, ...data });
  const kind = SECURITY_KNOCK_MAP[event];
  if (!kind) return;
  const email = data?.email || req.user?.email || null;
  void recordLoginKnock({
    kind,
    email,
    ip: clientIpFromReq(req),
    userAgent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
    path: req.originalUrl || req.url || null,
    meta: {
      event,
      method: data?.method,
      userId: data?.userId || req.user?.id,
      turnstileFailed: kind === "turnstile_failed",
    },
  });
};

// ========== ROUTES ==========

export async function registerRoutes(app: Express) {
  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);
  registerDeSyncRoutes(app, authMiddleware as any);

  // Live MSP threat feed (CISA / FIRST / NVD / MSRC). Never invents CVEs.
  app.get("/api/public/threats", async (req: Request, res: Response) => {
    try {
      const { getThreatFeed } = await import("./services/threat-intel/ingest");
      const scope = req.query.scope === "all" ? "all" : "homepage";
      const payload = await getThreatFeed(scope);
      const cacheControl =
        payload.status === "ok"
          ? "public, max-age=300, stale-while-revalidate=3600"
          : "public, max-age=60";
      res.setHeader("Cache-Control", cacheControl);
      res.json(payload);
    } catch (error: any) {
      console.error("public-threats error:", error);
      res.status(500).json({
        status: "empty",
        generatedAt: null,
        items: [],
        sources: {},
        attribution:
          "Sources: CISA, NIST NVD, FIRST, and Microsoft MSRC. Digerati prioritizes items based on active exploitation, exploit probability, and relevance to SMB environments.",
        message: "Unable to load the threat feed",
      });
    }
  });

  app.post("/api/internal/threats/refresh", async (req: Request, res: Response) => {
    const { isLocalRequest, refreshThreatFeed } = await import("./services/threat-intel/ingest");
    if (!isLocalRequest(req)) {
      return res.status(403).json({ error: "Refresh is limited to localhost" });
    }
    try {
      const feed = await refreshThreatFeed();
      res.json({
        ok: true,
        generatedAt: feed.generatedAt,
        count: feed.items.length,
        sources: feed.sources,
      });
    } catch (error: any) {
      res.status(502).json({ ok: false, error: error?.message || "Refresh failed" });
    }
  });

  // Public Google Business reviews (soft trust — never invents quotes)
  app.get("/api/google-reviews", async (_req: Request, res: Response) => {
    try {
      const { getGoogleReviews } = await import("./googleReviews");
      const payload = await getGoogleReviews();
      const cacheControl =
        payload.status === "ok" || payload.status === "empty"
          ? "public, max-age=300, stale-while-revalidate=3600"
          : "public, max-age=60";
      res.setHeader("Cache-Control", cacheControl);
      res.json(payload);
    } catch (error: any) {
      console.error("google-reviews error:", error);
      res.status(500).json({
        status: "error",
        configured: false,
        missing: [],
        message: "Unable to load Google reviews",
        placeIdMasked: null,
        placeName: null,
        rating: null,
        userRatingsTotal: null,
        reviews: [],
        mapsUri: null,
        fetchedAt: null,
      });
    }
  });

  // Multi-source reviews (live Google when available + curated catalog)
  app.get("/api/public/reviews", async (_req: Request, res: Response) => {
    try {
      const { getPublicReviews } = await import("./reviews");
      const payload = await getPublicReviews();
      const cacheControl =
        payload.status === "ok" || payload.status === "partial"
          ? "public, max-age=300, stale-while-revalidate=3600"
          : "public, max-age=60";
      res.setHeader("Cache-Control", cacheControl);
      res.json(payload);
    } catch (error: any) {
      console.error("public-reviews error:", error);
      res.status(500).json({
        status: "empty",
        message: "Unable to load reviews",
        sources: [],
        reviews: [],
        mapsUri: "https://maps.google.com/?cid=1710856351091471339",
        listingUrls: {
          google: "https://maps.google.com/?cid=1710856351091471339",
        },
        yelp: { status: "error" },
        google: {
          status: "error",
          configured: false,
          missing: [],
          message: "Unable to load Google reviews",
          placeIdMasked: null,
          placeName: null,
          rating: null,
          userRatingsTotal: null,
          reviews: [],
          mapsUri: null,
          fetchedAt: null,
        },
        fetchedAt: new Date().toISOString(),
      });
    }
  });

  // Durable portal auth (Neon) — Map-compatible shim for existing handlers
  await initPortalAuthStore();
  await initPortalOrg();
  await initPortalApprovals();
  await initPortalChatStore();
  try {
    const { initDeskChatStore } = await import("./services/msp-advisor");
    await initDeskChatStore();
  } catch (err: any) {
    console.warn("[msp-advisor] desk store init skipped:", err?.message || err);
  }
  await initPortalSurveyStore();
  await initPortalLoginKnocks();
  await initLifecycleOrchestrator();
  const portalUsers = {
    get: (key: string) => portalAuthGetUser(key),
    has: (key: string) => portalAuthHasUser(key),
    set: (_key: string, user: any) => {
      portalAuthSetUser(user);
      return portalUsers;
    },
    values: () => portalAuthListUsers(),
  };
  const portalClients = {
    get: (id: string) => portalAuthGetClient(id),
    set: (_id: string, client: any) => {
      portalAuthSetClient(client);
      return portalClients;
    },
    values: () => portalAuthListClients(),
  };
  
  // ===== AUTHENTICATION ROUTES =====
  
  // Register new user with hashed password
  app.post("/api/auth/register", formSubmissionRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { username, email, password, fullName } = req.body;
      
      if (!username || !email || !password) {
        return res.status(400).json({ error: "Username, email, and password are required" });
      }
      
      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: "Email already registered" });
      }
      
      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(409).json({ error: "Username already taken" });
      }

      // Hash password before storing
      const hashedPassword = await hashPassword(password);
      
      const user = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        fullName: fullName || null,
      });

      // Generate JWT token
      const token = generateToken(user.id, user.email || "", "user");
      
      // Don't return password in response
      const { password: _, ...safeUser } = user;
      
      res.json({ success: true, user: safeUser, token });
      logSecurityEvent("USER_REGISTERED", req, { userId: user.id });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // Login with password verification
  app.post("/api/auth/login", loginRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const isValidPassword = await verifyPassword(password, user.password);
      if (!isValidPassword) {
        logSecurityEvent("LOGIN_FAILED", req, { email });
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const token = generateToken(user.id, user.email || "", "user");
      
      // Don't return password in response
      const { password: _, ...safeUser } = user;
      
      res.json({ success: true, user: safeUser, token });
      logSecurityEvent("USER_LOGIN", req, { userId: user.id });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Get current user
  app.get("/api/auth/me", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.userId || "");
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password: _, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===== WORKSPACE ROUTES =====
  app.get("/api/workspaces", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaces = await storage.getWorkspacesByUserId(req.userId || "");
      res.json({ workspaces });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/workspaces", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, description } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      const workspace = await storage.createWorkspace({
        name,
        description: description || "",
        ownerId: req.userId || "",
        icon: "📦",
        color: "#D3126A",
      });

      res.json({ workspace });
      logSecurityEvent("WORKSPACE_CREATED", req, { workspaceId: workspace.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/workspaces/:id", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspace = await storage.getWorkspace(req.params.id);
      if (!workspace) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      res.json({ workspace });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===== PROJECT ROUTES =====
  app.get("/api/projects", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { workspaceId } = req.query;
      if (!workspaceId) {
        return res.status(400).json({ error: "workspaceId required" });
      }
      const projects = await storage.getProjectsByWorkspaceId(String(workspaceId));
      res.json({ projects });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, workspaceId, description } = req.body;
      if (!name || !workspaceId) {
        return res.status(400).json({ error: "Name and workspaceId required" });
      }

      const project = await storage.createProject({
        workspaceId,
        name,
        createdBy: req.userId || "",
        description: description || "",
        color: "#D3126A",
        isFavorite: false,
      });

      res.json({ project });
      logSecurityEvent("PROJECT_CREATED", req, { projectId: project.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===== BOARD ROUTES =====
  app.get("/api/boards", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { projectId } = req.query;
      if (!projectId) {
        return res.status(400).json({ error: "projectId required" });
      }
      const boards = await storage.getBoardsByProjectId(String(projectId));
      res.json({ boards });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/boards", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, projectId } = req.body;
      if (!name || !projectId) {
        return res.status(400).json({ error: "Name and projectId required" });
      }

      const board = await storage.createBoard({
        projectId,
        name,
        position: 0,
      });

      res.json({ board });
      logSecurityEvent("BOARD_CREATED", req, { boardId: board.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===== TASK ROUTES =====
  app.get("/api/tasks", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { boardId, projectId } = req.query;
      let tasks: any[] = [];
      
      if (boardId) {
        tasks = await storage.getTasksByBoardId(String(boardId));
      } else if (projectId) {
        tasks = await storage.getTasksByProjectId(String(projectId));
      }
      
      res.json({ tasks });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tasks", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { title, boardId, projectId, description } = req.body;
      if (!title || !projectId) {
        return res.status(400).json({ error: "Title and projectId required" });
      }

      const task = await storage.createTask({
        projectId,
        boardId: boardId || null,
        title,
        description: description || null,
        status: "todo",
        priority: "medium",
        position: 0,
        isArchived: false,
        createdBy: req.userId || "",
      });

      res.json({ task });
      logSecurityEvent("TASK_CREATED", req, { taskId: task.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/tasks/:id", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { title, status, priority, description } = req.body;
      const task = await storage.updateTask(req.params.id, {
        title,
        status,
        priority,
        description,
      });

      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      res.json({ task });
      logSecurityEvent("TASK_UPDATED", req, { taskId: task.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/tasks/:id", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      await storage.deleteTask(req.params.id);
      res.json({ success: true });
      logSecurityEvent("TASK_DELETED", req, { taskId: req.params.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===== LABEL ROUTES =====
  app.get("/api/labels", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { workspaceId } = req.query;
      if (!workspaceId) {
        return res.status(400).json({ error: "workspaceId required" });
      }
      const labels = await storage.getLabelsByWorkspaceId(String(workspaceId));
      res.json({ labels });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/labels", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, workspaceId, color } = req.body;
      if (!name || !workspaceId) {
        return res.status(400).json({ error: "Name and workspaceId required" });
      }

      const label = await storage.createLabel({
        workspaceId,
        name,
        color: color || "#D3126A",
      });

      res.json({ label });
      logSecurityEvent("LABEL_CREATED", req, { labelId: label.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===== COMMENT ROUTES =====
  app.get("/api/comments", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { taskId } = req.query;
      if (!taskId) {
        return res.status(400).json({ error: "taskId required" });
      }
      const comments = await storage.getCommentsByTaskId(String(taskId));
      res.json({ comments });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/comments", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { content, taskId } = req.body;
      if (!content || !taskId) {
        return res.status(400).json({ error: "Content and taskId required" });
      }

      const comment = await storage.createComment({
        taskId,
        userId: req.userId || "",
        content,
      });

      res.json({ comment });
      logSecurityEvent("COMMENT_CREATED", req, { commentId: comment.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/comments/:id", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      await storage.deleteComment(req.params.id);
      res.json({ success: true });
      logSecurityEvent("COMMENT_DELETED", req, { commentId: req.params.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===== CHAT ROUTES =====
  app.get("/api/chat", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { ticketId } = req.query;
      if (!ticketId) {
        return res.status(400).json({ error: "ticketId required" });
      }
      const messages = await storage.getChatMessagesByTicketId(String(ticketId));
      res.json({ messages });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/chat", [authMiddleware, chatRateLimiter, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { ticketId, content, isRead } = req.body;
      if (!ticketId || !content) {
        return res.status(400).json({ error: "ticketId and content required" });
      }

      const message = await storage.createChatMessage({
        ticketId,
        userId: req.userId || "",
        content,
        senderName: req.user?.fullName || "User",
        senderRole: "client",
        isRead: isRead || false,
      });

      res.json({ message });
      logSecurityEvent("CHAT_MESSAGE_SENT", req, { ticketId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===== PORTAL AI/INTEGRATION ROUTES =====
  app.get("/api/portal/jumpcloud/devices", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const mockDevices = [
        { id: "device-1", name: "DESKTOP-01", os: "Windows 10", status: "active" },
        { id: "device-2", name: "LAPTOP-01", os: "MacOS", status: "active" },
      ];
      res.json({ success: true, devices: mockDevices });
      logSecurityEvent("JUMPCLOUD_DEVICES_FETCHED", req, {});
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/portal/tickets/classify", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { title, description } = req.body;
      if (!title || !description) {
        return res.status(400).json({ error: "Title and description required" });
      }
      
      const { classifyTicket } = await import("./openaiService");
      const classification = await classifyTicket(title, description);
      
      res.json({
        success: true,
        classification: {
          category: classification.category,
          priority: classification.priority,
          tags: classification.suggestedTags,
        },
      });
      logSecurityEvent("TICKET_CLASSIFIED", req, {});
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/portal/chat/message", [authMiddleware, chatRateLimiter, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { message, conversationHistory = [] } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message required" });
      }
      
      const { generateChatResponse } = await import("./openaiService");
      const aiResponse = await generateChatResponse(message, conversationHistory);
      
      res.json({
        success: true,
        message: {
          id: randomId(),
          content: aiResponse,
          respondedBy: "ai",
          timestamp: new Date().toISOString(),
        },
      });
      logSecurityEvent("CHAT_MESSAGE_SENT", req, {});
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Live chat status — HTTP poll transport (WebSocket /api/ws is not used in production)
  app.get("/api/portal/chat/status", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const org = asOrgUser(req);
      const allowed = canInitiateChat(org);
      const store = getChatStoreStatus();
      const openaiConfigured = !!(
        process.env.OPENAI_API_KEY ||
        process.env.OPENAI_API ||
        (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY)
      );
      res.json({
        success: true,
        connected: allowed,
        allowed,
        transport: store.transport,
        durable: store.durable,
        assistantAvailable: openaiConfigured,
        supportHours: "Monday - Friday, 9 AM - 6 PM EST",
        message: allowed
          ? undefined
          : "Live Chat is limited to your Company or Department IT Contact. Submit a ticket, request, or infrastructure issue instead.",
      });
    } catch (error: any) {
      res.status(500).json({ success: false, connected: false, error: error.message });
    }
  });

  // Live chat — send message (persisted + AI support reply)
  app.post("/api/portal/chat/messages", [authMiddleware, requireChatAccess, chatRateLimiter, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const { content, senderName } = req.body;
      if (!content || typeof content !== "string" || !content.trim()) {
        return res.status(400).json({ error: "Message content required" });
      }

      const conversationId = conversationIdForUser(req.userId);
      await ensureWelcomeMessage(conversationId, req.userId);

      const displayName =
        (typeof senderName === "string" && senderName.trim()) ||
        req.user?.fullName ||
        req.user?.email ||
        "You";

      const message = await appendLiveChatMessage({
        conversationId,
        userId: req.userId,
        senderName: displayName,
        senderRole: "client",
        content: content.trim(),
      });

      let reply = null as Awaited<ReturnType<typeof appendLiveChatMessage>> | null;
      try {
        const history = await listLiveChatMessages(conversationId, { limit: 20 });
        const conversationHistory = history
          .filter((m) => m.id !== message.id)
          .map((m) => ({
            role: (m.senderRole === "client" ? "user" : "assistant") as "user" | "assistant",
            content: m.content,
          }));
        const { generateChatResponse } = await import("./openaiService");
        const aiText = await generateChatResponse(content.trim(), conversationHistory);
        if (aiText) {
          reply = await appendLiveChatMessage({
            conversationId,
            userId: req.userId!,
            senderName: "DE Support",
            senderRole: "support",
            content: aiText,
          });
        }
      } catch (aiErr: any) {
        console.warn("[live-chat] AI reply failed:", aiErr?.message || aiErr);
      }

      res.json({
        success: true,
        message,
        reply,
        conversationId,
      });
      logSecurityEvent("LIVE_CHAT_MESSAGE", req, { conversationId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Live chat — history / poll (optional ?since=ISO for incremental updates)
  app.get("/api/portal/chat/messages", [authMiddleware, requireChatAccess], async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const conversationId = conversationIdForUser(req.userId);
      await ensureWelcomeMessage(conversationId, req.userId);
      const since = typeof req.query.since === "string" ? req.query.since : undefined;
      const messages = await listLiveChatMessages(conversationId, { since, limit: 200 });

      res.json({
        success: true,
        connected: true,
        conversationId,
        messages,
        transport: "http-poll",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message, connected: false });
    }
  });

  // DE Desk (public site advisor) conversations visible in portal
  app.get("/api/portal/desk-chats", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { listDeskSessions, getDeskStoreStatus } = await import("./services/msp-advisor");
      const isAdmin = req.user?.role === "admin";
      const email = req.user?.email;
      const sessions = await listDeskSessions({
        email: isAdmin ? undefined : email,
        limit: isAdmin ? 100 : 50,
      });
      // Non-admin: only sessions linked to their email (listDeskSessions already filtered)
      res.json({
        success: true,
        sessions,
        durable: getDeskStoreStatus().durable,
        scope: isAdmin ? "all" : "email",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to load DE Desk chats" });
    }
  });

  app.get("/api/portal/desk-chats/:sessionId", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { getDeskSessionMessages } = await import("./services/msp-advisor");
      const { session, messages } = await getDeskSessionMessages(req.params.sessionId);
      if (!session) return res.status(404).json({ error: "Conversation not found" });
      const isAdmin = req.user?.role === "admin";
      const userEmail = (req.user?.email || "").toLowerCase();
      if (!isAdmin && session.email && session.email.toLowerCase() !== userEmail) {
        return res.status(403).json({ error: "Not allowed to view this conversation" });
      }
      if (!isAdmin && !session.email) {
        return res.status(403).json({ error: "Conversation is not linked to an account email yet" });
      }
      res.json({ success: true, session, messages });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to load conversation" });
    }
  });

  // Portal agent reply → appears in the public website DE Desk widget
  app.post("/api/portal/desk-chats/:sessionId/reply", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        getDeskSessionMessages,
        appendDeskMessage,
        claimDeskSession,
      } = await import("./services/msp-advisor");
      const sessionId = req.params.sessionId;
      const content = String(req.body?.content || "").trim();
      if (!content) return res.status(400).json({ error: "content is required" });
      if (content.length > 8000) return res.status(400).json({ error: "Message too long" });

      const { session } = await getDeskSessionMessages(sessionId);
      if (!session) return res.status(404).json({ error: "Conversation not found" });

      const isAdmin = req.user?.role === "admin";
      const userEmail = (req.user?.email || "").toLowerCase();
      if (!isAdmin && session.email && session.email.toLowerCase() !== userEmail) {
        return res.status(403).json({ error: "Not allowed to reply to this conversation" });
      }
      if (!isAdmin && !session.email) {
        return res.status(403).json({ error: "Conversation is not linked to an account email yet" });
      }

      const agentName =
        String(req.body?.senderName || req.user?.fullName || req.user?.email || "DE Agent")
          .trim()
          .slice(0, 120) || "DE Agent";

      await claimDeskSession(sessionId, agentName);
      const message = await appendDeskMessage({
        sessionId,
        role: "agent",
        content,
        senderName: agentName,
      });

      res.json({ success: true, message, agentLive: true, agentName });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to send reply" });
    }
  });

  app.post("/api/portal/desk-chats/:sessionId/claim", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { getDeskSessionMessages, claimDeskSession } = await import("./services/msp-advisor");
      const { session } = await getDeskSessionMessages(req.params.sessionId);
      if (!session) return res.status(404).json({ error: "Conversation not found" });
      const isAdmin = req.user?.role === "admin";
      const userEmail = (req.user?.email || "").toLowerCase();
      if (!isAdmin && session.email && session.email.toLowerCase() !== userEmail) {
        return res.status(403).json({ error: "Not allowed" });
      }
      if (!isAdmin && !session.email) {
        return res.status(403).json({ error: "Conversation is not linked to an account email yet" });
      }
      const agentName =
        String(req.body?.senderName || req.user?.fullName || req.user?.email || "DE Agent")
          .trim()
          .slice(0, 120) || "DE Agent";
      const updated = await claimDeskSession(req.params.sessionId, agentName);
      res.json({ success: true, session: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to claim conversation" });
    }
  });

  app.post("/api/portal/desk-chats/:sessionId/release", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { getDeskSessionMessages, releaseDeskSession } = await import("./services/msp-advisor");
      const { session } = await getDeskSessionMessages(req.params.sessionId);
      if (!session) return res.status(404).json({ error: "Conversation not found" });
      const isAdmin = req.user?.role === "admin";
      const userEmail = (req.user?.email || "").toLowerCase();
      if (!isAdmin && session.email && session.email.toLowerCase() !== userEmail) {
        return res.status(403).json({ error: "Not allowed" });
      }
      const updated = await releaseDeskSession(req.params.sessionId);
      res.json({ success: true, session: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to release conversation" });
    }
  });

  // ----- Portal org / multi-role -----
  app.get("/api/portal/me", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const live = portalAuthGetUser(req.user!.email) || findUserById(req.userId!);
      if (!live) return res.status(404).json({ error: "User not found" });
      let storeRole: StoreRole = ((live as any).storeRole as StoreRole) || "prospect";
      if (live.role === "admin") storeRole = "admin";
      const user = publicPortalUser(live, storeRole);
      const mgr = managerSummaryForUser(live as OrgUserFields);
      res.json({
        success: true,
        user: {
          ...user,
          managerUserId: mgr.managerUserId,
          manager: mgr.manager,
          companyDomains: mgr.companyDomains,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/portal/org/people", [authMiddleware, requireOrgManage], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clientId = req.user!.clientId;
      if (!clientId && req.user!.role !== "admin") {
        return res.status(400).json({ error: "No client associated" });
      }
      const targetClient = (req.query.clientId as string) || clientId;
      if (!targetClient) return res.status(400).json({ error: "clientId required" });
      if (req.user!.role !== "admin" && targetClient !== clientId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const people = listClientUsers(targetClient).map((u) => orgPublicUser(u));
      const departments = await listDepartments(targetClient);
      res.json({ success: true, people, departments });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/portal/org/people/:userId", [authMiddleware, requireOrgManage, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const target = findUserById(req.params.userId);
      if (!target) return res.status(404).json({ error: "User not found" });
      if (req.user!.role !== "admin" && target.clientId !== req.user!.clientId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { orgRole, departmentId, managerUserId, isCompanyItContact, fullName } = req.body || {};
      if (managerUserId) {
        const mgr = findUserById(managerUserId);
        if (!mgr || mgr.clientId !== target.clientId) {
          return res.status(400).json({ error: "Manager must be in the same company" });
        }
        if (managerUserId === target.id) {
          return res.status(400).json({ error: "User cannot be their own manager" });
        }
      }
      const updated = updateUserOrgFields(target.id, {
        orgRole,
        departmentId: departmentId === undefined ? undefined : departmentId || null,
        managerUserId: managerUserId === undefined ? undefined : managerUserId || null,
        isCompanyItContact,
        fullName,
      });
      res.json({ success: true, user: orgPublicUser(updated as OrgUserFields) });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/portal/org/departments", [authMiddleware, requireOrgManage, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clientId = req.user!.clientId;
      if (!clientId && req.user!.role !== "admin") {
        return res.status(400).json({ error: "No client associated" });
      }
      const targetClient = req.body.clientId || clientId;
      if (!targetClient) return res.status(400).json({ error: "clientId required" });
      if (req.user!.role !== "admin" && targetClient !== clientId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const name = String(req.body.name || "").trim();
      if (!name) return res.status(400).json({ error: "Department name required" });
      const dept = await createDepartment(targetClient, name, req.body.itContactUserId || null);
      res.status(201).json({ success: true, department: dept });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/portal/org/departments/:id", [authMiddleware, requireOrgManage, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clientId = req.user!.clientId;
      if (!clientId && req.user!.role !== "admin") {
        return res.status(400).json({ error: "No client associated" });
      }
      const targetClient = req.body.clientId || clientId;
      if (!targetClient) return res.status(400).json({ error: "clientId required" });
      const dept = await updateDepartment(req.params.id, targetClient, {
        name: req.body.name,
        itContactUserId: req.body.itContactUserId,
      });
      if (!dept) return res.status(404).json({ error: "Department not found" });
      res.json({ success: true, department: dept });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ----- Approvals -----
  app.get("/api/portal/approvals", [authMiddleware, requireApprovalsAccess], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const scope = (req.query.scope as "mine" | "team" | "company") || "mine";
      const org = asOrgUser(req);
      if (scope !== "mine" && !canAccessApprovals(org) && org.role !== "admin") {
        return res.status(403).json({ error: "Approvals queue requires manager or IT Contact role" });
      }
      const items = await listApprovalsForUser(org, scope);
      res.json({ success: true, approvals: items });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/portal/approvals/:id", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const bundle = await getApprovalWithSteps(req.params.id);
      if (!bundle) return res.status(404).json({ error: "Not found" });
      const org = asOrgUser(req);
      if (org.role !== "admin" && bundle.request.clientId !== org.clientId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const isParty =
        bundle.request.requesterUserId === org.id ||
        bundle.steps.some((s: any) => s.approverUserId === org.id) ||
        canAccessApprovals(org) ||
        org.role === "admin";
      if (!isParty) return res.status(403).json({ error: "Forbidden" });
      const requester = findUserById(bundle.request.requesterUserId);
      res.json({
        success: true,
        approval: {
          ...bundle.request,
          requesterName: requester?.fullName,
          steps: bundle.steps.map((s: any) => ({
            ...s,
            approverName: s.approverUserId ? findUserById(s.approverUserId)?.fullName : null,
          })),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/portal/approvals", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const org = asOrgUser(req);
      if (!org.clientId) {
        return res.status(400).json({ error: "No client account associated with this user." });
      }
      const { type, title, description, priority, amountCents, payload } = req.body || {};
      if (!type || !title || !description) {
        return res.status(400).json({ error: "type, title, and description are required" });
      }

      const fields =
        payload && typeof payload === "object" && (payload as any).fields && typeof (payload as any).fields === "object"
          ? ((payload as any).fields as Record<string, unknown>)
          : {};
      const managerEmailRaw =
        (typeof fields.managerEmail === "string" && fields.managerEmail) ||
        (typeof fields.approverEmail === "string" && fields.approverEmail) ||
        (typeof (payload as any)?.managerEmail === "string" && (payload as any).managerEmail) ||
        "";
      const managerEmail = String(managerEmailRaw || "").trim();
      const accessLevel = String(fields.accessLevel || "");
      const privileged =
        /admin|privileged/i.test(accessLevel) ||
        /privileged|admin/i.test(String(fields.resourceType || ""));

      if (managerEmail) {
        const check = validateManagerApproverEmail({ requester: org, managerEmail });
        if (!check.ok) {
          return res.status(400).json({ error: check.error, companyDomains: check.domains });
        }
      } else if (privileged && !org.managerUserId) {
        return res.status(400).json({
          error:
            "Admin / privileged requests need a manager on your profile (People & Org) and their company-domain email in Manager / approver email.",
        });
      }

      const created = await createApprovalRequest({
        clientId: org.clientId,
        requester: org,
        type: String(type),
        title: String(title),
        description: String(description),
        priority: priority || "medium",
        amountCents: typeof amountCents === "number" ? amountCents : null,
        payload: payload && typeof payload === "object" ? payload : {},
      });
      res.status(201).json({ success: true, ...created });
      logSecurityEvent("APPROVAL_CREATED", req, { requestId: created.request.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  async function fulfillApprovedRequest(requestId: string, req: AuthenticatedRequest) {
    const bundle = await getApprovalWithSteps(requestId);
    if (!bundle || bundle.request.status !== "approved") return null;
    if (bundle.request.fulfillmentTicketId) return bundle.request.fulfillmentTicketId;

    const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const ticket = await storage.createPortalTicket({
      clientId: bundle.request.clientId,
      createdBy: bundle.request.requesterUserId,
      ticketNumber,
      subject: `[Approved] ${bundle.request.title}`,
      description:
        `${bundle.request.description}\n\n---\nApproved via portal workflow ${bundle.request.requestNumber}.\nType: ${bundle.request.type}\n` +
        `Payload: ${JSON.stringify(bundle.request.payload || {}, null, 2)}`,
      status: "open",
      priority: bundle.request.priority || "medium",
      category: bundle.request.type || "Access & Security",
    });
    await attachFulfillmentTicket(requestId, ticket.id);

    try {
      const { zohoDeskService } = await import("./zoho/zohoDesk");
      const { zohoClient } = await import("./zoho/zohoClient");
      if (zohoClient.isConfigured()) {
        const requester = findUserById(bundle.request.requesterUserId);
        await zohoDeskService.createTicket({
          subject: `[Approved] ${bundle.request.title}`,
          description: bundle.request.description,
          email: requester?.email,
          priority: bundle.request.priority === "critical" || bundle.request.priority === "high" ? "High" : "Medium",
        });
      }
    } catch (e: any) {
      console.warn("[approvals] Zoho sync failed:", e?.message);
    }
    return ticket.id;
  }

  app.post("/api/portal/approvals/:id/approve", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await actOnApproval({
        requestId: req.params.id,
        actor: asOrgUser(req),
        action: "approve",
        note: req.body?.note,
      });
      let fulfillmentTicketId: string | null = null;
      if (result.finalized && !result.rejected) {
        fulfillmentTicketId = await fulfillApprovedRequest(req.params.id, req);
      }
      const client = req.user?.clientId ? portalClients.get(req.user.clientId) : undefined;
      void enqueueOutbox({
        eventType: "approval.submitted",
        source: "portal",
        destination: "hub",
        entityType: "approval",
        entityId: req.params.id,
        canonicalAccountId: client?.hubAccountId || null,
        payload: { action: "approve", note: req.body?.note || null, finalized: !!result.finalized },
      });
      res.json({ success: true, ...result, fulfillmentTicketId });
    } catch (error: any) {
      const status = /Forbidden|not the current/i.test(error.message) ? 403 : 400;
      res.status(status).json({ error: error.message });
    }
  });

  app.post("/api/portal/approvals/:id/reject", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await actOnApproval({
        requestId: req.params.id,
        actor: asOrgUser(req),
        action: "reject",
        note: req.body?.note,
      });
      const client = req.user?.clientId ? portalClients.get(req.user.clientId) : undefined;
      void enqueueOutbox({
        eventType: "approval.submitted",
        source: "portal",
        destination: "hub",
        entityType: "approval",
        entityId: req.params.id,
        canonicalAccountId: client?.hubAccountId || null,
        payload: { action: "reject", note: req.body?.note || null },
      });
      res.json({ success: true, ...result });
    } catch (error: any) {
      const status = /Forbidden|not the current/i.test(error.message) ? 403 : 400;
      res.status(status).json({ error: error.message });
    }
  });

  app.post("/api/portal/approvals/:id/request-info", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await actOnApproval({
        requestId: req.params.id,
        actor: asOrgUser(req),
        action: "request-info",
        note: req.body?.note,
      });
      res.json({ success: true, ...result });
    } catch (error: any) {
      const status = /Forbidden|not the current/i.test(error.message) ? 403 : 400;
      res.status(status).json({ error: error.message });
    }
  });

  app.get("/api/portal/questionnaires/events", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const mockEvents = [
        { id: "1", type: "deployment", title: "Q4 Security Update", date: new Date(), status: "scheduled" },
      ];
      res.json({ success: true, events: mockEvents });
      logSecurityEvent("QUESTIONNAIRES_FETCHED", req, {});
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===== PORTAL SURVEYS (first-party CSAT / onboarding / awareness) =====
  app.get("/api/portal/surveys", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const surveys = await listSurveysForUser(req.userId);
      const store = getSurveyStoreStatus();
      res.json({
        success: true,
        surveys,
        durable: store.durable,
        pendingCount: surveys.filter((s) => s.status === "pending").length,
        completedCount: surveys.filter((s) => s.status === "completed").length,
      });
      logSecurityEvent("SURVEYS_LISTED", req, { count: surveys.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/portal/surveys/:id", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const survey = await getSurveyById(req.params.id);
      if (!survey) {
        return res.status(404).json({ error: "Survey not found" });
      }
      const response = await getUserResponseForSurvey(req.userId, survey.id);
      res.json({
        success: true,
        survey,
        status: response ? "completed" : "pending",
        response: response
          ? {
              id: response.id,
              answers: response.answers,
              rating: response.rating,
              submittedAt: response.submittedAt,
            }
          : null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/portal/surveys/:id/responses", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const answers = req.body?.answers;
      if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
        return res.status(400).json({ error: "answers object is required" });
      }

      const response = await submitSurveyResponse({
        surveyId: req.params.id,
        userId: req.userId,
        clientId: req.user?.clientId || null,
        answers,
      });

      res.json({
        success: true,
        response: {
          id: response.id,
          surveyId: response.surveyId,
          rating: response.rating,
          submittedAt: response.submittedAt,
        },
      });
      logSecurityEvent("SURVEY_SUBMITTED", req, { surveyId: req.params.id });
    } catch (error: any) {
      const message = error?.message || "Failed to submit survey";
      const status =
        message === "Survey not found"
          ? 404
          : message === "Survey already completed"
            ? 409
            : message.startsWith("Missing") ||
                message.startsWith("Select") ||
                message.startsWith("Rating") ||
                message.startsWith("Invalid")
              ? 400
              : 500;
      res.status(status).json({ error: message });
    }
  });

  // ===== ADMIN OPENAI CONTROL =====
  app.get("/api/portal/admin/openai/status", [authMiddleware, requireAdmin], async (req: AuthenticatedRequest, res: Response) => {
    try {
      res.json({
        success: true,
        enabled: process.env.ENABLE_OPENAI_INTEGRATION === "true",
        status: "configured",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/portal/admin/openai/toggle", [authMiddleware, requireAdmin, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const currentState = process.env.ENABLE_OPENAI_INTEGRATION === "true";
      res.json({
        success: true,
        enabled: !currentState,
        message: "OpenAI integration toggled",
      });
      logSecurityEvent("OPENAI_TOGGLED", req, { state: !currentState });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===== TTS (blog listen / read-aloud) — public with rate limit =====
  app.post("/api/tts", [speechRateLimiter], async (req: Request, res: Response) => {
    try {
      const { text, voice } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "text is required" });
      }
      const { generateSpeech } = await import("./openaiService");
      const mp3 = await generateSpeech(text, voice || "nova");
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader(
        "Cache-Control",
        "public, max-age=86400, s-maxage=604800, immutable",
      );
      res.send(mp3);
    } catch (error: any) {
      console.error("TTS error:", error);
      const msg = error.message || "Failed to generate audio";
      if (/429|quota|exceeded|rate.limit|billing/i.test(msg)) {
        return res.status(429).json({
          error: "Audio quota exceeded. Check your OpenAI billing details.",
        });
      }
      res.status(500).json({ error: msg });
    }
  });

  // ===== PORTAL TICKET ROUTES =====
  // Get all tickets for user (admins see all local tickets)
  app.get("/api/portal/tickets", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const isAdmin = req.user?.role === "admin";
      const tickets = await storage.getPortalTickets(isAdmin ? undefined : req.userId || "");
      res.json({
        tickets: tickets.map(t => {
          const org = annotateTicketOrg(t, (id) => portalClients.get(id));
          return {
            id: t.id,
            ticketNumber: t.ticketNumber || `#TK${String(t.id).padStart(3, '0')}`,
            subject: t.subject,
            description: t.description,
            status: t.status,
            priority: t.priority,
            category: t.category || "General",
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
            clientId: t.clientId || null,
            companyName: org.companyName,
            isInternal: org.isInternal,
          };
        }),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create new ticket
  app.post("/api/portal/tickets", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { subject, description, priority, category, clientId: requestedClientId } = req.body;
      
      if (!subject || !description) {
        return res.status(400).json({ error: "Subject and description are required" });
      }

      const userId = req.userId || "";
      const userEmail = req.user?.email || "";
      const liveUser = userEmail ? portalUsers.get(userEmail) : undefined;

      const target = resolveTicketCreateTarget({
        actor: {
          role: req.user?.role || liveUser?.role || "user",
          clientId: req.user?.clientId || liveUser?.clientId || null,
          impersonatingCompanyId: req.user?.impersonatingCompanyId || null,
          impersonatingCompanyName: req.user?.impersonatingCompanyName || null,
        },
        requestedClientId: typeof requestedClientId === "string" ? requestedClientId : null,
        getClient: (id) => portalClients.get(id),
        listClients: () => Array.from(portalClients.values()),
        ensureInternalClient: () => ensureInternalMspClient(),
      });
      if (!target.ok) {
        return res.status(target.status).json({ error: target.error });
      }
      const resolvedClientId = target.clientId;

      // Generate ticket number
      const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

      // Map priority to Zoho-compatible values
      const priorityMap: Record<string, string> = {
        low: "Low",
        medium: "Medium",
        high: "High",
        critical: "High",
      };

      // Create ticket in local database
      const ticket = await storage.createPortalTicket({
        clientId: resolvedClientId,
        createdBy: userId,
        ticketNumber,
        subject,
        description,
        status: "open",
        priority: priority || "medium",
        category: category || "general",
      });

      // Sync to Zoho Desk (non-blocking — local ticket succeeds regardless)
      let zohoTicketId: string | null = null;
      try {
        const { zohoDeskService } = await import("./zoho/zohoDesk");
        const { zohoClient } = await import("./zoho/zohoClient");
        
        if (zohoClient.isConfigured()) {
          // Look up or reference the contact in Zoho Desk by email
          let contactId: string | undefined;
          try {
            const contact = await zohoDeskService.getContactByEmail(userEmail);
            if (contact) {
              contactId = contact.id;
            }
          } catch (contactErr) {
            console.warn("Could not look up Zoho Desk contact:", contactErr);
          }

          const zohoTicket = await zohoDeskService.createTicket({
            subject,
            description,
            contactId,
            email: contactId ? undefined : userEmail,
            priority: priorityMap[priority] || "Medium",
          });
          zohoTicketId = zohoTicket.id;
          console.log(`✅ Ticket ${ticketNumber} synced to Zoho Desk: ${zohoTicket.id}`);

          // Store the Zoho ticket ID on the local ticket for reference
          try {
            await storage.updatePortalTicket(ticket.id, { assignedTo: `zoho:${zohoTicket.id}` });
          } catch {}
        }
      } catch (zohoError: any) {
        console.warn("Could not sync ticket to Zoho Desk:", zohoError?.message || zohoError);
      }

      res.status(201).json({
        success: true,
        ticket: {
          ...ticket,
          companyName: target.companyName,
          isInternal: target.isInternal,
        },
        zohoTicketId,
      });
      logSecurityEvent("TICKET_CREATED", req, {
        ticketId: ticket.id,
        ticketNumber,
        zohoTicketId,
        clientId: resolvedClientId,
        isInternal: target.isInternal,
      });
    } catch (error: any) {
      console.error("Ticket creation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Attach a file after ticket create. Zoho Desk create-ticket is JSON-only;
  // attachments go to POST /tickets/{id}/attachments (multipart) once the ticket exists.
  app.post(
    "/api/portal/tickets/:id/attachments",
    authMiddleware,
    express.raw({ type: "*/*", limit: PORTAL_TICKET_MAX_FILE_BYTES }),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const ticket = await storage.getPortalTicket(req.params.id);
        if (!ticket) {
          return res.status(404).json({ error: "Ticket not found" });
        }

        const isAdmin = req.user?.role === "admin";
        const userClientId = req.user?.clientId;
        if (!isAdmin && ticket.clientId !== userClientId) {
          return res.status(403).json({ error: "Access denied" });
        }

        const rawName = req.headers["x-filename"];
        const headerName = Array.isArray(rawName) ? rawName[0] : rawName;
        let filename = "attachment";
        try {
          filename = decodeURIComponent(String(headerName || "attachment"));
        } catch {
          filename = String(headerName || "attachment");
        }

        const body = req.body;
        const buffer = Buffer.isBuffer(body)
          ? body
          : Buffer.from(body || [], typeof body === "string" ? "binary" : undefined);

        const validated = validatePortalTicketUpload({
          filename,
          buffer,
          declaredMime: req.headers["content-type"],
        });

        const zohoTicketId = parseZohoTicketId(ticket.assignedTo);
        if (!zohoTicketId || !zohoClient.isConfigured()) {
          return res.status(503).json({
            error:
              "Ticket was created, but file upload needs Zoho Desk sync. Email support with your ticket ID and attach the file there.",
          });
        }

        await zohoDeskService.uploadTicketAttachment(zohoTicketId, {
          filename: validated.filename,
          contentType: validated.contentType,
          buffer,
        });

        logSecurityEvent("TICKET_ATTACHMENT_UPLOADED", req, {
          ticketId: ticket.id,
          filename: validated.filename,
          bytes: buffer.length,
        });
        res.json({ success: true, filename: validated.filename });
      } catch (error: any) {
        if (error instanceof PortalTicketUploadError) {
          return res.status(error.status).json({ error: error.message });
        }
        console.error("Ticket attachment error:", error?.response?.data || error?.message || error);
        res.status(502).json({ error: "Could not attach the file to the support ticket." });
      }
    },
  );

  // Get single ticket by ID
  app.get("/api/portal/tickets/:id", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const ticket = await storage.getPortalTicket(id);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const isAdmin = req.user?.role === "admin";
      const userClientId = req.user?.clientId;
      if (!isAdmin && ticket.clientId !== userClientId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const comments = await storage.getPortalTicketComments(id);
      // Never expose internal support notes to non-admin clients
      const visibleComments = isAdmin
        ? comments
        : comments.filter((c) => !c.isInternal);

      const org = annotateTicketOrg(ticket, (id) => portalClients.get(id));
      res.json({
        ticket: {
          ...ticket,
          ticketNumber: ticket.ticketNumber || `#TK${String(ticket.id).padStart(3, '0')}`,
          companyName: org.companyName,
          isInternal: org.isInternal,
          comments: visibleComments.map(c => ({
            id: c.id,
            author: c.userId === req.userId ? "You" : "Support",
            role: isAdmin && c.isInternal ? "Support Engineer" : (c.userId === req.userId ? "Client" : "Support"),
            content: c.content,
            timestamp: c.createdAt,
            ...(isAdmin ? { isInternal: !!c.isInternal } : {}),
          })),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to retrieve ticket" });
    }
  });

  app.post("/api/portal/tickets/:id/comments", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }

      const ticket = await storage.getPortalTicket(id);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const isAdmin = req.user?.role === "admin";
      const userClientId = req.user?.clientId;
      if (!isAdmin && ticket.clientId !== userClientId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const comment = await storage.createPortalTicketComment({
        id: randomId(),
        ticketId: id,
        content,
        authorId: req.userId || "",
        authorName: req.user?.fullName || "Client",
        isInternal: false,
        createdAt: new Date(),
      });

      const zohoTicketId = parseZohoTicketId(ticket.assignedTo);
      if (zohoTicketId && zohoClient.isConfigured()) {
        const author = req.user?.fullName || req.user?.email || "Client";
        void zohoDeskService.addTicketComment(
          zohoTicketId,
          `${author}:\n${String(content).slice(0, 8000)}`,
        );
      }

      res.json({ success: true, comment });
      logSecurityEvent("TICKET_COMMENT_ADDED", req, { ticketId: id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===== PORTAL AUTHENTICATION =====
  // Note: portalUsers / portalClients are durable via portalAuthStore (initialized above)
  // sessionStore is module-level for authMiddleware access
  
  // Email verification tokens storage
  const emailVerificationTokens = new Map<string, { 
    email: string; 
    userId: string; 
    createdAt: number;
    expiresAt: number;
  }>();

  // Password reset tokens storage
  const passwordResetTokens = new Map<string, {
    email: string;
    userId: string;
    createdAt: number;
    expiresAt: number;
  }>();

  // MFA pending challenges — stores temporary MFA session tokens during login
  const mfaChallenges = new Map<string, {
    userId: string;
    email: string;
    method: 'totp' | 'email';
    emailCode?: string;
    createdAt: number;
    expiresAt: number;
    attempts: number;
  }>();
  const MFA_MAX_ATTEMPTS = 5;

  // MFA TOTP setup — temporary storage while user confirms setup
  const mfaPendingSetups = new Map<string, {
    userId: string;
    secret: string;
    createdAt: number;
  }>();

  // Portal Register Endpoint — creates prospect client + durable user
  app.post("/api/portal/register", [formSubmissionRateLimiter, verifyTurnstile, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email, username, password, companyName, fullName } = req.body;

      if (!email || !username || !password) {
        return res.status(400).json({ message: "Email, username, and password are required" });
      }

      // Check if user already exists
      if (portalUsers.has(email) || portalUsers.has(username)) {
        return res.status(400).json({ message: "Email or username already exists" });
      }

      // Validate password strength
      if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
        return res.status(400).json({ 
          message: "Password must be at least 8 characters with 1 uppercase letter and 1 number" 
        });
      }

      // Hash password with bcrypt
      const bcryptMod = await import('bcrypt');
      const hashedPassword = await bcryptMod.hash(password, 12);
      
      const newUser = {
        id: randomId(),
        email,
        username,
        password: hashedPassword,
        role: "user",
        storeRole: "prospect" as StoreRole,
        fullName: fullName || username,
        emailVerified: false,
        isActive: true,
        clientId: null as string | null,
        createdAt: new Date(),
      };

      portalUsers.set(email, newUser);
      await createProspectClientForUser(newUser, companyName);
      // Reload after client link
      const saved = portalUsers.get(email) || newUser;

      // Generate email verification token
      const verificationToken = randomId();
      const now = Date.now();
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      
      emailVerificationTokens.set(verificationToken, {
        email: saved.email,
        userId: saved.id,
        createdAt: now,
        expiresAt: now + TWENTY_FOUR_HOURS,
      });

      // Send email verification
      const baseUrl = process.env.APP_URL || "https://digeratiexperts.com";
      const verificationLink = `${baseUrl}/api/portal/verify-email?token=${verificationToken}`;
      notificationService.sendEmailVerification({
        email: saved.email,
        name: saved.fullName,
        verificationLink,
      }).catch(err => logger.warn("Failed to send verification email", err));

      logSecurityEvent("PORTAL_USER_REGISTERED", req, {
        userId: saved.id,
        email,
        clientId: saved.clientId,
        storeRole: saved.storeRole,
        emailVerified: false,
      });

      return res.json({
        success: true,
        message: "Account created successfully. Please check your email to verify your account.",
        requiresVerification: true,
        user: {
          id: saved.id,
          email: saved.email,
          username: saved.username,
          fullName: saved.fullName,
          role: saved.role,
          storeRole: saved.storeRole || "prospect",
          clientId: saved.clientId || null,
          emailVerified: false,
        },
      });
    } catch (error: any) {
      console.error("[ERROR] Portal registration failed:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Email Verification Endpoint
  app.get("/api/portal/verify-email", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.redirect('/portal/login?error=invalid_token&message=Invalid verification link');
      }

      // Check if token exists
      const tokenData = emailVerificationTokens.get(token);
      if (!tokenData) {
        return res.redirect('/portal/login?error=invalid_token&message=Verification link is invalid or has already been used');
      }

      // Check if token has expired
      if (Date.now() > tokenData.expiresAt) {
        emailVerificationTokens.delete(token);
        return res.redirect('/portal/login?error=expired_token&message=Verification link has expired. Please request a new one.');
      }

      // Find and update user
      const user = portalUsers.get(tokenData.email);
      if (!user) {
        emailVerificationTokens.delete(token);
        return res.redirect('/portal/login?error=user_not_found&message=User not found');
      }

      // Mark user as verified
      user.emailVerified = true;
      portalUsers.set(tokenData.email, user);
      if (user.username) {
        portalUsers.set(user.username, user);
      }

      // Clear the token
      emailVerificationTokens.delete(token);

      logSecurityEvent("EMAIL_VERIFIED", req, { userId: user.id, email: tokenData.email });

      // Redirect to portal login with success message
      return res.redirect('/portal/login?verified=true&message=Email verified successfully! You can now log in.');
    } catch (error: any) {
      console.error("[ERROR] Email verification failed:", error);
      return res.redirect('/portal/login?error=verification_failed&message=Email verification failed');
    }
  });

  // Resend Verification Email Endpoint
  app.post("/api/portal/resend-verification", [validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Find user by email
      const user = portalUsers.get(email);
      if (!user) {
        // Don't reveal whether user exists for security
        return res.json({ 
          success: true, 
          message: "If an account exists with this email, a new verification link has been sent." 
        });
      }

      // Check if already verified
      if (user.emailVerified) {
        return res.status(400).json({ message: "Email is already verified" });
      }

      // Delete any existing tokens for this user
      Array.from(emailVerificationTokens.entries()).forEach(([token, data]) => {
        if (data.email === email) {
          emailVerificationTokens.delete(token);
        }
      });

      // Generate new verification token
      const verificationToken = randomId();
      const now = Date.now();
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      
      emailVerificationTokens.set(verificationToken, {
        email: user.email,
        userId: user.id,
        createdAt: now,
        expiresAt: now + TWENTY_FOUR_HOURS,
      });

      // Send verification email
      const baseUrl = process.env.APP_URL || "https://digeratiexperts.com";
      const verificationLink = `${baseUrl}/api/portal/verify-email?token=${verificationToken}`;
      notificationService.sendEmailVerification({
        email: user.email,
        name: user.fullName,
        verificationLink,
      }).catch(err => logger.warn("Failed to resend verification email", err));

      logSecurityEvent("VERIFICATION_EMAIL_RESENT", req, { email });

      return res.json({
        success: true,
        message: "If an account exists with this email, a new verification link has been sent.",
      });
    } catch (error: any) {
      console.error("[ERROR] Resend verification failed:", error);
      res.status(500).json({ message: "Failed to resend verification email" });
    }
  });

  // Forgot Password — request reset link
  app.post("/api/portal/forgot-password", [formSubmissionRateLimiter, verifyTurnstile, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });

      const SAFE_RESPONSE = { success: true, message: "If an account exists with this email, a password reset link has been sent." };

      const user = portalUsers.get(email);
      if (!user) return res.json(SAFE_RESPONSE);

      // Invalidate any existing reset tokens for this user
      Array.from(passwordResetTokens.entries()).forEach(([tok, data]) => {
        if (data.email === email) passwordResetTokens.delete(tok);
      });

      const resetToken = randomId();
      const ONE_HOUR = 60 * 60 * 1000;
      const now = Date.now();
      passwordResetTokens.set(resetToken, { email, userId: user.id, createdAt: now, expiresAt: now + ONE_HOUR });

      const baseUrl = process.env.APP_URL || "https://digeratiexperts.com";
      const resetLink = `${baseUrl}/portal/reset-password?token=${resetToken}`;
      notificationService.sendPasswordReset({ email: user.email, name: user.fullName, resetLink })
        .catch(err => logger.warn("Failed to send password reset email", err));

      logSecurityEvent("PASSWORD_RESET_REQUESTED", req, { email });
      return res.json(SAFE_RESPONSE);
    } catch (error: any) {
      logger.error("Forgot password failed", error);
      return res.status(500).json({ message: "Request failed" });
    }
  });

  // Reset Password — submit new password using token
  app.post("/api/portal/reset-password", [formSubmissionRateLimiter, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) return res.status(400).json({ message: "Token and new password are required" });

      const tokenData = passwordResetTokens.get(token);
      if (!tokenData || Date.now() > tokenData.expiresAt) {
        return res.status(400).json({ message: "Reset link is invalid or has expired. Please request a new one." });
      }

      if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
        return res.status(400).json({ message: "Password must be at least 8 characters with 1 uppercase letter and 1 number" });
      }

      const user = portalUsers.get(tokenData.email);
      if (!user) return res.status(400).json({ message: "Account not found" });

      const bcrypt = await import('bcrypt');
      user.password = await bcrypt.hash(password, 12);
      portalUsers.set(tokenData.email, user);
      passwordResetTokens.delete(token);

      logSecurityEvent("PASSWORD_RESET_COMPLETED", req, { email: tokenData.email });
      return res.json({ success: true, message: "Password updated successfully. You can now log in." });
    } catch (error: any) {
      logger.error("Reset password failed", error);
      return res.status(500).json({ message: "Password reset failed" });
    }
  });

  // Portal Login Endpoint
  // Helper: complete login and return token + session
  function completeLogin(user: any, req: AuthenticatedRequest, res: Response) {
    const sessionId = randomId();
    const now = Date.now();
    sessionStore.set(sessionId, { userId: user.id, createdAt: now, lastRotated: now });

    let storeRole: StoreRole = 'prospect';
    if (user.storeRole) {
      storeRole = user.storeRole as StoreRole;
    } else if (user.role === 'admin') {
      storeRole = 'admin';
    } else if (user.clientId) {
      const client = portalClients.get(user.clientId);
      if (client?.serviceType === 'managed') storeRole = 'managed';
      else if (client?.serviceType === 'comanaged') storeRole = 'comanaged';
    }

    const token = jwt.sign(buildPortalJwtClaims(user, storeRole), jwtSecret(), { expiresIn: "24h" });

    res.cookie("sessionId", sessionId, portalCookieOptions());
    setPortalAuthCookie(res, token);

    logSecurityEvent("PORTAL_USER_LOGIN", req, { userId: user.id, email: user.email, role: user.role, storeRole, sessionId });

    return res.json({
      success: true,
      token,
      sessionId,
      user: publicPortalUser(user, storeRole),
    });
  }

  function completeLoginRedirect(user: any, req: AuthenticatedRequest, res: Response, returnTo: string) {
    const sessionId = randomId();
    const now = Date.now();
    sessionStore.set(sessionId, { userId: user.id, createdAt: now, lastRotated: now });

    let storeRole: StoreRole = "prospect";
    if (user.storeRole) {
      storeRole = user.storeRole as StoreRole;
    } else if (user.role === "admin") {
      storeRole = "admin";
    } else if (user.clientId) {
      const client = portalClients.get(user.clientId);
      if (client?.serviceType === "managed") storeRole = "managed";
      else if (client?.serviceType === "comanaged") storeRole = "comanaged";
    }

    const token = jwt.sign(buildPortalJwtClaims(user, storeRole), jwtSecret(), { expiresIn: "24h" });

    res.cookie("sessionId", sessionId, portalCookieOptions());
    setPortalAuthCookie(res, token);

    logSecurityEvent("PORTAL_USER_LOGIN", req, {
      userId: user.id,
      email: user.email,
      role: user.role,
      storeRole,
      sessionId,
      method: "zoho_sso",
    });

    const params = new URLSearchParams({
      zoho_sso: "1",
      token,
      returnTo: marketplaceReturnTo(returnTo),
    });
    return res.redirect(`/portal/login?${params.toString()}`);
  }

  async function resolveOrProvisionZohoPortalUser(
    profile: { email: string; fullName: string },
    req: AuthenticatedRequest,
  ) {
    const email = profile.email.trim().toLowerCase();
    let user = portalUsers.get(email);

    if (!user) {
      if (!isEmailAllowedForPortalOAuth(email)) {
        return null;
      }
      const isMaster = isMasterPortalEmail(email);
      const usernameBase = email.split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 24) || "zoho";
      let username = usernameBase;
      let n = 1;
      while (portalUsers.has(username)) {
        username = `${usernameBase}${n++}`;
      }
      const password = await bcrypt.hash(randomBytes(32).toString("hex"), SALT_ROUNDS);
      user = {
        id: randomId(),
        email,
        username,
        password,
        role: isMaster ? "admin" : "user",
        storeRole: isMaster ? "admin" : "prospect",
        fullName: profile.fullName || username,
        clientId: null,
        emailVerified: true,
        isActive: true,
      };
      portalUsers.set(email, user);
      if (!isMaster) {
        await createProspectClientForUser(user);
      } else {
        portalUsers.set(username, user);
      }
      logSecurityEvent("PORTAL_USER_PROVISIONED_ZOHO", req, {
        email,
        role: user.role,
      });
    } else if (isMasterPortalEmail(email) && user.role !== "admin") {
      user.role = "admin";
      user.storeRole = "admin";
      portalUsers.set(email, user);
      if (user.username) portalUsers.set(user.username, user);
    }

    return user;
  }

  async function handlePortalZohoCallback(req: AuthenticatedRequest, res: Response) {
    const cfg = getZohoPortalConfig();
    if (!cfg.configured) {
      return res.redirect(portalLoginErrorRedirect("zoho_not_configured", "Zoho sign-in is not configured"));
    }

    const err = typeof req.query.error === "string" ? req.query.error : "";
    if (err) {
      clearZohoPkceCookie(res);
      return res.redirect(portalLoginErrorRedirect("zoho_denied", err));
    }

    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const verified = state ? verifyZohoOAuthState(state) : null;
    const codeVerifier = readZohoPkceCookie(req);
    clearZohoPkceCookie(res);

    if (!code || !verified || !codeVerifier) {
      return res.redirect(portalLoginErrorRedirect("zoho_invalid_state", "Zoho sign-in session expired. Please try again."));
    }

    try {
      const tokens = await exchangeZohoAuthCode({ code, codeVerifier });
      const profile = await fetchZohoUserInfo(tokens.accessToken);

      if (!isEmailAllowedForPortalOAuth(profile.email) && !portalUsers.get(profile.email)) {
        return res.redirect(
          portalLoginErrorRedirect(
            "zoho_not_allowed",
            "This Zoho account is not authorized for the Client Portal.",
          ),
        );
      }

      const user = await resolveOrProvisionZohoPortalUser(profile, req);
      if (!user) {
        return res.redirect(
          portalLoginErrorRedirect(
            "zoho_not_allowed",
            "This Zoho account is not authorized for the Client Portal.",
          ),
        );
      }

      if (user.isActive === false) {
        return res.redirect(portalLoginErrorRedirect("zoho_disabled", "This portal account is disabled."));
      }

      return completeLoginRedirect(user, req, res, verified.returnTo);
    } catch (error: any) {
      console.error("[ERROR] Portal Zoho SSO failed:", error?.message || error);
      return res.redirect(portalLoginErrorRedirect("zoho_failed", "Zoho sign-in failed. Please try again."));
    }
  }

  // Zoho Public Platform SSO for Client Portal (not Hub)
  app.get("/api/portal/auth/zoho/status", (_req: AuthenticatedRequest, res: Response) => {
    const cfg = getZohoPortalConfig();
    return res.json({
      configured: cfg.configured,
      provider: "zoho",
      // Public-safe hint only — never expose client secret
      redirectConfigured: Boolean(cfg.redirectUri),
    });
  });

  app.get("/api/portal/auth/zoho/start", (req: AuthenticatedRequest, res: Response) => {
    const cfg = getZohoPortalConfig();
    if (!cfg.configured) {
      void recordLoginKnock({
        kind: "zoho_failed",
        ip: clientIpFromReq(req),
        userAgent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
        path: "/api/portal/auth/zoho/start",
        meta: { reason: "not_configured" },
      });
      return res.redirect(portalLoginErrorRedirect("zoho_not_configured", "Zoho sign-in is not configured"));
    }
    void recordLoginKnock({
      kind: "zoho_start",
      ip: clientIpFromReq(req),
      userAgent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
      path: "/api/portal/auth/zoho/start",
    });
    const returnTo = marketplaceReturnTo(req.query.returnTo);
    const { authorizeUrl, codeVerifier } = createZohoStartPayload(returnTo);
    setZohoPkceCookie(res, codeVerifier);
    return res.redirect(authorizeUrl);
  });

  /** Public beacon: login page loaded (door knock). Rate-limited lightly via no auth. */
  app.post("/api/portal/login-knocks/ping", apiGeneralRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
    try {
      await recordLoginKnock({
        kind: "page_hit",
        ip: clientIpFromReq(req),
        userAgent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
        path: typeof req.body?.path === "string" ? req.body.path : "/portal/login",
        meta: { source: "login_page_beacon" },
      });
      return res.json({ ok: true });
    } catch {
      return res.json({ ok: true });
    }
  });

  app.get("/api/portal/admin/login-knocks", [authMiddleware, requireAdmin], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sinceHours = Math.min(Number(req.query.hours) || 24, 168);
      const [summary, knocks] = await Promise.all([
        summarizeLoginKnocks(sinceHours),
        listLoginKnocks({ limit: 200, sinceHours }),
      ]);
      return res.json({ summary, knocks });
    } catch (error: any) {
      console.error("[ERROR] login-knocks list:", error);
      return res.status(500).json({ message: "Failed to load login knocks" });
    }
  });

  app.get("/api/portal/admin/lifecycle/status", [authMiddleware, requireAdmin], async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const status = await lifecycleIntegrationStatus();
      const events = await listLifecycleEvents(40);
      return res.json({ status, events });
    } catch (error: any) {
      console.error("[ERROR] lifecycle status:", error);
      return res.status(500).json({ message: "Failed to load lifecycle status" });
    }
  });

  app.post("/api/portal/admin/lifecycle/onboard", [authMiddleware, requireAdmin, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email, companyName, firstName, lastName } = req.body || {};
      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "email is required" });
      }
      const event = await runLifecycle({
        action: "onboard",
        email,
        companyName,
        firstName,
        lastName,
        requestedBy: req.user?.email || null,
      });
      return res.json({ success: event.success, event });
    } catch (error: any) {
      console.error("[ERROR] lifecycle onboard:", error);
      return res.status(500).json({ message: "Onboard failed" });
    }
  });

  app.post("/api/portal/admin/lifecycle/offboard", [authMiddleware, requireAdmin, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email, companyName, deleteJumpCloudUser } = req.body || {};
      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "email is required" });
      }
      const event = await runLifecycle({
        action: "offboard",
        email,
        companyName,
        deleteJumpCloudUser: !!deleteJumpCloudUser,
        requestedBy: req.user?.email || null,
      });
      return res.json({ success: event.success, event });
    } catch (error: any) {
      console.error("[ERROR] lifecycle offboard:", error);
      return res.status(500).json({ message: "Offboard failed" });
    }
  });

  app.get("/api/portal/auth/zoho/callback", handlePortalZohoCallback);
  // Alias for VPS ZOHO_PORTAL_OIDC_REDIRECT_URI / Zoho console registration
  app.get("/api/zoho/oauth/callback", handlePortalZohoCallback);

  app.post("/api/portal/login", [loginRateLimiter, verifyTurnstile, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = portalUsers.get(email);

      if (!user) {
        logSecurityEvent("PORTAL_LOGIN_FAILED", req, { email });
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const bcrypt = await import('bcrypt');
      const passwordValid = await bcrypt.compare(password, user.password);
      
      if (!passwordValid) {
        logSecurityEvent("PORTAL_LOGIN_FAILED", req, { email });
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (user.role !== 'admin' && user.emailVerified === false) {
        logSecurityEvent("PORTAL_LOGIN_UNVERIFIED", req, { email });
        return res.status(403).json({ 
          message: "Please verify your email before logging in. Check your inbox for the verification link.",
          code: "EMAIL_NOT_VERIFIED",
          email: user.email
        });
      }

      // Check if user has MFA enabled
      if (user.mfaEnabled && user.mfaMethod) {
        const challengeToken = randomId();
        const TEN_MINUTES = 10 * 60 * 1000;
        const now = Date.now();

        if (user.mfaMethod === 'email') {
          const code = String(randomInt(100000, 1000000));
          mfaChallenges.set(challengeToken, {
            userId: user.id,
            email: user.email,
            method: 'email',
            emailCode: code,
            createdAt: now,
            expiresAt: now + TEN_MINUTES,
            attempts: 0,
          });
          notificationService.sendMfaCode({
            email: user.email,
            name: user.fullName,
            code,
          }).catch(err => logger.warn("Failed to send MFA email code", err));
        } else {
          mfaChallenges.set(challengeToken, {
            userId: user.id,
            email: user.email,
            method: 'totp',
            createdAt: now,
            expiresAt: now + TEN_MINUTES,
            attempts: 0,
          });
        }

        logSecurityEvent("MFA_CHALLENGE_ISSUED", req, { email, method: user.mfaMethod });

        return res.json({
          success: false,
          mfaRequired: true,
          mfaMethod: user.mfaMethod,
          mfaToken: challengeToken,
          message: user.mfaMethod === 'email'
            ? "A verification code has been sent to your email."
            : "Enter the code from your authenticator app.",
        });
      }

      return completeLogin(user, req, res);
    } catch (error: any) {
      console.error("[ERROR] Portal login failed:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // MFA Verify — complete login after providing MFA code
  app.post("/api/portal/mfa/verify-login", [loginRateLimiter, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { mfaToken, code } = req.body;
      if (!mfaToken || !code) {
        return res.status(400).json({ message: "MFA token and code are required" });
      }

      const challenge = mfaChallenges.get(mfaToken);
      if (!challenge || Date.now() > challenge.expiresAt) {
        mfaChallenges.delete(mfaToken);
        return res.status(400).json({ message: "MFA session expired. Please log in again." });
      }

      if (challenge.attempts >= MFA_MAX_ATTEMPTS) {
        mfaChallenges.delete(mfaToken);
        logSecurityEvent("MFA_LOCKED_OUT", req, { email: challenge.email });
        return res.status(429).json({ message: "Too many attempts. Please log in again." });
      }

      challenge.attempts++;

      const user = portalUsers.get(challenge.email);
      if (!user) {
        mfaChallenges.delete(mfaToken);
        return res.status(400).json({ message: "User not found" });
      }

      let verified = false;

      if (challenge.method === 'email') {
        verified = challenge.emailCode === code.trim();
      } else if (challenge.method === 'totp' && user.mfaTotpSecret) {
        const otplib = await import('otplib');
        const auth = (otplib as any).authenticator || (otplib as any).default?.authenticator || otplib;
        verified = auth.verify({ token: code.trim(), secret: user.mfaTotpSecret });
      }

      const backupCodes = (user as any).mfaBackupCodes || [];
      if (!verified && backupCodes.length > 0) {
        const codeUpper = code.trim().toUpperCase();
        const idx = backupCodes.indexOf(codeUpper);
        if (idx !== -1) {
          verified = true;
          backupCodes.splice(idx, 1);
          (user as any).mfaBackupCodes = backupCodes;
          portalUsers.set(user.email, user);
          if (user.username) portalUsers.set(user.username, user);
        }
      }

      if (!verified) {
        logSecurityEvent("MFA_VERIFICATION_FAILED", req, { email: challenge.email, method: challenge.method, attempt: challenge.attempts });
        const remaining = MFA_MAX_ATTEMPTS - challenge.attempts;
        return res.status(401).json({ message: `Invalid verification code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` });
      }

      mfaChallenges.delete(mfaToken);
      logSecurityEvent("MFA_VERIFICATION_SUCCESS", req, { email: challenge.email, method: challenge.method });

      return completeLogin(user, req, res);
    } catch (error: any) {
      console.error("[ERROR] MFA verify failed:", error);
      return res.status(500).json({ message: "Verification failed" });
    }
  });

  // Portal Logout Endpoint - Clears session + portalAuth cookies
  app.post("/api/portal/logout", [validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sessionId = req.cookies?.sessionId;
      
      if (sessionId) {
        // Remove session from session store
        sessionStore.delete(sessionId);
        logSecurityEvent("SESSION_TERMINATED", req, { sessionId });
      }

      clearPortalAuthCookies(res);

      logSecurityEvent("PORTAL_USER_LOGOUT", req, { userId: req.user?.id || "unknown" });

      return res.json({ success: true, message: "Logged out successfully" });
    } catch (error: any) {
      console.error("[ERROR] Portal logout failed:", error);
      res.status(500).json({ message: "Logout failed" });
    }
  });

  // ===== MFA SETUP & MANAGEMENT =====

  // Get MFA status for the authenticated user
  app.get("/api/portal/mfa/status", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = portalUsers.get(req.user?.email || "");
      if (!user) return res.status(404).json({ message: "User not found" });

      return res.json({
        mfaEnabled: !!user.mfaEnabled,
        mfaMethod: user.mfaMethod || null,
        backupCodesRemaining: user.mfaBackupCodes?.length || 0,
      });
    } catch (error: any) {
      logger.error("Failed to get MFA status", error);
      return res.status(500).json({ message: "Failed to get MFA status" });
    }
  });

  // Begin MFA setup — generates TOTP secret + QR or triggers email flow
  app.post("/api/portal/mfa/setup", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { method } = req.body; // 'totp' or 'email'
      if (!method || !['totp', 'email'].includes(method)) {
        return res.status(400).json({ message: "Method must be 'totp' or 'email'" });
      }

      const user = portalUsers.get(req.user?.email || "");
      if (!user) return res.status(404).json({ message: "User not found" });

      if (user.mfaEnabled) {
        return res.status(400).json({ message: "MFA is already enabled. Disable it first to change methods." });
      }

      if (method === 'totp') {
        const otplib = await import('otplib');
        const auth = (otplib as any).authenticator || (otplib as any).default?.authenticator || otplib;
        const QRCode = await import('qrcode');
        const secret = auth.generateSecret();
        const otpauthUrl = auth.keyuri(user.email, 'Digerati Experts', secret);
        const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

        const setupToken = randomId();
        mfaPendingSetups.set(setupToken, { userId: user.id, secret, createdAt: Date.now() });

        return res.json({
          method: 'totp',
          setupToken,
          qrCode: qrCodeDataUrl,
          secret,
          message: "Scan the QR code with your authenticator app, then confirm with a code.",
        });
      } else {
        const code = String(randomInt(100000, 1000000));
        const setupToken = randomId();
        mfaPendingSetups.set(setupToken, { userId: user.id, secret: code, createdAt: Date.now() });

        notificationService.sendMfaCode({
          email: user.email,
          name: user.fullName,
          code,
        }).catch(err => logger.warn("Failed to send MFA setup code", err));

        return res.json({
          method: 'email',
          setupToken,
          message: "A verification code has been sent to your email. Enter it to confirm setup.",
        });
      }
    } catch (error: any) {
      logger.error("MFA setup failed", error);
      return res.status(500).json({ message: "MFA setup failed" });
    }
  });

  // Confirm MFA setup — verifies the code and enables MFA
  app.post("/api/portal/mfa/confirm", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { setupToken, code, method } = req.body;
      if (!setupToken || !code || !method) {
        return res.status(400).json({ message: "Setup token, code, and method are required" });
      }

      const setup = mfaPendingSetups.get(setupToken);
      const SETUP_EXPIRY = 10 * 60 * 1000;
      if (!setup || (Date.now() - setup.createdAt > SETUP_EXPIRY)) {
        if (setup) mfaPendingSetups.delete(setupToken);
        return res.status(400).json({ message: "Invalid or expired setup token" });
      }

      const user = portalUsers.get(req.user?.email || "");
      if (!user || user.id !== setup.userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      let verified = false;

      if (method === 'totp') {
        const otplib = await import('otplib');
        const auth = (otplib as any).authenticator || (otplib as any).default?.authenticator || otplib;
        verified = auth.verify({ token: code.trim(), secret: setup.secret });
      } else if (method === 'email') {
        verified = setup.secret === code.trim();
      }

      if (!verified) {
        return res.status(400).json({ message: "Invalid verification code. Please try again." });
      }

      // Generate backup codes
      const backupCodes: string[] = [];
      for (let i = 0; i < 8; i++) {
        backupCodes.push(randomBytes(3).toString('hex').toUpperCase());
      }

      // Enable MFA on user
      user.mfaEnabled = true;
      user.mfaMethod = method;
      user.mfaBackupCodes = backupCodes;
      if (method === 'totp') {
        user.mfaTotpSecret = setup.secret;
      }
      portalUsers.set(user.email, user);
      if (user.username) portalUsers.set(user.username, user);

      mfaPendingSetups.delete(setupToken);
      logSecurityEvent("MFA_ENABLED", req, { email: user.email, method });

      return res.json({
        success: true,
        message: "MFA enabled successfully!",
        backupCodes,
      });
    } catch (error: any) {
      logger.error("MFA confirm failed", error);
      return res.status(500).json({ message: "MFA confirmation failed" });
    }
  });

  // Disable MFA
  app.post("/api/portal/mfa/disable", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { password } = req.body;
      if (!password) return res.status(400).json({ message: "Password is required to disable MFA" });

      const user = portalUsers.get(req.user?.email || "");
      if (!user) return res.status(404).json({ message: "User not found" });

      const bcrypt = await import('bcrypt');
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ message: "Invalid password" });

      user.mfaEnabled = false;
      user.mfaMethod = null;
      user.mfaTotpSecret = null;
      user.mfaBackupCodes = [];
      portalUsers.set(user.email, user);
      if (user.username) portalUsers.set(user.username, user);

      logSecurityEvent("MFA_DISABLED", req, { email: user.email });
      return res.json({ success: true, message: "MFA has been disabled" });
    } catch (error: any) {
      logger.error("MFA disable failed", error);
      return res.status(500).json({ message: "Failed to disable MFA" });
    }
  });

  // Regenerate backup codes
  app.post("/api/portal/mfa/regenerate-backup-codes", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { password } = req.body;
      if (!password) return res.status(400).json({ message: "Password is required" });

      const user = portalUsers.get(req.user?.email || "");
      if (!user || !user.mfaEnabled) return res.status(400).json({ message: "MFA is not enabled" });

      const bcrypt = await import('bcrypt');
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ message: "Invalid password" });

      const backupCodes: string[] = [];
      for (let i = 0; i < 8; i++) {
        backupCodes.push(randomBytes(3).toString('hex').toUpperCase());
      }
      user.mfaBackupCodes = backupCodes;
      portalUsers.set(user.email, user);
      if (user.username) portalUsers.set(user.username, user);

      logSecurityEvent("MFA_BACKUP_CODES_REGENERATED", req, { email: user.email });
      return res.json({ success: true, backupCodes });
    } catch (error: any) {
      logger.error("Backup code regeneration failed", error);
      return res.status(500).json({ message: "Failed to regenerate backup codes" });
    }
  });

  // ===== PORTAL SETTINGS =====
  app.get("/api/portal/profile", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = portalUsers.get(req.user?.email || "");
      if (!user) return res.status(404).json({ message: "User not found" });
      const mgr = managerSummaryForUser(user as OrgUserFields);
      return res.json({
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        storeRole: user.storeRole,
        clientId: user.clientId || null,
        emailVerified: !!user.emailVerified,
        mfaEnabled: !!user.mfaEnabled,
        orgRole: user.orgRole || "staff",
        managerUserId: mgr.managerUserId,
        manager: mgr.manager,
        companyDomains: mgr.companyDomains,
      });
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to load profile" });
    }
  });

  app.patch("/api/portal/profile", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = portalUsers.get(req.user?.email || "");
      if (!user) return res.status(404).json({ message: "User not found" });

      const { fullName, email } = req.body;
      if (fullName && typeof fullName === "string") {
        user.fullName = fullName.trim();
      }
      if (email && typeof email === "string" && email.toLowerCase() !== user.email.toLowerCase()) {
        const nextEmail = email.trim().toLowerCase();
        if (portalUsers.has(nextEmail)) {
          return res.status(400).json({ message: "Email already in use" });
        }
        const previousEmail = user.email;
        user.email = nextEmail;
        user.emailVerified = false;
        // Drop the old email from the index so it can no longer authenticate.
        portalAuthRemoveUserKeys(user.id, [previousEmail]);
      }
      portalUsers.set(user.email, user);
      if (user.username) portalUsers.set(user.username, user);

      logSecurityEvent("PORTAL_PROFILE_UPDATED", req, { userId: user.id });
      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          storeRole: user.storeRole,
          clientId: user.clientId || null,
          emailVerified: !!user.emailVerified,
        },
      });
    } catch (error: any) {
      logger.error("Profile update failed", error);
      return res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.post("/api/portal/change-password", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current and new password are required" });
      }
      if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        return res.status(400).json({
          message: "Password must be at least 8 characters with 1 uppercase letter and 1 number",
        });
      }

      const user = portalUsers.get(req.user?.email || "");
      if (!user) return res.status(404).json({ message: "User not found" });

      const bcryptMod = await import("bcrypt");
      const valid = await bcryptMod.compare(currentPassword, user.password);
      if (!valid) return res.status(401).json({ message: "Current password is incorrect" });

      user.password = await bcryptMod.hash(newPassword, 12);
      portalUsers.set(user.email, user);
      if (user.username) portalUsers.set(user.username, user);

      logSecurityEvent("PORTAL_PASSWORD_CHANGED", req, { userId: user.id });
      return res.json({ success: true, message: "Password updated successfully" });
    } catch (error: any) {
      logger.error("Change password failed", error);
      return res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.post("/api/portal/order-form", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = portalUsers.get(req.user?.email || "");
      if (!user) return res.status(404).json({ message: "User not found" });

      const payload = req.body || {};
      const validated = validatePortalOrderSelection(payload.selectedServices);
      if (!validated.ok) {
        return res.status(400).json({ message: validated.error, code: validated.code });
      }
      payload.selectedServices = validated.lines;
      payload.pricing = {
        ...(payload.pricing && typeof payload.pricing === "object" ? payload.pricing : {}),
        monthlyTotal: validated.monthlyTotal,
        oneTimeTotal: validated.oneTimeTotal,
        hasCustom: validated.hasQuoteItems,
        payableCheckout: validated.payableCheckout,
      };

      const saved = await saveOrderForm({
        userId: user.id,
        clientId: user.clientId || null,
        payload,
      });

      const company = payload?.clientInfo?.legalName || user.fullName || user.email;
      logger.info("Portal order form submitted", { orderFormId: saved.id, email: user.email, company });

      try {
        await eventBus.emit(EventTypes.LEAD_CREATED, {
          source: "portal-order-form",
          email: user.email,
          name: user.fullName || user.username,
          company,
          orderFormId: saved.id,
        }, "portal-order-form");
      } catch {
        /* non-fatal */
      }

      logSecurityEvent("PORTAL_ORDER_FORM_SUBMITTED", req, { userId: user.id, orderFormId: saved.id });

      return res.json({
        success: true,
        message: "Order submitted successfully",
        packet: { id: saved.id, status: "submitted" },
        items: payload.selectedServices || [],
        orderFormId: saved.id,
      });
    } catch (error: any) {
      logger.error("Order form submit failed", error);
      return res.status(500).json({ message: "Failed to submit order form" });
    }
  });

  // Portal Dashboard Stats - Enhanced with Zoho data (scoped to user)
  app.get("/api/portal/dashboard", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { zohoDeskService } = await import("./zoho/zohoDesk");
      const { zohoBillingService } = await import("./zoho/zohoBilling");
      const { zohoClient } = await import("./zoho/zohoClient");
      
      let openTickets = 0;
      let resolvedTickets = 0;
      let pendingInvoices = 0;
      let recentTickets: any[] = [];
      let zohoDataFetched = false;
      
      const userEmail = req.user?.email;
      
      // Try to get Zoho data if connected - scoped to user
      if (zohoClient.isConfigured() && userEmail) {
        try {
          // Get contact by email first to scope ticket queries
          const contact = await zohoDeskService.getContactByEmail(userEmail);
          
          if (contact) {
            // Get tickets for this specific contact
            const contactTickets = await zohoDeskService.getTicketsByContact(contact.id);
            
            openTickets = contactTickets.filter(t => 
              t.status?.toLowerCase() === "open" || t.status?.toLowerCase() === "in progress"
            ).length;
            resolvedTickets = contactTickets.filter(t => 
              t.status?.toLowerCase() === "closed" || t.status?.toLowerCase() === "resolved"
            ).length;
            recentTickets = contactTickets.slice(0, 5).map(t => ({
              id: t.id,
              ticketNumber: t.ticketNumber,
              subject: t.subject,
              status: t.status?.toLowerCase() || "open",
              priority: t.priority,
              createdAt: t.createdTime,
            }));
            zohoDataFetched = true;
          }
        } catch (deskError) {
          console.warn("Could not fetch Zoho Desk data for user:", deskError);
        }
        
        try {
          // Get invoices scoped to user's billing customer
          const customer = await zohoBillingService.getCustomerByEmail(userEmail);
          if (customer) {
            const customerInvoices = await zohoBillingService.getInvoicesByCustomer(customer.customer_id);
            pendingInvoices = customerInvoices.filter(inv => 
              inv.status?.toLowerCase() === "unpaid" || inv.status?.toLowerCase() === "overdue"
            ).length;
          }
        } catch (billingError) {
          console.warn("Could not fetch Zoho Billing data for user:", billingError);
        }
      }
      
      // Fallback to local tickets if Zoho didn't return data
      if (!zohoDataFetched) {
        const tickets = await storage.getPortalTickets(req.userId || "");
        openTickets = tickets.filter(t => t.status === "open" || (t.status as string) === "in-progress" || (t.status as string) === "in_progress").length;
        resolvedTickets = tickets.filter(t => t.status === "resolved" || t.status === "closed").length;
        recentTickets = tickets.slice(0, 5).map(t => ({
          id: t.id,
          ticketNumber: t.ticketNumber || `#TK${String(t.id).padStart(3, '0')}`,
          subject: t.subject,
          status: t.status,
          priority: t.priority,
          createdAt: t.createdAt,
        }));
      }
      
      // Get services from Zoho subscriptions
      let services: any[] = [];
      let zohoBillingFetched = false;
      
      if (zohoClient.isConfigured() && userEmail) {
        try {
          const customer = await zohoBillingService.getCustomerByEmail(userEmail);
          if (customer) {
            const subscriptions = await zohoBillingService.getSubscriptionsByCustomer(customer.customer_id);
            services = subscriptions
              .filter(sub => sub.status === "live" || sub.status === "active")
              .map(sub => ({
                id: sub.subscription_id,
                serviceName: sub.plan?.name || sub.name,
                status: sub.status,
                amount: sub.amount,
                nextBilling: sub.next_billing_at,
                zohoLink: `https://billing.zoho.com/app#/subscriptions/${sub.subscription_id}`,
              }));
            zohoBillingFetched = true;
          }
        } catch (subError) {
          console.warn("Could not fetch Zoho subscriptions for services:", subError);
        }
      }
      
      // Do not invent active services when Zoho returns none — empty is honest.
      const dashboardStats = {
        openTickets,
        resolvedTickets,
        activeServices: services.length,
        pendingInvoices,
        recentTickets,
        services,
        zohoConnected: zohoDataFetched || zohoBillingFetched,
      };
      
      res.json(dashboardStats);
    } catch (error: any) {
      console.error("[ERROR] Dashboard fetch failed:", error);
      res.status(500).json({ message: "Failed to load dashboard" });
    }
  });

  // Portal Billing - Get subscription and invoices from Zoho Billing
  app.get("/api/portal/billing", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { zohoBillingService } = await import("./zoho/zohoBilling");
      const { zohoClient } = await import("./zoho/zohoClient");
      
      if (!zohoClient.isConfigured()) {
        return res.json({
          subscription: null,
          invoices: [],
          zohoConnected: false,
          message: "Billing integration not configured",
        });
      }
      
      let subscription = null;
      let invoices: any[] = [];
      let zohoConnected = false;
      
      try {
        const userEmail = req.user?.email;
        
        // Try to find customer by email first for proper data isolation
        let customer = null;
        if (userEmail) {
          customer = await zohoBillingService.getCustomerByEmail(userEmail);
        }
        
        if (customer) {
          // Get subscriptions for this specific customer
          const customerSubs = await zohoBillingService.getSubscriptionsByCustomer(customer.customer_id);
          subscription = customerSubs.find(s => s.status === "live") || customerSubs[0] || null;
          
          // Get invoices for this specific customer
          invoices = await zohoBillingService.getInvoicesByCustomer(customer.customer_id);
          zohoConnected = true;
        } else {
          // No customer found - return empty with message
          console.log(`No Zoho Billing customer found for: ${userEmail}`);
        }
      } catch (error) {
        console.warn("Could not fetch Zoho Billing data:", error);
      }
      
      // Add Zoho links to subscription and invoices
      const subscriptionWithLink = subscription ? {
        ...subscription,
        zohoLink: `https://billing.zoho.com/app#/subscriptions/${subscription.subscription_id}`,
      } : null;
      
      const invoicesWithLinks = invoices.map(inv => ({
        ...inv,
        zohoLink: `https://billing.zoho.com/app#/invoices/${inv.invoice_id}`,
      }));
      
      res.json({
        subscription: subscriptionWithLink,
        invoices: invoicesWithLinks,
        zohoConnected,
        message: !zohoConnected ? "Your billing account is being set up" : undefined,
      });
    } catch (error: any) {
      console.error("[ERROR] Billing fetch failed:", error);
      res.status(500).json({ message: "Failed to load billing data" });
    }
  });

  // Portal Company - Get CRM account and contacts
  app.get("/api/portal/company", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { zohoCRMService } = await import("./zoho/zohoCRM");
      const { zohoClient } = await import("./zoho/zohoClient");
      
      if (!zohoClient.isConfigured()) {
        return res.json({
          account: null,
          contacts: [],
          zohoConnected: false,
          message: "CRM integration not configured",
        });
      }
      
      let account = null;
      let contacts: any[] = [];
      let zohoConnected = false;
      
      try {
        const userEmail = req.user?.email;
        
        // Find the contact by email first, then get their associated account
        if (userEmail) {
          const contact = await zohoCRMService.getContactByEmail(userEmail);
          
          if (contact && contact.Account_Name?.id) {
            // Get the account this contact belongs to
            account = await zohoCRMService.getAccountById(contact.Account_Name.id);
            
            if (account) {
              // Get all contacts for this account
              contacts = await zohoCRMService.getContactsByAccount(account.id);
              zohoConnected = true;
            }
          } else {
            console.log(`No Zoho CRM contact/account found for: ${userEmail}`);
          }
        }
      } catch (error) {
        console.warn("Could not fetch Zoho CRM data:", error);
      }
      
      // Add Zoho links to account and contacts
      const accountWithLink = account ? {
        ...account,
        zohoLink: `https://crm.zoho.com/crm/org/tab/Accounts/${account.id}`,
      } : null;
      
      const contactsWithLinks = contacts.map(c => ({
        ...c,
        zohoLink: `https://crm.zoho.com/crm/org/tab/Contacts/${c.id}`,
      }));
      
      res.json({
        account: accountWithLink,
        contacts: contactsWithLinks,
        zohoConnected,
        message: !zohoConnected ? "Your company profile is being set up" : undefined,
      });
    } catch (error: any) {
      console.error("[ERROR] Company fetch failed:", error);
      res.status(500).json({ message: "Failed to load company data" });
    }
  });

  // Portal Learning Center — role-personalized curriculum (Hub taxonomy + docs)
  app.get("/api/portal/learning", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const live = req.user?.email ? portalUsers.get(req.user.email) : null;
      const audience = resolveLearningAudience({
        role: live?.role || req.user?.role,
        orgRole: live?.orgRole || req.user?.orgRole,
        isCompanyItContact: !!(live?.isCompanyItContact || req.user?.isCompanyItContact),
      });
      const payload = buildLearningPayload(audience);

      let hubResources: Array<{
        slug: string;
        title: string;
        category?: string;
        description?: string;
        version?: number | string;
      }> = [];
      let hubSource: "techsales" | "none" | "unconfigured" = "unconfigured";

      try {
        const { companyName } = portalCompanyContext(req);
        if (companyName) {
          const hub = await fetchHubCompanyDocuments(companyName);
          if (hub?.library?.length) {
            hubSource = "techsales";
            hubResources = hub.library
              .filter((d: any) => d?.slug && LEARNING_HUB_DOC_SLUGS.has(String(d.slug)))
              .map((d: any) => ({
                slug: String(d.slug),
                title: String(d.title || d.slug),
                category: d.category,
                description: d.description,
                version: d.version,
              }));
          } else if (hub) {
            hubSource = "techsales";
          } else {
            hubSource = "none";
          }
        } else {
          hubSource = "none";
        }
      } catch {
        hubSource = "none";
      }

      // Fallback educational titles when Hub bridge has no match yet
      if (hubResources.length === 0) {
        const wanted = new Set(
          payload.lessons.flatMap((l) => l.hubDocSlugs || []),
        );
        hubResources = Array.from(wanted).map((slug) => {
          const title =
            slug
              .replace(/-/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase()) || slug;
          return {
            slug,
            title,
            category: "service_tier",
            description: "Referenced from TechSales document catalog — open Contracts when available.",
          };
        });
      }

      const recommendedMinutes = payload.lessons.reduce((n, l) => n + l.minutes, 0);

      return res.json({
        ...payload,
        recommendedMinutes,
        hub: {
          source: hubSource,
          resources: hubResources,
        },
        catalogVersion: "hub-core36-ecosystem-v1",
        lessonCountTotal: LEARNING_LESSONS.length,
      });
    } catch (error: any) {
      console.error("[ERROR] portal learning:", error);
      return res.status(500).json({ message: "Failed to load learning path" });
    }
  });

  // Portal Knowledge Base Articles
  app.get("/api/portal/kb", [authMiddleware], async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const articles = [
        {
          id: "kb-001",
          title: "Getting Started with VPN Access",
          category: "VPN",
          content: "Learn how to configure and connect to our VPN for secure remote access.",
          excerpt: "Complete guide to setting up VPN access for remote work.",
          readTime: "5 min",
          updatedAt: "2025-01-15",
        },
        {
          id: "kb-002", 
          title: "Cytracom ControlOne Setup Guide",
          category: "Phone System",
          content: "Step-by-step instructions for configuring Cytracom ControlOne softphone.",
          excerpt: "Set up your cloud phone system with Cytracom ControlOne.",
          readTime: "8 min",
          updatedAt: "2025-01-10",
        },
        {
          id: "kb-003",
          title: "Password Reset Procedures",
          category: "Security",
          content: "How to reset your password for various company systems.",
          excerpt: "Self-service password reset instructions for all platforms.",
          readTime: "3 min",
          updatedAt: "2025-01-12",
        },
        {
          id: "kb-004",
          title: "Microsoft 365 Email Configuration",
          category: "Email",
          content: "Configure Microsoft 365 email on desktop and mobile devices.",
          excerpt: "Email setup guide for Outlook, mobile apps, and web access.",
          readTime: "6 min",
          updatedAt: "2025-01-08",
        },
        {
          id: "kb-005",
          title: "Multi-Factor Authentication (MFA) Setup",
          category: "Security",
          content: "Enable and configure MFA for enhanced account security.",
          excerpt: "Protect your accounts with two-factor authentication.",
          readTime: "4 min",
          updatedAt: "2025-01-14",
        },
        {
          id: "kb-006",
          title: "Remote Desktop Connection Guide",
          category: "Remote Access",
          content: "Connect to office computers remotely using RDP.",
          excerpt: "Access your work desktop from anywhere securely.",
          readTime: "5 min",
          updatedAt: "2025-01-11",
        },
      ];
      
      res.json(articles);
    } catch (error: any) {
      console.error("[ERROR] KB fetch failed:", error);
      res.status(500).json({ message: "Failed to load knowledge base" });
    }
  });

  // Portal Services List — Zoho subscriptions only (no invented catalog)
  app.get("/api/portal/services", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { zohoBillingService } = await import("./zoho/zohoBilling");
      const { zohoClient } = await import("./zoho/zohoClient");

      if (!zohoClient.isConfigured()) {
        return res.json([]);
      }

      const userEmail = req.user?.email;
      if (!userEmail) {
        return res.json([]);
      }

      try {
        const customer = await zohoBillingService.getCustomerByEmail(userEmail);
        if (!customer) {
          return res.json([]);
        }

        const subscriptions = await zohoBillingService.getSubscriptionsByCustomer(customer.customer_id);
        const services = subscriptions
          .filter((sub) => sub.status === "live" || sub.status === "active")
          .map((sub) => ({
            id: sub.subscription_id,
            serviceName: sub.plan?.name || sub.name || "Subscription",
            description: (sub.plan as any)?.description || "",
            status: sub.status === "live" ? "active" : sub.status,
            monthlyPrice: sub.amount != null ? String(sub.amount) : "",
            userCount: undefined,
            startDate: sub.current_term_starts_at || (sub as any).created_at || (sub as any).created_time || "",
          }));

        return res.json(services);
      } catch (zohoErr) {
        console.warn("[portal/services] Zoho fetch failed:", zohoErr);
        return res.json([]);
      }
    } catch (error: any) {
      res.status(500).json({ message: "Failed to load services" });
    }
  });

  // Portal Invoices List
  app.get("/api/portal/invoices", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { zohoBillingService } = await import("./zoho/zohoBilling");
      const { zohoClient } = await import("./zoho/zohoClient");
      
      let invoices: any[] = [];
      let zohoConnected = false;
      
      if (!zohoClient.isConfigured()) {
        return res.json({
          invoices: [],
          zohoConnected: false,
          message: "Billing integration not configured",
        });
      }
      
      try {
        const userEmail = req.user?.email;
        
        // Scope to authenticated user's customer account for data isolation
        if (userEmail) {
          const customer = await zohoBillingService.getCustomerByEmail(userEmail);
          
          if (customer) {
            const customerInvoices = await zohoBillingService.getInvoicesByCustomer(customer.customer_id);
            invoices = customerInvoices.map(inv => ({
              id: inv.invoice_id,
              invoiceNumber: inv.invoice_number,
              amount: inv.total.toString(),
              status: inv.status?.toLowerCase() || "pending",
              issueDate: inv.invoice_date,
              dueDate: inv.due_date,
              balance: inv.balance,
              currency: inv.currency_code,
            }));
            zohoConnected = true;
          } else {
            console.log(`No Zoho Billing customer found for invoices: ${userEmail}`);
          }
        }
      } catch (error) {
        console.warn("Could not fetch Zoho Billing invoices:", error);
      }
      
      res.json({
        invoices,
        zohoConnected,
        message: !zohoConnected ? "Your billing account is being set up" : undefined,
      });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to load invoices" });
    }
  });

  // Single invoice for payment page — scoped to authenticated customer's invoices
  app.get("/api/portal/invoices/:id", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { zohoBillingService } = await import("./zoho/zohoBilling");
      const { zohoClient } = await import("./zoho/zohoClient");

      if (!zohoClient.isConfigured()) {
        return res.status(503).json({ error: "Billing integration not configured" });
      }

      const userEmail = req.user?.email;
      if (!userEmail) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const customer = await zohoBillingService.getCustomerByEmail(userEmail);
      if (!customer) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const customerInvoices = await zohoBillingService.getInvoicesByCustomer(customer.customer_id);
      const inv = customerInvoices.find((i) => i.invoice_id === id || i.invoice_number === id);
      if (!inv) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      res.json({
        id: inv.invoice_id,
        invoiceNumber: inv.invoice_number,
        amount: inv.total.toString(),
        balance: inv.balance,
        status: inv.status?.toLowerCase() || "pending",
        issueDate: inv.invoice_date,
        dueDate: inv.due_date,
        currency: inv.currency_code || "USD",
      });
    } catch (error: any) {
      console.error("[PORTAL INVOICE GET]", error);
      res.status(500).json({ error: "Failed to load invoice" });
    }
  });

  // Portal invoice payment via Zoho Payments
  app.post("/api/portal/payment/zoho", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { invoiceId, amount } = req.body || {};
      if (!invoiceId) {
        return res.status(400).json({ error: "invoiceId is required" });
      }

      const { zohoBillingService } = await import("./zoho/zohoBilling");
      const { zohoClient } = await import("./zoho/zohoClient");
      const { zohoPayments } = await import("./zohoPayments");

      if (!zohoPayments.isConfigured()) {
        return res.status(503).json({ error: "Online payments are not configured. Please contact billing@digeratiexperts.com." });
      }
      if (!zohoClient.isConfigured()) {
        return res.status(503).json({ error: "Billing integration not configured" });
      }

      const userEmail = req.user?.email;
      if (!userEmail) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const customer = await zohoBillingService.getCustomerByEmail(userEmail);
      if (!customer) {
        return res.status(404).json({ error: "Billing account not found" });
      }

      const customerInvoices = await zohoBillingService.getInvoicesByCustomer(customer.customer_id);
      const inv = customerInvoices.find((i) => i.invoice_id === invoiceId || i.invoice_number === invoiceId);
      if (!inv) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const payAmount = typeof amount === "number" && amount > 0
        ? amount / 100
        : Number(inv.balance ?? inv.total);
      if (!payAmount || payAmount <= 0) {
        return res.status(400).json({ error: "Invoice has no balance due" });
      }

      const appUrl = process.env.APP_URL || "https://digeratiexperts.com";
      const session = await zohoPayments.createPaymentSession({
        orderNumber: `INV-${inv.invoice_number}`,
        customerEmail: userEmail,
        customerName: req.user?.fullName || customer.display_name || userEmail,
        lineItems: [{
          name: `Invoice ${inv.invoice_number}`,
          description: "Portal invoice payment",
          amount: payAmount,
          quantity: 1,
        }],
        totalAmount: payAmount,
        currency: inv.currency_code || "USD",
        successUrl: `${appUrl}/portal/invoices?paid=1`,
        cancelUrl: `${appUrl}/portal/invoices/${inv.invoice_id}/pay`,
        metadata: {
          invoiceId: inv.invoice_id,
          invoiceNumber: inv.invoice_number,
          portalUserId: req.userId || "",
        },
      });

      res.json({
        url: session.url,
        paymentSessionId: session.payment_session_id,
        invoiceNumber: inv.invoice_number,
        amount: payAmount,
      });
    } catch (error: any) {
      console.error("[PORTAL PAYMENT ZOHO]", error);
      res.status(500).json({ error: error.message || "Failed to start payment" });
    }
  });

  // Legacy Stripe path removed — return clear guidance
  app.post("/api/portal/payment/checkout", [authMiddleware], async (_req: AuthenticatedRequest, res: Response) => {
    res.status(410).json({
      error: "Card checkout via Stripe has been replaced. Use Zoho Payments.",
      use: "/api/portal/payment/zoho",
    });
  });

  // ===== PORTAL ORDER ROUTES =====
  
  // List orders for authenticated client
  app.get("/api/portal/orders", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { status } = req.query;
      const userId = req.userId;
      const clientId = req.user?.clientId;
      const statusFilter = typeof status === "string" && status !== "all" ? status : null;

      // --- Store orders ---
      const allOrders = await storage.getStoreOrders();
      let userOrders = allOrders.filter(
        (order) => order.userId === userId || (clientId && order.clientId === clientId),
      );
      if (statusFilter) {
        userOrders = userOrders.filter((order) => order.status === statusFilter);
      }
      userOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const storeOrders = userOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total != null ? String(order.total) : "0",
        totalMonthly: null as number | null,
        totalOneTime: null as number | null,
        createdAt: order.createdAt,
        itemCount: Array.isArray(order.lineItems) ? order.lineItems.length : 0,
        billingName: order.billingName,
        title: order.billingCompany || order.billingName || order.orderNumber,
        source: "store" as const,
        detailPath: `/portal/orders/${order.id}`,
        hubStatus: null as string | null,
      }));

      // --- Store quote requests (same account) ---
      let storeQuotes: typeof storeOrders = [];
      try {
        const { storeQuoteRequests } = await import("@shared/schema");
        const { db: portalDb, dbReady: portalDbReady } = await import("./db");
        if (portalDbReady && portalDb && (userId || clientId)) {
          const { eq: dEq, or: dOr } = await import("drizzle-orm");
          const clauses = [];
          if (userId) clauses.push(dEq(storeQuoteRequests.userId, userId));
          if (clientId) clauses.push(dEq(storeQuoteRequests.clientId, clientId));
          if (req.user?.email) {
            clauses.push(dEq(storeQuoteRequests.contactEmail, req.user.email));
          }
          if (clauses.length) {
            const rows = await portalDb.select().from(storeQuoteRequests).where(dOr(...clauses));
            storeQuotes = rows
              .filter((q: any) => !statusFilter || String(q.status) === statusFilter || statusFilter === "pending")
              .map((q: any) => {
                const items = Array.isArray(q.requestedItems) ? q.requestedItems : [];
                return {
                  id: `sq-${q.id}`,
                  orderNumber: q.quoteNumber,
                  status: q.status === "converted" ? "completed" : q.status === "declined" ? "cancelled" : "quote_requested",
                  total: "0",
                  totalMonthly: null as number | null,
                  totalOneTime: null as number | null,
                  createdAt: q.createdAt,
                  itemCount: items.length,
                  billingName: q.contactName,
                  title: q.companyName || `Quote request ${q.quoteNumber}`,
                  source: "store_quote" as const,
                  detailPath: "/store",
                  hubStatus: q.status,
                };
              });
          }
        }
      } catch (e: any) {
        console.warn("[orders] store quote requests skipped:", e?.message);
      }

      // --- TechSales Hub commercial items ---
      let hubOrders: Array<{
        id: string;
        orderNumber: string;
        status: string;
        total: string;
        totalMonthly: number | null;
        totalOneTime: number | null;
        createdAt: string | Date;
        itemCount: number;
        billingName?: string;
        title: string;
        source: string;
        detailPath: string;
        hubStatus: string | null;
      }> = [];
      let hubSource: "ok" | "unavailable" | "skipped" = "skipped";
      let companyName: string | null = null;
      let matchedDeals: any[] = [];

      try {
        const ctx = portalCompanyContext(req);
        companyName = ctx.companyName;
        if (companyName || ctx.hubAccountId) {
          const hub = await fetchHubCompanyOrders(companyName || "", ctx.hubAccountId);
          const mappedAccountId = hub?.accountId || hub?.matchedDeals?.find((d) => d.accountId)?.accountId;
          if (ctx.companyId && mappedAccountId) {
            await persistHubAccountId(ctx.companyId, mappedAccountId);
          }
          if (hub?.orders) {
            hubSource = "ok";
            matchedDeals = hub.matchedDeals || [];
            hubOrders = hub.orders
              .map((o) => {
                const monthly = typeof o.totalMonthly === "number" ? o.totalMonthly : null;
                const oneTime = typeof o.totalOneTime === "number" ? o.totalOneTime : null;
                const amount =
                  typeof o.amount === "number"
                    ? o.amount
                    : (monthly || 0) + (oneTime || 0);
                return {
                  id: o.id,
                  orderNumber: o.orderNumber,
                  status: o.status,
                  total: String(amount || 0),
                  totalMonthly: monthly,
                  totalOneTime: oneTime,
                  createdAt: o.createdAt || o.updatedAt || new Date().toISOString(),
                  itemCount: 1,
                  billingName: o.companyName,
                  title: o.title || o.orderNumber,
                  source: o.source || "hub",
                  detailPath: o.detailPath || "/portal/contracts",
                  hubStatus: o.hubStatus || o.stage || null,
                };
              })
              .filter((o) => !statusFilter || o.status === statusFilter);
          } else {
            hubSource = "unavailable";
          }
        }
      } catch (e: any) {
        hubSource = "unavailable";
        console.warn("[orders] hub bridge:", e?.message);
      }

      const orders = [...storeOrders, ...storeQuotes, ...hubOrders].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      logSecurityEvent("ORDERS_LIST_VIEWED", req, {
        userId,
        clientId,
        orderCount: orders.length,
        storeCount: storeOrders.length,
        hubCount: hubOrders.length,
        statusFilter: statusFilter || "all",
      });

      res.json({
        orders,
        storeOrders,
        hubOrders,
        storeQuotes,
        companyName,
        matchedDeals,
        sources: { store: "ok", hub: hubSource, storeQuotes: storeQuotes.length ? "ok" : "empty" },
      });
    } catch (error: any) {
      console.error("[ERROR] Failed to fetch orders:", error);
      res.status(500).json({ message: "Failed to load orders" });
    }
  });

  // Get single order detail for client
  app.get("/api/portal/orders/:id", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.userId;
      const clientId = req.user?.clientId;
      
      const order = await storage.getStoreOrder(id);
      
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      // Verify the order belongs to the authenticated user/client
      if (order.userId !== userId && order.clientId !== clientId) {
        return res.status(403).json({ error: "Access denied to this order" });
      }
      
      logSecurityEvent("ORDER_DETAIL_VIEWED", req, { 
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId,
        clientId,
        orderStatus: order.status
      });
      
      res.json({
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentMethod: order.paymentMethod,
          lineItems: order.lineItems || [],
          subtotal: order.subtotal,
          tax: order.tax,
          total: order.total,
          billingName: order.billingName,
          billingEmail: order.billingEmail,
          billingCompany: order.billingCompany,
          billingAddress: order.billingAddress,
          zohoPaymentId: order.zohoPaymentId,
          notes: order.notes,
          paidAt: order.paidAt,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        },
      });
    } catch (error: any) {
      console.error("[ERROR] Failed to fetch order:", error);
      res.status(500).json({ message: "Failed to load order" });
    }
  });

  // Generate receipt HTML for order
  app.get("/api/portal/orders/:id/receipt", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.userId;
      const clientId = req.user?.clientId;
      
      const order = await storage.getStoreOrder(id);
      
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      // Verify the order belongs to the authenticated user/client
      if (order.userId !== userId && order.clientId !== clientId) {
        return res.status(403).json({ error: "Access denied to this order" });
      }
      
      const lineItems = Array.isArray(order.lineItems) ? order.lineItems : [];
      const billingAddress = order.billingAddress as { street?: string; city?: string; state?: string; zipCode?: string; country?: string } | null;
      
      // Generate HTML receipt
      const receiptHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt - ${escapeHtml(order.orderNumber)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #333; }
    .header { text-align: center; margin-bottom: 40px; }
    .logo { font-size: 24px; font-weight: bold; color: #D3126A; margin-bottom: 8px; }
    .receipt-title { font-size: 18px; color: #666; }
    .order-info { display: flex; justify-content: space-between; margin-bottom: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; }
    .order-info div { }
    .order-info .label { font-size: 12px; color: #666; margin-bottom: 4px; }
    .order-info .value { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin: 30px 0; }
    th { text-align: left; padding: 12px; border-bottom: 2px solid #e0e0e0; font-weight: 600; }
    td { padding: 12px; border-bottom: 1px solid #e0e0e0; }
    .text-right { text-align: right; }
    .totals { margin-left: auto; width: 300px; }
    .totals .row { display: flex; justify-content: space-between; padding: 8px 0; }
    .totals .total { font-weight: bold; font-size: 18px; border-top: 2px solid #333; padding-top: 12px; margin-top: 8px; }
    .billing { margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; }
    .billing h3 { margin: 0 0 12px 0; font-size: 14px; color: #666; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Digerati Experts</div>
    <div class="receipt-title">Order Receipt</div>
  </div>
  
  <div class="order-info">
    <div>
      <div class="label">Order Number</div>
      <div class="value">${escapeHtml(order.orderNumber)}</div>
    </div>
    <div>
      <div class="label">Order Date</div>
      <div class="value">${new Date(order.createdAt).toLocaleDateString()}</div>
    </div>
    <div>
      <div class="label">Status</div>
      <div class="value">${(order.status || "pending").replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}</div>
    </div>
    ${order.paidAt ? `
    <div>
      <div class="label">Paid On</div>
      <div class="value">${new Date(order.paidAt).toLocaleDateString()}</div>
    </div>
    ` : ""}
  </div>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th class="text-right">Qty</th>
        <th class="text-right">Unit Price</th>
        <th class="text-right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${lineItems.map((item: any) => `
        <tr>
          <td>${escapeHtml(item.name || "Item")}<br><small style="color:#666">SKU: ${escapeHtml(item.sku || "N/A")}</small></td>
          <td class="text-right">${item.quantity || 1}</td>
          <td class="text-right">$${parseFloat(item.unitPrice || "0").toFixed(2)}</td>
          <td class="text-right">$${parseFloat(item.total || "0").toFixed(2)}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <div class="totals">
    <div class="row">
      <span>Subtotal</span>
      <span>$${parseFloat(order.subtotal).toFixed(2)}</span>
    </div>
    <div class="row">
      <span>Tax</span>
      <span>$${parseFloat(order.tax || "0").toFixed(2)}</span>
    </div>
    <div class="row total">
      <span>Total</span>
      <span>$${parseFloat(order.total).toFixed(2)}</span>
    </div>
  </div>

  <div class="billing">
    <h3>Billing Information</h3>
    <div>${escapeHtml(order.billingName || "N/A")}</div>
    ${order.billingCompany ? `<div>${escapeHtml(order.billingCompany)}</div>` : ""}
    ${order.billingEmail ? `<div>${escapeHtml(order.billingEmail)}</div>` : ""}
    ${billingAddress?.street ? `<div>${escapeHtml(billingAddress.street)}</div>` : ""}
    ${billingAddress?.city || billingAddress?.state || billingAddress?.zipCode ? `
      <div>${escapeHtml(billingAddress.city || "")}${billingAddress.city && billingAddress.state ? ", " : ""}${escapeHtml(billingAddress.state || "")} ${escapeHtml(billingAddress.zipCode || "")}</div>
    ` : ""}
  </div>

  <div class="footer">
    <p>Thank you for your business!</p>
    <p>Digerati Experts | support@digeratiexperts.com | ${PRIMARY_PHONE.display}</p>
  </div>
</body>
</html>
      `;
      
      logSecurityEvent("RECEIPT_GENERATED", req, { 
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId,
        clientId,
        total: order.total,
        orderStatus: order.status
      });
      
      res.setHeader("Content-Type", "text/html");
      res.setHeader("Content-Disposition", `attachment; filename="receipt-${order.orderNumber}.html"`);
      res.send(receiptHtml);
    } catch (error: any) {
      console.error("[ERROR] Failed to generate receipt:", error);
      res.status(500).json({ message: "Failed to generate receipt" });
    }
  });

  // ===== CONTRACTS (TechSales Hub document library + company-specific) =====

  function portalCompanyContext(req: AuthenticatedRequest) {
    const impersonatingCompanyId =
      (req.user as any)?.impersonatingCompanyId ||
      (typeof (req.user as any)?.impersonatingCompanyId === "string"
        ? (req.user as any).impersonatingCompanyId
        : null);
    // JWT may carry impersonation from admin switch
    let jwtImpersonation: string | null = null;
    try {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.split(" ")[1];
      if (token) {
        const decoded = jwt.verify(token, jwtSecret()) as any;
        jwtImpersonation = decoded.impersonatingCompanyId || null;
        if (decoded.impersonatingCompanyName && !req.user?.clientId) {
          /* keep */
        }
      }
    } catch {
      /* ignore */
    }
    const companyId = jwtImpersonation || impersonatingCompanyId || req.user?.clientId || null;
    const companyName = resolvePortalCompanyName({
      clientId: companyId,
      impersonatingCompanyId: jwtImpersonation || impersonatingCompanyId,
      getClient: (id) => portalClients.get(id),
    });
    const hubAccountId = resolvePortalHubAccountId({
      clientId: companyId,
      impersonatingCompanyId: jwtImpersonation || impersonatingCompanyId,
      getClient: (id) => portalClients.get(id),
    });
    return { companyId, companyName, hubAccountId };
  }

  app.get("/api/portal/contracts", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { companyId, companyName, hubAccountId } = portalCompanyContext(req);
      if (!companyName && !hubAccountId) {
        return res.json({
          contracts: [],
          library: [],
          companyName: null,
          matchedDeals: [],
          source: "none",
          message: "No company profile on this portal user. Contact your Company IT Contact or Digerati.",
        });
      }

      const hub = await fetchHubCompanyDocuments(companyName || "", hubAccountId);
      const mappedAccountId = hub?.accountId || hub?.matchedDeals?.find((d) => d.accountId)?.accountId;
      if (companyId && mappedAccountId) {
        await persistHubAccountId(companyId, mappedAccountId);
      }
      if (companyId && hub) {
        void import("./services/de-intelligence/techSalesIngestion")
          .then(({ ingestTechSalesCompanyKnowledge }) =>
            ingestTechSalesCompanyKnowledge({ clientId: companyId, hub }),
          )
          .catch((error: any) => {
            logger.warn("TechSales knowledge ingestion scheduling failed", {
              clientId: companyId,
              message: error?.message || String(error),
            });
          });
      }

      if (!hub) {
        return res.json({
          contracts: [],
          library: [],
          companyName,
          companyId,
          matchedDeals: [],
          source: "hub_unavailable",
          message:
            "Could not reach TechSales document library. Ensure TECHSALES_SYNC_URL/TOKEN are configured.",
        });
      }

      const contracts = (hub.contracts || []).map((c: any) => ({
        ...c,
        pdfUrl: c.hubSignatureId
          ? `/api/portal/contracts/${c.hubSignatureId}/download`
          : null,
        pdfContent: null,
      }));

      return res.json({
        contracts,
        library: hub.library || [],
        companyName: hub.companyName || companyName,
        companyId,
        matchedDeals: hub.matchedDeals || [],
        source: "techsales_hub",
      });
    } catch (error: any) {
      logger.error("Failed to load contracts", error);
      return res.status(500).json({ message: "Failed to load contracts" });
    }
  });

  app.get("/api/portal/contracts/:signatureId/download", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const signatureId = parseInt(req.params.signatureId, 10);
      if (Number.isNaN(signatureId)) {
        return res.status(400).json({ message: "Invalid contract id" });
      }
      const { companyName, hubAccountId } = portalCompanyContext(req);
      if (!companyName && !hubAccountId) {
        return res.status(400).json({ message: "No company profile loaded" });
      }
      const kind = typeof req.query.kind === "string" ? req.query.kind : "signed_pdf";
      const file = await fetchHubContractDownload(signatureId, companyName || "", kind, hubAccountId);
      if (!file) {
        return res.status(404).json({ message: "Document not available" });
      }
      res.setHeader("Content-Type", file.contentType);
      res.setHeader("Content-Disposition", `inline; filename="${file.fileName.replace(/"/g, "")}"`);
      return res.send(file.buffer);
    } catch (error: any) {
      logger.error("Failed to download contract", error);
      return res.status(500).json({ message: "Failed to download contract" });
    }
  });

  app.post("/api/portal/contracts/:id/acknowledge", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { companyId, hubAccountId } = portalCompanyContext(req);
      const envelope = await enqueueOutbox({
        eventType: "document.acknowledged",
        source: "portal",
        destination: "hub",
        entityType: "document",
        entityId: String(req.params.id),
        canonicalAccountId: hubAccountId,
        payload: { portalClientId: companyId, kind: "acknowledge" },
      });
      return res.status(202).json({
        ok: true,
        eventId: envelope.eventId,
        message: "Acknowledgement queued for TechSales. This is not an e-signature.",
      });
    } catch (error: any) {
      logger.error("Failed to acknowledge contract", error);
      return res.status(500).json({ message: "Failed to acknowledge document" });
    }
  });

  // Signing remains Zoho Sign / TechSales-owned; portal does not counterfeit signatures locally.
  app.post("/api/portal/contracts/:id/sign", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      return res.status(501).json({
        message:
          "E-signature is completed through the Zoho Sign link sent for this document (managed in TechSales). Contact your Company IT Contact or Digerati if you need the signing link resent.",
      });
    } catch (error: any) {
      logger.error("Failed to sign contract", error);
      return res.status(500).json({ message: "Failed to sign contract" });
    }
  });

  app.post("/api/portal/contracts/:id/decline", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      return res.status(501).json({
        message:
          "To decline a pending agreement, use the Zoho Sign email link or ask Digerati / your Company IT Contact to recall the request in TechSales.",
      });
    } catch (error: any) {
      logger.error("Failed to decline contract", error);
      return res.status(500).json({ message: "Failed to decline contract" });
    }
  });

  // ===== ADMIN TENANT MANAGEMENT =====
  
  // List all companies (admin only)
  app.get("/api/portal/admin/companies", [authMiddleware, requireAdmin], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const companies = Array.from(portalClients.values()).map(client => ({
        id: client.id,
        companyName: client.companyName,
        contactEmail: client.contactEmail,
        status: client.status || "active",
        type: client.type || "client", // "msp" for Digerati, "client" for customers
        userCount: Array.from(portalUsers.values()).filter(u => u.clientId === client.id).length,
        createdAt: client.createdAt,
      }));
      
      res.json({ companies });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Admin tenant selector - quick list for dropdown
  app.get("/api/portal/admin/tenants", [authMiddleware, requireAdmin], async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Get MSP company first, then clients sorted by name
      const allCompanies = Array.from(portalClients.values());
      const mspCompanies = allCompanies.filter(c => c.type === "msp").map(c => ({
        id: c.id,
        companyName: c.companyName,
        type: "msp",
      }));
      const clientCompanies = allCompanies
        .filter(c => c.type !== "msp")
        .sort((a, b) => a.companyName.localeCompare(b.companyName))
        .map(c => ({
          id: c.id,
          companyName: c.companyName,
          type: "client",
        }));
      
      res.json({ 
        tenants: [...mspCompanies, ...clientCompanies],
        mspCount: mspCompanies.length,
        clientCount: clientCompanies.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get company details with users (admin only)
  app.get("/api/portal/admin/companies/:id", [authMiddleware, requireAdmin], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const company = portalClients.get(req.params.id);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      
      const users = Array.from(portalUsers.values())
        .filter(u => u.clientId === req.params.id)
        .map(u => ({
          id: u.id,
          email: u.email,
          fullName: u.fullName,
          role: u.role,
          isActive: u.isActive,
        }));
      
      res.json({ company, users });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create new company (admin only)
  app.post("/api/portal/admin/companies", [authMiddleware, requireAdmin, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { companyName, contactEmail, contactPhone, industry, primaryContact } = req.body;
      
      if (!companyName || !contactEmail) {
        return res.status(400).json({ error: "Company name and contact email are required" });
      }
      
      const newCompany = {
        id: randomId(),
        companyName,
        contactEmail,
        contactPhone: contactPhone || null,
        industry: industry || null,
        primaryContact: primaryContact || null,
        status: "active",
        type: "client", // New companies are always clients, not MSP
        createdAt: new Date(),
      };
      
      portalClients.set(newCompany.id, newCompany);
      
      res.json({ success: true, company: newCompany });
      logSecurityEvent("COMPANY_CREATED", req, { companyId: newCompany.id, companyName });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update company (admin only)
  app.put("/api/portal/admin/companies/:id", [authMiddleware, requireAdmin, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const company = portalClients.get(req.params.id);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      
      const { companyName, contactEmail, contactPhone, industry, primaryContact, status } = req.body;
      
      const updatedCompany = {
        ...company,
        companyName: companyName || company.companyName,
        contactEmail: contactEmail || company.contactEmail,
        contactPhone: contactPhone !== undefined ? contactPhone : company.contactPhone,
        industry: industry !== undefined ? industry : company.industry,
        primaryContact: primaryContact !== undefined ? primaryContact : company.primaryContact,
        status: status || company.status,
      };
      
      portalClients.set(req.params.id, updatedCompany);
      
      res.json({ success: true, company: updatedCompany });
      logSecurityEvent("COMPANY_UPDATED", req, { companyId: req.params.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin impersonation - switch to view a company's portal
  app.post("/api/portal/admin/impersonate", [authMiddleware, requireAdmin, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { companyId } = req.body;
      
      if (!companyId) {
        return res.status(400).json({ error: "Company ID required" });
      }
      
      const company = portalClients.get(companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      
      // Generate a special token that includes the impersonated company ID
      const impersonationToken = jwt.sign(
        { 
          userId: req.userId, 
          email: req.user?.email, 
          role: "admin",
          impersonatingCompanyId: companyId,
          impersonatingCompanyName: company.companyName,
        }, 
        jwtSecret(), 
        { expiresIn: '4h' }
      );

      setPortalAuthCookie(res, impersonationToken, 4 * 60 * 60 * 1000);
      
      res.json({ 
        success: true, 
        token: impersonationToken,
        company: {
          id: company.id,
          companyName: company.companyName,
        }
      });
      logSecurityEvent("ADMIN_IMPERSONATION_START", req, { companyId, companyName: company.companyName });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Stop impersonation - return to admin view
  app.post("/api/portal/admin/stop-impersonation", [authMiddleware, requireAdmin], async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Generate a regular admin token without impersonation
      const adminToken = jwt.sign(
        { 
          userId: req.userId, 
          email: req.user?.email, 
          role: "admin",
        }, 
        jwtSecret(), 
        { expiresIn: '24h' }
      );

      setPortalAuthCookie(res, adminToken);
      
      res.json({ success: true, token: adminToken });
      logSecurityEvent("ADMIN_IMPERSONATION_STOP", req, {});
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get tenant-specific files for a company (admin only)
  app.get("/api/portal/admin/companies/:id/files", [authMiddleware, requireAdmin], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const company = portalClients.get(req.params.id);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      
      // Get tenant files from storage - scoped to this company
      const tenantFiles = await storage.getTenantFilesByClientId(req.params.id);
      
      res.json({ files: tenantFiles });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get files for current user's company (regular users + admin impersonation)
  app.get("/api/portal/my-files", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      let clientId: string | null = null;
      let companyName: string = "";
      
      // Check if admin is impersonating a company
      const impersonatingCompanyId = (req.user as any)?.impersonatingCompanyId;
      if (impersonatingCompanyId) {
        const company = portalClients.get(impersonatingCompanyId);
        if (company) {
          clientId = impersonatingCompanyId;
          companyName = company.companyName;
        }
      } else {
        // Regular user - get their company
        const user = portalUsers.get(req.user?.email || "");
        if (user && user.clientId) {
          const company = portalClients.get(user.clientId);
          if (company) {
            clientId = user.clientId;
            companyName = company.companyName;
          }
        }
      }
      
      if (!clientId) {
        return res.json({ files: [], companyName: "Your Company" });
      }
      
      // Get tenant files from storage
      const tenantFiles = await storage.getTenantFilesByClientId(clientId);
      
      res.json({ files: tenantFiles, companyName });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Upload file for a tenant (admin only)
  app.post("/api/portal/admin/companies/:id/files", [authMiddleware, requireAdmin, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const company = portalClients.get(req.params.id);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      
      const { fileName, fileType, category, description, objectPath } = req.body;
      
      if (!fileName || !objectPath) {
        return res.status(400).json({ error: "fileName and objectPath are required" });
      }
      
      const tenantFile = await storage.createTenantFile({
        clientId: req.params.id,
        fileName,
        fileType: fileType || "document",
        category: category || "general",
        description: description || "",
        fileUrl: objectPath,
        uploadedBy: req.userId || "",
      });
      
      res.json({ success: true, file: tenantFile });
      logSecurityEvent("TENANT_FILE_UPLOADED", req, { companyId: req.params.id, fileName });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete tenant file (admin only)
  app.delete("/api/portal/admin/companies/:companyId/files/:fileId", [authMiddleware, requireAdmin], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const deleted = await storage.deleteTenantFile(req.params.fileId);
      if (!deleted) {
        return res.status(404).json({ error: "File not found" });
      }
      
      res.json({ success: true });
      logSecurityEvent("TENANT_FILE_DELETED", req, { companyId: req.params.companyId, fileId: req.params.fileId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get company metrics/stats (admin only)
  app.get("/api/portal/admin/companies/:id/metrics", [authMiddleware, requireAdmin], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const companyId = req.params.id;
      const company = portalClients.get(companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      
      // Calculate metrics from portal data - get tickets from storage
      const allStoredTickets = await storage.getPortalTickets();
      const allTickets = allStoredTickets.filter((t: any) => t.clientId === companyId);
      const openTickets = allTickets.filter((t: any) => t.status === "open").length;
      const resolvedTickets = allTickets.filter((t: any) => t.status === "resolved").length;
      const inProgressTickets = allTickets.filter((t: any) => t.status === "in_progress").length;
      
      const users = Array.from(portalUsers.values()).filter(u => u.clientId === companyId);
      const tenantFiles = await storage.getTenantFilesByClientId(companyId);
      
      // Mock service and invoice data
      const metrics = {
        company: {
          id: company.id,
          name: company.companyName,
          status: company.status,
          createdAt: company.createdAt,
        },
        tickets: {
          total: allTickets.length,
          open: openTickets,
          inProgress: inProgressTickets,
          resolved: resolvedTickets,
          avgResolutionTime: "4.2 hours",
        },
        users: {
          total: users.length,
          activeUsers: users.filter(u => u.isActive).length,
          admins: users.filter(u => u.role === "admin").length,
        },
        files: {
          total: tenantFiles.length,
          agents: tenantFiles.filter(f => f.category === "agents").length,
          documents: tenantFiles.filter(f => f.category === "documents").length,
        },
        services: {
          activeServices: 3,
          monthlyValue: "$1,250.00",
          tier: "Business",
        },
        billing: {
          pendingInvoices: 1,
          totalOwed: "$450.00",
          lastPayment: "2024-12-15",
        },
        activity: {
          lastLogin: new Date().toISOString(),
          ticketsThisMonth: allTickets.filter((t: any) => {
            const ticketDate = new Date(t.createdAt);
            const now = new Date();
            return ticketDate.getMonth() === now.getMonth() && ticketDate.getFullYear() === now.getFullYear();
          }).length,
          filesUploadedThisMonth: tenantFiles.filter(f => {
            const fileDate = new Date(f.createdAt);
            const now = new Date();
            return fileDate.getMonth() === now.getMonth() && fileDate.getFullYear() === now.getFullYear();
          }).length,
        },
      };
      
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===== LEAD QUOTE FORM =====
  app.post("/api/lead-quote", [leadQuoteRateLimiter, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { seats, enterpriseToggle, connectivity, devices, recommendedPlan, firstName, lastName, company, email, consent, source, pageUrl, timestamp } = req.body;
      
      // Corporate email validation
      const domain = email.split('@')[1]?.toLowerCase();
      const blockedDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'msn.com', 'live.com'];
      if (blockedDomains.includes(domain)) {
        return res.status(400).json({ error: "Please use your company email address" });
      }

      // Basic spam prevention - honeypot check
      const honeypot = req.body.website_url;
      if (honeypot) {
        logSecurityEvent("SPAM_DETECTED_HONEYPOT", req, { email });
        return res.status(400).json({ error: "Invalid request" });
      }

      // Store lead
      const leadData = {
        id: randomId(),
        seats,
        enterpriseToggle,
        connectivity,
        devices,
        recommendedPlan,
        firstName,
        lastName,
        company,
        email,
        consent,
        source,
        pageUrl,
        timestamp,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        createdAt: new Date(),
      };

      // Log the lead capture
      logger.info("[LEAD] Quote form submitted", { email, company, recommendedPlan, timestamp });
      logSecurityEvent("LEAD_QUOTE_SUBMITTED", req, { email, company, recommendedPlan });

      // Emit lead event for cross-service handling (email notifications, CRM sync)
      eventBus.emit(EventTypes.LEAD_CREATED, {
        id: leadData.id,
        name: `${firstName} ${lastName}`,
        email,
        company,
        source: source || "quote_wizard",
        message: `Recommended Plan: ${recommendedPlan}, Seats: ${seats}`,
      }, "lead-quote");

      // Push lead to Zoho CRM
      let zohoLeadId = null;
      try {
        const zohoLead = await zohoCRMService.createLead({
          First_Name: firstName,
          Last_Name: lastName,
          Email: email,
          Company: company || 'Not Specified',
          Lead_Source: 'Website Quote Wizard',
          Lead_Status: 'New',
          Description: `Quote Wizard: Recommended Plan: ${recommendedPlan}, Seats: ${seats}, Connectivity: ${connectivity}, Devices: ${devices}`,
        });
        zohoLeadId = (zohoLead as any)?.details?.id || zohoLead?.id;
        console.log("[ZOHO] Quote wizard lead created:", zohoLeadId);
      } catch (zohoError: any) {
        console.error("[ZOHO] Failed to create quote lead (non-blocking):", zohoError.message);
      }

      res.json({
        success: true,
        leadId: leadData.id,
        zohoLeadId,
        message: "Quote request received successfully",
      });
    } catch (error: any) {
      console.error("[ERROR] Lead quote submission failed:", error);
      res.status(500).json({ error: "Failed to process quote request" });
    }
  });

  // ===== PUBLIC VIRTUAL MSP ADVISOR (DE Desk) =====
  app.post("/api/public/advisor/chat", [advisorChatRateLimiter, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { handleAdvisorChat } = await import("./services/msp-advisor");
      const { sessionId, message, pageContext } = req.body || {};
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "message is required" });
      }
      const result = await handleAdvisorChat({
        sessionId: typeof sessionId === "string" ? sessionId : undefined,
        message,
        pageContext:
          pageContext && typeof pageContext === "object"
            ? {
                pathname: String(pageContext.pathname || "/").slice(0, 200),
                pageTitle: pageContext.pageTitle ? String(pageContext.pageTitle).slice(0, 200) : undefined,
                pageType: pageContext.pageType || "other",
                serviceContext: pageContext.serviceContext
                  ? String(pageContext.serviceContext).slice(0, 120)
                  : undefined,
                campaignSource: pageContext.campaignSource
                  ? String(pageContext.campaignSource).slice(0, 80)
                  : undefined,
              }
            : undefined,
      });
      res.json(result);
    } catch (error: any) {
      const status = error?.status || 500;
      console.error("[msp-advisor] chat failed:", error?.message || error);
      res.status(status).json({ error: error?.message || "Advisor unavailable" });
    }
  });

  app.get("/api/public/advisor/session/:id", [advisorPollRateLimiter], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { getSession, publicSessionView } = await import("./services/msp-advisor");
      const session = getSession(req.params.id);
      if (!session) return res.status(404).json({ error: "Session not found" });
      res.json(publicSessionView(session));
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load session" });
    }
  });

  // Public poll so the website widget receives portal agent replies
  app.get("/api/public/advisor/chat/:sessionId/messages", [advisorPollRateLimiter], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { getDeskMessagesSince } = await import("./services/msp-advisor");
      const sessionId = String(req.params.sessionId || "").trim();
      if (!sessionId) return res.status(400).json({ error: "sessionId is required" });
      const since = typeof req.query.since === "string" ? req.query.since : undefined;
      const result = await getDeskMessagesSince(sessionId, since);
      if (!result.session) return res.status(404).json({ error: "Session not found" });
      res.json({
        success: true,
        sessionId,
        messages: result.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          senderName: m.senderName,
          createdAt: m.createdAt,
        })),
        agentLive: result.agentLive,
        agentName: result.agentName,
        updatedAt: result.session.updatedAt,
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to poll messages" });
    }
  });

  app.post("/api/public/advisor/action", [advisorActionRateLimiter, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        getSession,
        buildLeadSummary,
        isAllowedActionType,
        materializeAction,
        DE_COMPANY,
        upsertDeskSession,
      } = await import("./services/msp-advisor");
      const { sessionId, action, payload } = req.body || {};
      if (!sessionId || typeof sessionId !== "string") {
        return res.status(400).json({ error: "sessionId is required" });
      }
      if (!isAllowedActionType(action)) {
        return res.status(400).json({ error: "Invalid action" });
      }

      const session = getSession(sessionId);
      if (!session) return res.status(404).json({ error: "Session not found" });

      const honeypot = req.body?.website_url;
      if (honeypot) {
        logSecurityEvent("SPAM_DETECTED_HONEYPOT", req, { source: "advisor_action" });
        return res.status(400).json({ error: "Invalid request" });
      }

      if (
        action === "schedule_consultation" ||
        action === "open_portal" ||
        action === "existing_client_support" ||
        action === "contact_sales" ||
        action === "navigate"
      ) {
        const materialized = materializeAction(action, undefined, payload?.path);
        if (!materialized) return res.status(400).json({ error: "Action not allowed" });
        return res.json({ success: true, action: materialized });
      }

      const name = String(payload?.name || session.profile.contactName || "").trim();
      const email = String(payload?.email || session.profile.email || "").trim();
      const phone = String(payload?.phone || session.profile.phone || "").trim();
      const company = String(payload?.company || session.profile.companyName || "").trim();
      const visitorMessage = String(payload?.message || "").trim();

      if (email) {
        try {
          await upsertDeskSession({
            sessionId,
            email,
            contactName: name || null,
            companyName: company || null,
            pagePath: session.pageContext?.pathname || null,
          });
        } catch {}
      }

      if (action === "leave_message") {
        if (!email || !visitorMessage) {
          return res.status(400).json({ error: "email and message are required" });
        }
        const summary = buildLeadSummary(session.profile, session.messages);
        try {
          if (zohoDeskService?.createTicket) {
            await zohoDeskService.createTicket({
              subject: `Advisor chat message from ${email}`,
              description: `${visitorMessage}\n\n---\n${summary}`,
              email,
              priority: "Medium",
            } as any);
          }
        } catch (e: any) {
          console.error("[msp-advisor] desk ticket failed (non-blocking):", e?.message);
        }
        await notificationService.sendNewLeadNotification({
          name: name || email,
          email,
          company: company || "Advisor chat",
          phone: phone || "",
          source: "Virtual MSP Advisor",
          message: `${visitorMessage}\n\n${summary}`,
        });
        logSecurityEvent("ADVISOR_LEAVE_MESSAGE", req, { email });
        return res.json({ success: true, message: "Message received" });
      }

      if (!email || !name) {
        return res.status(400).json({
          error: "name and email are required",
          needs: ["name", "email"],
        });
      }

      const summary = buildLeadSummary(session.profile, session.messages);
      const leadId = randomId();
      const sourceLabel =
        action === "request_assessment"
          ? "Virtual MSP Advisor — Assessment"
          : action === "request_callback"
            ? "Virtual MSP Advisor — Callback"
            : "Virtual MSP Advisor — Lead";

      eventBus.emit(
        EventTypes.LEAD_CREATED,
        {
          id: leadId,
          name,
          email,
          company: company || "",
          source: sourceLabel,
          message: summary,
        },
        "msp-advisor",
      );

      let zohoLeadId = null;
      try {
        const nameParts = name.trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || name;
        const zohoLead = await zohoCRMService.createLead({
          First_Name: firstName,
          Last_Name: lastName,
          Email: email,
          Phone: phone || "",
          Company: company || "Not Specified",
          Lead_Source: sourceLabel,
          Lead_Status: "New",
          Description: summary.slice(0, 32000),
        });
        zohoLeadId = (zohoLead as any)?.details?.id || zohoLead?.id;
      } catch (zohoError: any) {
        console.error("[msp-advisor] Zoho lead failed (non-blocking):", zohoError?.message);
      }

      await notificationService.sendNewLeadNotification({
        name,
        email,
        company: company || "Not Specified",
        phone: phone || "",
        source: sourceLabel,
        message: summary,
      });

      session.profile.contactName = name;
      session.profile.email = email;
      if (phone) session.profile.phone = phone;
      if (company) session.profile.companyName = company;

      logSecurityEvent("ADVISOR_LEAD_CREATED", req, { email, action, leadId });
      return res.json({
        success: true,
        leadId,
        zohoLeadId,
        phone: DE_COMPANY.phoneDisplay,
        bookingUrl: DE_COMPANY.bookingUrl,
        message: "Thanks — our team will follow up with this conversation context.",
      });
    } catch (error: any) {
      console.error("[msp-advisor] action failed:", error?.message || error);
      res.status(500).json({ error: "Failed to execute action" });
    }
  });

  // ===== ASSESSMENT / LEAD CAPTURE FORM =====
  app.post("/api/assessment", [leadQuoteRateLimiter, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { fullName, email, phone, company, source } = req.body;

      if (!fullName || !email) {
        return res.status(400).json({ error: "Name and email are required" });
      }

      const honeypot = req.body.website_url;
      if (honeypot) {
        logSecurityEvent("SPAM_DETECTED_HONEYPOT", req, { email });
        return res.status(400).json({ error: "Invalid request" });
      }

      const leadId = randomId();
      logger.info("[ASSESSMENT] Form submitted", { fullName, email, company, source, timestamp: new Date().toISOString() });
      logSecurityEvent("ASSESSMENT_SUBMITTED", req, { email, source: source || "hero_form" });

      eventBus.emit(EventTypes.LEAD_CREATED, {
        id: leadId,
        name: fullName,
        email,
        company: company || "",
        source: source || "hero_assessment",
        message: `Assessment request from ${source || "hero_form"}`,
      }, "assessment-form");

      let zohoLeadId = null;
      try {
        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || fullName;

        const zohoLead = await zohoCRMService.createLead({
          First_Name: firstName,
          Last_Name: lastName,
          Email: email,
          Phone: phone || '',
          Company: company || 'Not Specified',
          Lead_Source: source === 'lead_form' ? 'Website Lead Form' : 'Website Assessment',
          Lead_Status: 'New',
          Description: `Free assessment request submitted from ${source || "homepage hero"}`,
        });
        zohoLeadId = (zohoLead as any)?.details?.id || zohoLead?.id;
        console.log("[ZOHO] Assessment lead created:", zohoLeadId);
      } catch (zohoError: any) {
        console.error("[ZOHO] Failed to create assessment lead (non-blocking):", zohoError.message);
      }

      res.json({
        success: true,
        leadId,
        zohoLeadId,
        message: "Assessment request received successfully",
      });
    } catch (error: any) {
      console.error("[ERROR] Assessment form submission failed:", error);
      res.status(500).json({ error: "Failed to process assessment request" });
    }
  });

  // ===== CONTACT FORM =====
  app.post("/api/contact", [leadQuoteRateLimiter, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, email, phone, company, service, message } = req.body;
      
      // Basic validation
      if (!name || !email || !phone) {
        return res.status(400).json({ error: "Name, email, and phone are required" });
      }

      // Basic spam prevention - honeypot check
      const honeypot = req.body.website_url;
      if (honeypot) {
        logSecurityEvent("SPAM_DETECTED_HONEYPOT", req, { email });
        return res.status(400).json({ error: "Invalid request" });
      }

      // Store contact submission
      const contactData = {
        id: randomId(),
        name,
        email,
        phone,
        company: company || null,
        service: service || null,
        message: message || null,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        createdAt: new Date(),
      };

      // Log the contact form submission
      logger.info("[CONTACT] Form submitted", { name, email, company, service, timestamp: new Date().toISOString() });
      logSecurityEvent("CONTACT_FORM_SUBMITTED", req, { email, company, service });

      // Emit contact event for cross-service handling (email notifications)
      eventBus.emit(EventTypes.CONTACT_FORM_SUBMITTED, {
        id: contactData.id,
        name,
        email,
        company,
        phone,
        message,
        source: "contact_form",
      }, "contact-form");

      // Push lead to Zoho CRM
      let zohoLeadId = null;
      try {
        const nameParts = name.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || name;
        
        const zohoLead = await zohoCRMService.createLead({
          First_Name: firstName,
          Last_Name: lastName,
          Email: email,
          Phone: phone,
          Company: company || 'Not Specified',
          Lead_Source: 'Website Contact Form',
          Description: message || '',
          Lead_Status: 'New',
        });
        zohoLeadId = (zohoLead as any)?.details?.id || (zohoLead as any)?.id;
        console.log("[ZOHO] Lead created:", zohoLeadId);
      } catch (zohoError: any) {
        console.error("[ZOHO] Failed to create lead (non-blocking):", zohoError.message);
        // Don't fail the request if Zoho fails - the form submission is still valid
      }

      res.json({
        success: true,
        contactId: contactData.id,
        zohoLeadId,
        message: "Message received successfully",
      });
    } catch (error: any) {
      console.error("[ERROR] Contact form submission failed:", error);
      res.status(500).json({ error: "Failed to process contact request" });
    }
  });

  // ===== NEWSLETTER SUBSCRIPTION =====
  app.post("/api/newsletter", [leadQuoteRateLimiter, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Please enter a valid email address" });
      }

      // Basic spam prevention - honeypot check
      const honeypot = req.body.website_url;
      if (honeypot) {
        logSecurityEvent("SPAM_DETECTED_HONEYPOT", req, { email });
        return res.status(400).json({ error: "Invalid request" });
      }

      // Store newsletter subscription
      const subscriptionData = {
        id: randomId(),
        email,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        subscribedAt: new Date(),
      };

      // Log the newsletter subscription
      console.log("[NEWSLETTER] Subscription:", { email, timestamp: new Date().toISOString() });
      logSecurityEvent("NEWSLETTER_SUBSCRIBED", req, { email });

      eventBus.emit(EventTypes.LEAD_CREATED, {
        id: subscriptionData.id,
        name: email.split("@")[0],
        email,
        company: "",
        source: "newsletter",
        message: "Newsletter signup",
      }, "newsletter-form");

      // Push to Zoho CRM as a lead with newsletter source
      let zohoLeadId = null;
      try {
        // Check if lead already exists
        const existingLead = await zohoCRMService.getLeadByEmail(email);
        if (!existingLead) {
          const zohoLead = await zohoCRMService.createLead({
            Last_Name: email.split('@')[0], // Use email prefix as name
            Email: email,
            Lead_Source: 'Newsletter Signup',
            Lead_Status: 'New',
            Description: 'Subscribed to newsletter',
          });
          zohoLeadId = (zohoLead as any)?.details?.id || (zohoLead as any)?.id;
          console.log("[ZOHO] Newsletter lead created:", zohoLeadId);
        } else {
          console.log("[ZOHO] Lead already exists for:", email);
        }
      } catch (zohoError: any) {
        console.error("[ZOHO] Failed to create newsletter lead (non-blocking):", zohoError.message);
        // Don't fail the request if Zoho fails
      }

      // Confirmation / welcome email (ZeptoMail) — warms engagement + List-Unsubscribe
      notificationService.sendNewsletterWelcome({ email }).catch((err) => {
        console.warn("[NEWSLETTER] Welcome email failed (non-blocking):", err?.message || err);
      });

      res.json({
        success: true,
        subscriptionId: subscriptionData.id,
        zohoLeadId,
        message: "Successfully subscribed to newsletter",
      });
    } catch (error: any) {
      console.error("[ERROR] Newsletter subscription failed:", error);
      res.status(500).json({ error: "Failed to process subscription" });
    }
  });

  // ========== STORE CART ROUTES ==========
  
  // In-memory cart storage (per user session)
  const userCarts: Map<string, { productId: string; quantity: number; name: string; price: number; sku: string }[]> = new Map();
  
  // Add item to cart
  app.post("/api/store/cart/add", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { productId, quantity, name, price, sku } = req.body;
      
      if (!productId || !quantity || quantity < 1) {
        return res.status(400).json({ error: "Product ID and valid quantity are required" });
      }
      
      const userId = req.userId || "anonymous";
      const cart = userCarts.get(userId) || [];
      
      // Check if item already exists in cart
      const existingIndex = cart.findIndex(item => item.productId === productId);
      if (existingIndex >= 0) {
        cart[existingIndex].quantity += quantity;
      } else {
        cart.push({ productId, quantity, name: name || "Product", price: price || 0, sku: sku || "" });
      }
      
      userCarts.set(userId, cart);
      
      logSecurityEvent("CART_ITEM_ADDED", req, { 
        productId, 
        quantity, 
        userId,
        clientId: req.user?.clientId,
        cartItemCount: cart.length
      });
      
      res.json({ success: true, cart, itemCount: cart.length });
    } catch (error: any) {
      console.error("[CART ADD ERROR]", error);
      res.status(500).json({ error: "Failed to add item to cart" });
    }
  });
  
  // Remove item from cart
  app.post("/api/store/cart/remove", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { productId, quantity } = req.body;
      
      if (!productId) {
        return res.status(400).json({ error: "Product ID is required" });
      }
      
      const userId = req.userId || "anonymous";
      let cart = userCarts.get(userId) || [];
      
      const existingIndex = cart.findIndex(item => item.productId === productId);
      if (existingIndex >= 0) {
        if (quantity && quantity < cart[existingIndex].quantity) {
          cart[existingIndex].quantity -= quantity;
        } else {
          cart = cart.filter(item => item.productId !== productId);
        }
      }
      
      userCarts.set(userId, cart);
      
      logSecurityEvent("CART_ITEM_REMOVED", req, { 
        productId, 
        userId,
        clientId: req.user?.clientId,
        cartItemCount: cart.length
      });
      
      res.json({ success: true, cart, itemCount: cart.length });
    } catch (error: any) {
      console.error("[CART REMOVE ERROR]", error);
      res.status(500).json({ error: "Failed to remove item from cart" });
    }
  });
  
  // Clear cart
  app.post("/api/store/cart/clear", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId || "anonymous";
      const previousCart = userCarts.get(userId) || [];
      
      userCarts.delete(userId);
      
      logSecurityEvent("CART_CLEARED", req, { 
        userId,
        clientId: req.user?.clientId,
        clearedItemCount: previousCart.length
      });
      
      res.json({ success: true, cart: [], itemCount: 0 });
    } catch (error: any) {
      console.error("[CART CLEAR ERROR]", error);
      res.status(500).json({ error: "Failed to clear cart" });
    }
  });
  
  // Get cart contents
  app.get("/api/store/cart", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId || "anonymous";
      const cart = userCarts.get(userId) || [];
      res.json({ cart, itemCount: cart.length });
    } catch (error: any) {
      console.error("[CART GET ERROR]", error);
      res.status(500).json({ error: "Failed to get cart" });
    }
  });

  // ========== STORE CHECKOUT ROUTES ==========

  // Checkout and order creation are registered earlier via secureStoreCheckout.ts.
  // Keep only the read/confirmation routes here so there is one authoritative write path.

  // Get order by ID (auth) or payment session ID (post-checkout confirmation only)
  app.get("/api/store/orders/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { db } = await import("./db");
      const { storeOrders } = await import("@shared/schema");
      const { eq, or } = await import("drizzle-orm");
      
      const [order] = await db.select().from(storeOrders).where(
        or(
          eq(storeOrders.id, id),
          eq(storeOrders.stripeSessionId, id),
          eq(storeOrders.zohoPaymentSessionId, id)
        )
      ).limit(1);
      
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Post-checkout confirmation requires proof of possession: the HMAC
      // confirmation token issued with the checkout session (`ct` query param).
      // Knowing an order id or payment session id alone (browser history,
      // Referer, logs) no longer returns customer billing details.
      const { isValidOrderConfirmationToken } = await import("./orderConfirmationToken");
      if (isValidOrderConfirmationToken(order.id, req.query.ct)) {
        // Redacted payload: exactly what the confirmation page renders.
        return res.json({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentMethod: order.paymentMethod,
          lineItems: order.lineItems,
          subtotal: order.subtotal,
          tax: order.tax,
          total: order.total,
          billingEmail: order.billingEmail,
          billingName: order.billingName,
          billingCompany: order.billingCompany,
          paidAt: order.paidAt,
          createdAt: order.createdAt,
        });
      }

      // Full order record requires ownership
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (!token) {
        return res.status(401).json({ error: "Authentication required" });
      }
      let decoded: JWTPayload;
      try {
        decoded = jwt.verify(token, jwtSecret()) as JWTPayload;
      } catch {
        return res.status(401).json({ error: "Invalid token" });
      }
      const isAdmin = decoded.role === "admin";
      const ownsOrder =
        (decoded.userId && order.userId === decoded.userId) ||
        (decoded.clientId && order.clientId === decoded.clientId);
      if (!isAdmin && !ownsOrder) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(order);
    } catch (error: any) {
      console.error("[GET ORDER ERROR]", error);
      res.status(500).json({ error: error.message || "Failed to get order" });
    }
  });

  // ========== STORE QUOTE REQUESTS ==========

  // Create quote request - allows all authenticated users (any role can request a quote)
  app.post("/api/store/quote-requests", [authMiddleware, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { contactName, contactEmail, contactPhone, companyName, message, requestedItems } = req.body;
      
      if (!contactName || !contactEmail) {
        return res.status(400).json({ error: "Contact name and email are required" });
      }

      const { canonicalizeQuoteItems } = await import("./storeQuoteCommerce");
      const { insertQuoteRequest } = await import("./storeQuoteStore");
      const { resolveClientPricingRows: resolveQuotePricing, toPriceOverrides: toQuoteOverrides } = await import("./storeClientPricing");
      const pricingRows = await resolveQuotePricing(req.user?.clientId);
      let canonicalItems;
      try {
        canonicalItems = canonicalizeQuoteItems(requestedItems, toQuoteOverrides(pricingRows));
      } catch (error: any) {
        return res.status(400).json({ error: error?.message || "Invalid quote items" });
      }

      const quoteRequest = await insertQuoteRequest({
        userId: req.userId || null,
        clientId: req.user?.clientId || null,
        contactName,
        contactEmail,
        contactPhone: contactPhone || null,
        companyName: companyName || null,
        message: message || null,
        requestedItems: canonicalItems,
      });

      console.log(`[QUOTE REQUEST] Created: ${quoteRequest.quoteNumber} for ${contactEmail}`);

      void eventBus.emit(EventTypes.QUOTE_REQUESTED, {
        id: quoteRequest.id,
        quoteId: quoteRequest.id,
        quoteNumber: quoteRequest.quoteNumber,
        contactName,
        contactEmail,
        contactPhone,
        companyName,
        message,
        source: "store_quote",
        canonicalAccountId: req.user?.clientId ? portalClients.get(req.user.clientId)?.hubAccountId : null,
      });

      void import("./storeQuoteCrm")
        .then(({ syncStoreQuoteToCrm }) => syncStoreQuoteToCrm(quoteRequest))
        .catch((error: any) => {
          console.warn("[store-quote] CRM sync skipped:", error?.message || error);
        });
      
      logSecurityEvent("QUOTE_REQUESTED", req, { 
        quoteId: quoteRequest.id, 
        quoteNumber: quoteRequest.quoteNumber,
        clientId: req.user?.clientId,
        userId: req.userId,
        contactEmail,
        companyName,
        itemCount: canonicalItems.length,
        items: canonicalItems.map((item) => ({ id: item.productId, name: item.name, quantity: item.quantity })),
      });

      res.json({
        id: quoteRequest.id,
        quoteNumber: quoteRequest.quoteNumber,
        pdfUrl: `/api/store/quote-requests/${quoteRequest.id}/pdf`,
        message: "Quote request submitted successfully",
      });
    } catch (error: any) {
      console.error("[CREATE QUOTE REQUEST ERROR]", error);
      res.status(500).json({ error: error.message || "Failed to create quote request" });
    }
  });

  const canAccessQuote = (req: AuthenticatedRequest, quoteRequest: { userId: string | null; clientId: string | null; contactEmail: string | null }) => {
    const isAdmin = req.user?.role === "admin";
    const ownsQuote =
      (req.userId && quoteRequest.userId === req.userId) ||
      (req.user?.clientId && quoteRequest.clientId === req.user.clientId) ||
      (req.user?.email &&
        quoteRequest.contactEmail?.toLowerCase() === req.user.email.toLowerCase());
    return { isAdmin, ownsQuote: !!(isAdmin || ownsQuote) };
  };

  app.get("/api/store/quote-requests/:id/pdf", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { getQuoteRequest } = await import("./storeQuoteStore");
      const { buildQuotePdf } = await import("./storeQuotePdf");
      const quoteRequest = await getQuoteRequest(req.params.id);
      if (!quoteRequest) {
        return res.status(404).json({ error: "Quote request not found" });
      }
      const { ownsQuote } = canAccessQuote(req, quoteRequest);
      if (!ownsQuote) {
        return res.status(403).json({ error: "Access denied" });
      }

      const pdf = buildQuotePdf(quoteRequest);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${quoteRequest.quoteNumber}.pdf"`);
      return res.send(pdf);
    } catch (error: any) {
      console.error("[GET QUOTE PDF ERROR]", error);
      return res.status(500).json({ error: "Failed to generate quote PDF" });
    }
  });

  // Get quote request by ID — authenticated owner or admin only
  app.get("/api/store/quote-requests/:id", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { getQuoteRequest } = await import("./storeQuoteStore");
      const quoteRequest = await getQuoteRequest(req.params.id);
      
      if (!quoteRequest) {
        return res.status(404).json({ error: "Quote request not found" });
      }

      const { isAdmin, ownsQuote } = canAccessQuote(req, quoteRequest);
      if (!ownsQuote) {
        return res.status(403).json({ error: "Access denied" });
      }

      const payload = {
        ...quoteRequest,
        pdfUrl: `/api/store/quote-requests/${quoteRequest.id}/pdf`,
      };

      // Never return internal assignment fields to non-admins
      if (!isAdmin) {
        const { assignedTo, ...clientSafe } = payload;
        return res.json(clientSafe);
      }

      res.json(payload);
    } catch (error: any) {
      console.error("[GET QUOTE REQUEST ERROR]", error);
      res.status(500).json({ error: error.message || "Failed to get quote request" });
    }
  });

  // Zoho Payments status check (admin only — avoids public config probing)
  app.get("/api/store/payment-status", [authMiddleware, requireAdmin], async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const { zohoPayments } = await import("./zohoPayments");
      res.json({ 
        configured: zohoPayments.isConfigured(),
        provider: "zoho_payments"
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to check payment status" });
    }
  });

  // ========== ZOHO API ROUTES ==========

  // Check Zoho connection status
  app.get("/api/zoho/status", async (req: Request, res: Response) => {
    try {
      const isConfigured = zohoClient.isConfigured();
      if (!isConfigured) {
        return res.json({ connected: false, message: "Zoho API not configured" });
      }
      
      await zohoClient.getAccessToken();
      res.json({ connected: true, message: "Zoho API connected" });
    } catch (error: any) {
      res.json({ connected: false, message: error.message });
    }
  });

  // ========== ZOHO DESK ROUTES ==========

  // Get all tickets (admin)
  app.get("/api/zoho/desk/tickets", [authMiddleware, requireAdmin], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { status, limit, from } = req.query;
      const result = await zohoDeskService.getTickets({
        status: status as string,
        limit: limit ? parseInt(limit as string) : undefined,
        from: from ? parseInt(from as string) : undefined,
      });
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get ticket by ID
  app.get("/api/zoho/desk/tickets/:id", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const ticket = await zohoDeskService.getTicketById(req.params.id);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      res.json(ticket);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create ticket
  app.post("/api/zoho/desk/tickets", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { subject, description, priority } = req.body;
      
      if (!subject || !description) {
        return res.status(400).json({ error: "Subject and description required" });
      }

      // Check for existing contact or create one if needed
      let contactId: string | undefined;
      const contact = await zohoDeskService.getContactByEmail(req.user?.email);
      if (contact) {
        contactId = contact.id;
      }
      
      const ticket = await zohoDeskService.createTicket({
        subject,
        description,
        contactId, // Use contactId if we found one
        email: req.user?.email,
        priority: priority || "Medium",
      });
      
      res.json(ticket);
    } catch (error: any) {
      console.error("[ZOHO TICKET ERROR]", error.response?.data || error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Public DE Desk ticket — Zoho Desk is the system of record; portal is a secondary copy.
  app.post("/api/portal/zoho/ticket", [widgetTicketRateLimiter, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email, subject, description, priority, sessionId: advisorSessionId, name } = req.body;

      if (!email || !subject || !description) {
        return res.status(400).json({ error: "Email, subject, and description are required" });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email address" });
      }

      if (subject.length > 200 || description.length > 5000) {
        return res.status(400).json({ error: "Subject or description too long" });
      }

      const priorityValue = priority || "Medium";
      const priorityLower = String(priorityValue).toLowerCase();

      if (!zohoClient.isDeskConfigured()) {
        console.error("[WIDGET TICKET] Zoho Desk is not configured");
        return res.status(503).json({
          error: "Support desk is temporarily unavailable. Please try again.",
        });
      }

      const { firstName, lastName } = splitVisitorName(
        typeof name === "string" ? name : undefined,
        String(email),
      );

      let zohoTicket;
      try {
        zohoTicket = await zohoDeskService.createTicket({
          subject,
          description,
          email,
          firstName,
          lastName,
          priority: priorityValue,
        });
      } catch (zohoErr: any) {
        console.error("[WIDGET TICKET] Zoho Desk create failed:", zohoErr?.message || zohoErr);
        return res.status(502).json({
          error: "We couldn't open the ticket right now. Please try again.",
        });
      }

      if (!zohoTicket?.id) {
        console.error("[WIDGET TICKET] Zoho Desk returned no ticket id");
        return res.status(502).json({
          error: "We couldn't open the ticket right now. Please try again.",
        });
      }

      const zohoTicketId = zohoTicket.id;
      const ticketNumber =
        zohoTicket.ticketNumber ||
        `TKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
      console.log(`✅ Widget ticket created in Zoho Desk: ${zohoTicketId}`);

      // Secondary: local portal ticket when the email maps to a portal account (FK-safe).
      try {
        if (typeof advisorSessionId === "string" && advisorSessionId.trim()) {
          try {
            const { upsertDeskSession } = await import("./services/msp-advisor");
            await upsertDeskSession({
              sessionId: advisorSessionId.trim(),
              email: String(email).toLowerCase(),
            });
          } catch {}
        }

        const portalUser = portalUsers.get(email);
        if (portalUser?.clientId && portalUser?.id) {
          let descriptionWithChat = description;
          if (typeof advisorSessionId === "string" && advisorSessionId.trim()) {
            descriptionWithChat = `${description}\n\n---\nDE Desk session: ${advisorSessionId.trim()}`;
          }
          const localTicket = await storage.createPortalTicket({
            clientId: portalUser.clientId,
            createdBy: portalUser.id,
            ticketNumber,
            subject,
            description: descriptionWithChat,
            status: "open",
            priority: priorityLower === "high" || priorityLower === "urgent" ? "high" : priorityLower === "low" ? "low" : "medium",
            category: "de-desk",
          });

          try {
            await storage.updatePortalTicket(localTicket.id, { assignedTo: `zoho:${zohoTicketId}` });
          } catch {}
          console.log(`✅ Widget ticket mirrored to portal: ${ticketNumber}`);
        }
      } catch (localErr: any) {
        console.warn("Could not mirror widget ticket to portal:", localErr?.message || localErr);
      }

      res.json({
        success: true,
        ticketNumber,
        zohoTicketId,
        message: "Your support request has been received.",
      });
      logSecurityEvent("WIDGET_TICKET_CREATED", req, { email, ticketNumber, zohoTicketId });
    } catch (error: any) {
      console.error("[WIDGET TICKET ERROR]", error);
      res.status(500).json({ error: "Failed to create ticket. Please try again." });
    }
  });

  // Get my tickets (for logged in user)
  app.get("/api/zoho/desk/my-tickets", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contact = await zohoDeskService.getContactByEmail(req.user?.email);
      if (!contact) {
        return res.json({ tickets: [], count: 0 });
      }
      
      const tickets = await zohoDeskService.getTicketsByContact(contact.id);
      res.json({ tickets, count: tickets.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get Desk departments
  app.get("/api/zoho/desk/departments", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const departments = await zohoDeskService.getDepartments();
      res.json({ departments });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== ZOHO CRM ROUTES ==========

  // Get CRM accounts (companies)
  app.get("/api/zoho/crm/accounts", [authMiddleware, requireAdmin], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { page, per_page } = req.query;
      const result = await zohoCRMService.getAccounts({
        page: page ? parseInt(page as string) : undefined,
        per_page: per_page ? parseInt(per_page as string) : undefined,
      });
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get CRM account by ID
  app.get("/api/zoho/crm/accounts/:id", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const account = await zohoCRMService.getAccountById(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      res.json(account);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get CRM contacts
  app.get("/api/zoho/crm/contacts", [authMiddleware, requireAdmin], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { page, per_page } = req.query;
      const result = await zohoCRMService.getContacts({
        page: page ? parseInt(page as string) : undefined,
        per_page: per_page ? parseInt(per_page as string) : undefined,
      });
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get CRM deals
  app.get("/api/zoho/crm/deals", [authMiddleware, requireAdmin], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { page, per_page } = req.query;
      const result = await zohoCRMService.getDeals({
        page: page ? parseInt(page as string) : undefined,
        per_page: per_page ? parseInt(per_page as string) : undefined,
      });
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== ZOHO BILLING ROUTES ==========

  // Get subscriptions
  app.get("/api/zoho/billing/subscriptions", [authMiddleware, requireAdmin], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { status, page, per_page } = req.query;
      const result = await zohoBillingService.getSubscriptions({
        status: status as string,
        page: page ? parseInt(page as string) : undefined,
        per_page: per_page ? parseInt(per_page as string) : undefined,
      });
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get my subscription (for logged in user)
  app.get("/api/zoho/billing/my-subscription", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const customer = await zohoBillingService.getCustomerByEmail(req.user?.email);
      if (!customer) {
        return res.json({ subscriptions: [], customer: null });
      }
      
      const subscriptions = await zohoBillingService.getSubscriptionsByCustomer(customer.customer_id);
      res.json({ subscriptions, customer });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get invoices
  app.get("/api/zoho/billing/invoices", [authMiddleware, requireAdmin], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { status, page, per_page } = req.query;
      const result = await zohoBillingService.getInvoices({
        status: status as string,
        page: page ? parseInt(page as string) : undefined,
        per_page: per_page ? parseInt(per_page as string) : undefined,
      });
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get my invoices (for logged in user)
  app.get("/api/zoho/billing/my-invoices", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const customer = await zohoBillingService.getCustomerByEmail(req.user?.email);
      if (!customer) {
        return res.json({ invoices: [] });
      }
      
      const invoices = await zohoBillingService.getInvoicesByCustomer(customer.customer_id);
      res.json({ invoices });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get billing plans
  app.get("/api/zoho/billing/plans", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const plans = await zohoBillingService.getPlans();
      res.json({ plans });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== STORE CLIENT AUTH ROUTES ==========

  const {
    listDemoClientPricing,
    removeDemoClientPricing,
    resolveClientPricingRows,
    toPriceOverrides,
    upsertDemoClientPricing,
  } = await import("./storeClientPricing");

  // Get client info for store (returns client type)
  app.get("/api/store/client-info", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userEmail = req.user?.email;
      if (!userEmail) {
        return res.json({ clientType: "public", clientId: null });
      }

      const user = portalUsers.get(userEmail);
      if (!user || !user.clientId) {
        return res.json({ clientType: "public", clientId: null });
      }

      const client = portalClients.get(user.clientId);
      if (!client) {
        return res.json({ clientType: "public", clientId: null });
      }

      const serviceType = client.serviceType || "public";
      const clientType = serviceType === "managed" ? "managed" : 
                         serviceType === "comanaged" ? "comanaged" : "public";

      res.json({
        clientType,
        clientId: user.clientId,
        companyName: client.companyName,
      });
    } catch (error: any) {
      console.error("[ERROR] Failed to get client info:", error);
      res.status(500).json({ error: "Failed to get client info" });
    }
  });

  // Get client-specific pricing
  app.get("/api/store/client-pricing", [authMiddleware], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userEmail = req.user?.email;
      if (!userEmail) {
        return res.json({ pricing: [] });
      }

      const user = portalUsers.get(userEmail);
      if (!user || !user.clientId) {
        return res.json({ pricing: [] });
      }

      const pricing = await resolveClientPricingRows(user.clientId);
      res.json({ pricing });
    } catch (error: any) {
      console.error("[ERROR] Failed to get client pricing:", error);
      res.status(500).json({ error: "Failed to get client pricing" });
    }
  });

  // ========== ADMIN PRICING ROUTES ==========
  
  // In-memory product pricing store (productId -> basePrice)
  const productPricing: Map<string, number> = new Map();
  
  // Update product pricing (admin only)
  app.post("/api/admin/pricing/update", [authMiddleware, requireAdmin, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { productId, newPrice } = req.body;
      
      if (!productId || newPrice === undefined || newPrice < 0) {
        return res.status(400).json({ error: "Product ID and valid price are required" });
      }
      
      const oldPrice = productPricing.get(productId) || 0;
      productPricing.set(productId, newPrice);
      
      logSecurityEvent("PRICING_UPDATED", req, { 
        productId, 
        oldPrice, 
        newPrice, 
        adminId: req.userId,
        adminEmail: req.user?.email
      });
      
      res.json({ success: true, productId, oldPrice, newPrice });
    } catch (error: any) {
      console.error("[PRICING UPDATE ERROR]", error);
      res.status(500).json({ error: "Failed to update pricing" });
    }
  });
  
  // Set client-specific pricing (admin only)
  app.post("/api/admin/client-pricing/set", [authMiddleware, requireAdmin, validateInput], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { clientId, productId, customPrice, discountPercent } = req.body;
      
      if (!clientId || !productId) {
        return res.status(400).json({ error: "Client ID and Product ID are required" });
      }
      
      if (customPrice === undefined && discountPercent === undefined) {
        return res.status(400).json({ error: "Either custom price or discount percent is required" });
      }
      
      const existingPricing = listDemoClientPricing(clientId);
      const oldPricing = existingPricing.find((row) => row.productId === productId) || null;
      const newPricingEntry = upsertDemoClientPricing(clientId, {
        productId,
        customPrice: customPrice || oldPricing?.customPrice || 0,
        discountPercent: discountPercent !== undefined ? discountPercent : (oldPricing?.discountPercent || 0),
      });
      
      logSecurityEvent("CLIENT_PRICING_SET", req, { 
        clientId, 
        productId, 
        oldPrice: oldPricing?.customPrice,
        oldDiscount: oldPricing?.discountPercent,
        newPrice: newPricingEntry.customPrice,
        discount: newPricingEntry.discountPercent, 
        adminId: req.userId,
        adminEmail: req.user?.email
      });
      
      res.json({ success: true, clientId, productId, pricing: newPricingEntry });
    } catch (error: any) {
      console.error("[CLIENT PRICING SET ERROR]", error);
      res.status(500).json({ error: "Failed to set client pricing" });
    }
  });
  
  // Get all client pricing (admin only)
  app.get("/api/admin/client-pricing/:clientId", [authMiddleware, requireAdmin], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { clientId } = req.params;
      const pricing = await resolveClientPricingRows(clientId);
      
      res.json({ clientId, pricing });
    } catch (error: any) {
      console.error("[GET CLIENT PRICING ERROR]", error);
      res.status(500).json({ error: "Failed to get client pricing" });
    }
  });
  
  // Delete client-specific pricing (admin only)
  app.delete("/api/admin/client-pricing/:clientId/:productId", [authMiddleware, requireAdmin], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { clientId, productId } = req.params;
      
      const oldPricing = removeDemoClientPricing(clientId, productId);
      
      logSecurityEvent("CLIENT_PRICING_REMOVED", req, { 
        clientId, 
        productId, 
        oldPrice: oldPricing?.customPrice,
        oldDiscount: oldPricing?.discountPercent,
        adminId: req.userId,
        adminEmail: req.user?.email
      });
      
      res.json({ success: true, clientId, productId });
    } catch (error: any) {
      console.error("[DELETE CLIENT PRICING ERROR]", error);
      res.status(500).json({ error: "Failed to delete client pricing" });
    }
  });

  // ===== EMAIL TEST ENDPOINT (Admin only) =====
  app.post("/api/admin/test-email", [authMiddleware, requireAdmin], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await notificationService.testEmailConnection();
      logger.info("Email test requested", { 
        success: result.success, 
        adminEmail: req.user?.email 
      });
      res.json(result);
    } catch (error: any) {
      logger.error("Email test failed", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Email status — admin only (do not advertise mail config publicly)
  app.get("/api/email-status", [authMiddleware, requireAdmin], async (_req: AuthenticatedRequest, res: Response) => {
    const hasToken = !!process.env.ZEPTOMAIL_API_TOKEN;
    res.json({
      configured: hasToken,
      provider: "ZeptoMail",
      sender: "noreply@digeratiexperts.com",
    });
  });

  return app;
}
