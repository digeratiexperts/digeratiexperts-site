import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  FolderLock,
  HelpCircle,
  KeyRound,
  LayoutGrid,
  LifeBuoy,
  Lock,
  LogIn,
  Mail,
  Maximize2,
  Minimize2,
  Monitor,
  MessageCircle,
  Phone,
  Send,
  Shield,
  ShieldAlert,
  Ticket,
  User,
  Wifi,
  Wrench,
  X,
} from "lucide-react";
import { PRIMARY_PHONE } from "@shared/companyContact";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  PORTAL_CONTRACTS,
  PORTAL_FILES,
  PORTAL_HOME,
  PORTAL_TICKETS,
  REMOTE_SUPPORT_HREF,
} from "@/lib/portalUrls";
import { readPortalUser, type PortalUserSession } from "@/lib/portalRoles";
import DeskLoginCard from "@/components/DeskLoginCard";
import { acquireBodyScrollLock } from "@/lib/bodyScrollLock";
import type { OpenMspAdvisorDetail } from "@/lib/openMspAdvisor";
import { STORE_ADVISOR_SEED } from "@/lib/openMspAdvisor";
import { analytics } from "@/lib/analytics";
import { useDraggableWindow } from "@/hooks/useDraggableWindow";
import { useEscapeKey } from "@/hooks/useFocusTrap";
import {
  DESK_INCIDENT_CHIP,
  DESK_STANDARD_TICKET_CHIPS,
  DESK_TICKET_CATEGORIES,
  DESK_TICKET_CHIPS,
  DESK_TICKET_PRIORITIES,
  applyDeskTicketChip,
  type DeskTicketChipId,
  type DeskTicketPriority,
} from "@/lib/deskTicketChips";

interface ZohoASAPWidgetProps {
  isEnabled?: boolean;
  accountId?: string;
  portalId?: string;
  customCSS?: string;
}

type ActiveTab = "chat" | "ticket" | "resources";
type ChatRole = "user" | "assistant" | "agent";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  senderName?: string | null;
  createdAt?: string;
  supportChips?: DeskTicketChipId[];
};

type TicketResult = {
  ticketNumber?: string;
  message: string;
};

type ChatHeadsUp = {
  id: string;
  from: string;
  preview: string;
  kind: "in" | "out";
  live?: boolean;
};

function previewChatLine(content: string, max = 108) {
  const text = content.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Pointer-follow white outline on Get Support fields. Magenta still wins on :focus. */
function trackDeskSupportFieldSpotlight(event: ReactPointerEvent<HTMLElement>) {
  if (event.pointerType !== "mouse") return;
  const field = (event.target as HTMLElement | null)?.closest?.(".de-desk-input") as HTMLElement | null;
  if (!field || !event.currentTarget.contains(field)) return;
  const rect = field.getBoundingClientRect();
  field.style.setProperty("--desk-spot-x", `${Math.round(event.clientX - rect.left)}px`);
  field.style.setProperty("--desk-spot-y", `${Math.round(event.clientY - rect.top)}px`);
}

/** Slow light under the pointer on Get Support issue rows. */
function trackDeskSupportRowGlow(event: ReactPointerEvent<HTMLElement>) {
  if (event.pointerType !== "mouse") return;
  const row = (event.target as HTMLElement | null)?.closest?.(
    ".de-desk-issue-row, .de-desk-incident",
  ) as HTMLElement | null;
  if (!row || !event.currentTarget.contains(row)) return;
  const rect = row.getBoundingClientRect();
  row.style.setProperty("--desk-row-x", `${Math.round(event.clientX - rect.left)}px`);
  row.style.setProperty("--desk-row-y", `${Math.round(event.clientY - rect.top)}px`);
}

function formatDeskMessageTime(iso?: string): string {
  if (!iso) return "";
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "";
  return when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function getDeskChipIcon(id: DeskTicketChipId) {
  const iconClass = "w-4 h-4 text-[#D3126A] shrink-0";
  switch (id) {
    case "something-not-working":
      return <Wrench className={iconClass} aria-hidden="true" />;
    case "sign-in":
      return <KeyRound className={iconClass} aria-hidden="true" />;
    case "email":
      return <Mail className={iconClass} aria-hidden="true" />;
    case "device":
      return <Monitor className={iconClass} aria-hidden="true" />;
    case "network":
      return <Wifi className={iconClass} aria-hidden="true" />;
    case "security-concern":
      return <Shield className={iconClass} aria-hidden="true" />;
    case "security-incident":
      return <ShieldAlert className={iconClass} aria-hidden="true" />;
    default:
      return <HelpCircle className={iconClass} aria-hidden="true" />;
  }
}

const CHAT_WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "DE Desk is here. Describe the outage, the risk, or the question — we'll take it and give you a clear next step.",
};

const QUICK_CHAT_PROMPTS: Array<{
  label: string;
  ticketChip?: DeskTicketChipId;
  icon: typeof Wrench;
}> = [
  { label: "I need IT help", icon: Wrench },
  { label: "I'm concerned about cybersecurity", icon: Shield },
  { label: "I need help with compliance", icon: FileText },
  { label: "I'm evaluating managed IT", icon: LayoutGrid },
  { label: "Possible security incident", ticketChip: "security-incident", icon: ShieldAlert },
];

const ASK_IT_HELP_CHIPS: DeskTicketChipId[] = [
  "something-not-working",
  "sign-in",
  "email",
  "device",
  "network",
];

type DeskPortalSession = {
  fullName?: string | null;
  email?: string | null;
};

async function peekDeskPortalSession(): Promise<DeskPortalSession | null> {
  try {
    // The shared HttpOnly portalAuth cookie is the canonical browser session.
    // Do not require an origin-scoped localStorage token: a user may have
    // authenticated on portal.digeratiexperts.com first.
    const response = await fetch("/api/portal/me", {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { user?: DeskPortalSession };
    const user = data.user;
    if (!user?.email && !user?.fullName) return null;
    return { fullName: user.fullName, email: user.email };
  } catch {
    return null;
  }
}

type DeskLauncherItem = {
  title: string;
  href?: string;
  icon: typeof FileText;
  external?: boolean;
  onSelect?: () => void;
  testId: string;
};

export const ZohoASAPWidget = ({
  isEnabled = true,
  accountId,
  portalId,
  customCSS,
}: ZohoASAPWidgetProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("chat");
  const [portalSession, setPortalSession] = useState<DeskPortalSession | null>(() => {
    const cached = typeof window !== "undefined" ? readPortalUser() : null;
    if (!cached?.email && !cached?.fullName) return null;
    return { fullName: cached.fullName, email: cached.email };
  });
  const [location] = useLocation();
  const [advisorSessionId, setAdvisorSessionId] = useState<string | null>(null);
  const [pendingSeed, setPendingSeed] = useState<string | null>(null);
  const [showInlineLogin, setShowInlineLogin] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
    { ...CHAT_WELCOME, createdAt: new Date().toISOString() },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatSending, setIsChatSending] = useState(false);
  const [assistantAvailable, setAssistantAvailable] = useState<boolean | null>(null);
  const [agentLive, setAgentLive] = useState(false);
  const [agentName, setAgentName] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollSinceRef = useRef<string | null>(null);
  const knownMsgIdsRef = useRef<Set<string>>(new Set(["welcome"]));
  const activeTabRef = useRef<ActiveTab>(activeTab);
  const agentNameRef = useRef<string | null>(null);
  const headsUpTimerRef = useRef<number | null>(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [headsUp, setHeadsUp] = useState<ChatHeadsUp | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High" | "Urgent">("Medium");
  const [category, setCategory] = useState("");
  const [selectedTicketChip, setSelectedTicketChip] = useState<DeskTicketChipId | null>(null);
  const ticketDetailsRef = useRef<HTMLDivElement>(null);
  const [isTicketSending, setIsTicketSending] = useState(false);
  const [ticketResult, setTicketResult] = useState<TicketResult | null>(null);
  const [showTicketMore, setShowTicketMore] = useState(false);
  const [ticketFieldErrors, setTicketFieldErrors] = useState<
    Partial<Record<"email" | "subject" | "message", string>>
  >({});
  const [ticketSubmitError, setTicketSubmitError] = useState<string | null>(null);

  const [canDrag, setCanDrag] = useState(false);
  const [isDeskFullscreen, setIsDeskFullscreen] = useState(false);
  const ignoreDismissUntilRef = useRef(0);

  const deskDrag = useDraggableWindow({
    enabled: canDrag,
    open: isOpen,
    storageKey: "de-desk-window-pos",
  });
  const { toast } = useToast();
  activeTabRef.current = activeTab;
  agentNameRef.current = agentName;

  useEscapeKey(() => {
    if (Date.now() < ignoreDismissUntilRef.current) return;
    if (isDeskFullscreen) {
      setIsDeskFullscreen(false);
      return;
    }
    setIsOpen(false);
  }, isOpen);

  // Full-screen desk: leave it whenever the desk closes or the viewport drops
  // below the draggable breakpoint, and lock body scroll while it covers the page.
  useEffect(() => {
    if (!isOpen) {
      setIsDeskFullscreen(false);
      setShowInlineLogin(false);
    }
  }, [isOpen]);

  // Inline Client Tools sign-in (issue #153): the card already stored the
  // canonical portal session keys; adopt it into the open Desk.
  const handleDeskSignIn = (user: PortalUserSession) => {
    setPortalSession({ fullName: user.fullName, email: user.email });
    if (user.email) setEmail((current) => current || user.email || "");
    if (user.fullName) setFullName((current) => current || user.fullName || "");
    setShowInlineLogin(false);
    toast({
      title: "Signed in",
      description: user.fullName
        ? `Welcome back, ${user.fullName.split(" ")[0]}. Client Tools are unlocked.`
        : "Client Tools are unlocked.",
    });
  };
  useEffect(() => {
    if (!canDrag) setIsDeskFullscreen(false);
  }, [canDrag]);
  useEffect(() => {
    if (!isDeskFullscreen) return;
    // Ref-counted lock instead of capture/restore: when the MegaMenu mobile
    // menu and desk fullscreen both close on one Escape (640–1023px), the
    // capture/restore pattern could restore a stale "hidden" and permanently
    // deadlock page scroll (review finding F5). See lib/bodyScrollLock.ts.
    return acquireBodyScrollLock();
  }, [isDeskFullscreen]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const getFocusable = () => {
      const container = deskDrag.panelRef.current;
      if (!container) return [];
      return Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
    };
    window.requestAnimationFrame(() => {
      getFocusable()[0]?.focus();
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const container = deskDrag.panelRef.current;
      const items = getFocusable();
      if (!container || items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !container.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [isOpen, deskDrag.panelRef]);

  useEffect(() => () => {
    if (headsUpTimerRef.current) window.clearTimeout(headsUpTimerRef.current);
  }, []);

  const clearHeadsUpTimer = () => {
    if (headsUpTimerRef.current) {
      window.clearTimeout(headsUpTimerRef.current);
      headsUpTimerRef.current = null;
    }
  };

  const showHeadsUp = (next: ChatHeadsUp, holdMs = next.kind === "in" && next.live ? 12000 : 7000) => {
    if (activeTabRef.current === "chat") return;
    setHeadsUp(next);
    clearHeadsUpTimer();
    headsUpTimerRef.current = window.setTimeout(() => setHeadsUp(null), holdMs);
  };

  const selectTab = (id: ActiveTab) => {
    setActiveTab(id);
    if (id === "chat") {
      setUnreadChatCount(0);
      setHeadsUp(null);
      clearHeadsUpTimer();
    }
  };

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => setCanDrag(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const syncPortalSession = () => {
      void peekDeskPortalSession().then((session) => {
        if (cancelled) return;
        setPortalSession(session);
        if (session?.email) {
          setEmail((current) => current || session.email || "");
        }
        if (session?.fullName) {
          setFullName((current) => current || session.fullName || "");
        }
      });
    };
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === "portalUser" || event.key === "portalToken") {
        syncPortalSession();
      }
    };
    syncPortalSession();
    window.addEventListener("focus", syncPortalSession);
    window.addEventListener("de-portal-auth-changed", syncPortalSession as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", syncPortalSession);
      window.removeEventListener("de-portal-auth-changed", syncPortalSession as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, [isOpen]);

  useEffect(() => {
    // Keep the existing Zoho ASAP bootstrap available for Desk integrations, but
    // do not make it responsible for the custom Digerati support experience.
    if (!isEnabled || !accountId || !portalId) return;
    if (typeof document === "undefined") return;
    if (document.querySelector('script[data-zoho-asap="1"]')) return;

    let loaded = false;
    const load = () => {
      if (loaded) return;
      loaded = true;

      const config = document.createElement("script");
      config.innerHTML = `
        window.ZohoDeskAsapConfig = {
          accountId: "${accountId}",
          portalId: "${portalId}"
        };
      `;
      document.head.appendChild(config);

      const asapScript = document.createElement("script");
      asapScript.src = "https://static.zohocdn.com/desk/web-client/asap/v1/api.js";
      asapScript.async = true;
      asapScript.dataset.zohoAsap = "1";
      document.head.appendChild(asapScript);
    };

    const idleApi = window as unknown as {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const requestIdle = idleApi.requestIdleCallback;
    const cancelIdle = idleApi.cancelIdleCallback;
    const usedIdleCallback = typeof requestIdle === "function";
    const idle = usedIdleCallback
      ? requestIdle(load, { timeout: 4000 })
      : window.setTimeout(load, 2500);

    const onInteract = () => load();
    window.addEventListener("pointerdown", onInteract, { once: true, passive: true });
    window.addEventListener("keydown", onInteract, { once: true });

    return () => {
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
      if (usedIdleCallback && typeof cancelIdle === "function") {
        cancelIdle(idle);
      } else {
        window.clearTimeout(idle);
      }
    };
  }, [isEnabled, accountId, portalId]);

  useEffect(() => {
    if (!isOpen) return;
    // DE Desk (advisor API) powers the Desk tab on the public site.
    setAssistantAvailable(true);
    analytics.chatOpened();
  }, [isOpen]);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-de-desk-open", isOpen);
    window.dispatchEvent(new CustomEvent("de-desk-open-change", { detail: { open: isOpen } }));
    return () => {
      document.documentElement.removeAttribute("data-de-desk-open");
      window.dispatchEvent(new CustomEvent("de-desk-open-change", { detail: { open: false } }));
    };
  }, [isOpen]);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<OpenMspAdvisorDetail>).detail || {};
      ignoreDismissUntilRef.current = Date.now() + 400;
      setIsOpen(true);
      setActiveTab(detail.tab ?? "chat");
      const seed =
        detail.seedMessage ||
        (detail.context === "store" ||
        (typeof window !== "undefined" && window.location.pathname.includes("/store"))
          ? STORE_ADVISOR_SEED
          : undefined);
      if (seed) setPendingSeed(seed);
    };
    window.addEventListener("de-open-msp-advisor", onOpen as EventListener);
    return () => window.removeEventListener("de-open-msp-advisor", onOpen as EventListener);
  }, []);

  useEffect(() => {
    if (activeTab !== "chat") return;
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeTab, chatMessages]);

  useEffect(() => {
    if (activeTab === "chat" || !isChatSending) return;
    showHeadsUp(
      {
        id: "pending-reply",
        from: "DE Desk",
        preview: agentLive ? "Delivering to the specialist…" : "Working on your message…",
        kind: "in",
        live: agentLive,
      },
      20000,
    );
  }, [activeTab, isChatSending, agentLive]);

  // Pull portal agent (and any missed) messages into the website desk
  useEffect(() => {
    if (!advisorSessionId || !isOpen) return;
    let cancelled = false;

    const mergeIncoming = (incoming: ChatMessage[], live?: boolean, name?: string | null) => {
      if (typeof live === "boolean") setAgentLive(live);
      if (name) setAgentName(name);
      if (!incoming.length) return;
      const added: ChatMessage[] = [];
      setChatMessages((current) => {
        const next = [...current];
        const recentAssistantContent = new Set(
          current
            .filter((m) => m.role === "assistant")
            .slice(-8)
            .map((m) => m.content.trim()),
        );
        for (const msg of incoming) {
          if (knownMsgIdsRef.current.has(msg.id)) continue;
          // Skip echoing the visitor's own turns (already rendered optimistically)
          if (msg.role === "user") {
            knownMsgIdsRef.current.add(msg.id);
            if (msg.createdAt) pollSinceRef.current = msg.createdAt;
            continue;
          }
          // Skip AI bubbles already shown from the chat POST (different server id).
          // Never content-dedupe agent messages — those are the live handoff.
          if (msg.role === "assistant" && recentAssistantContent.has(msg.content.trim())) {
            knownMsgIdsRef.current.add(msg.id);
            if (msg.createdAt) pollSinceRef.current = msg.createdAt;
            continue;
          }
          knownMsgIdsRef.current.add(msg.id);
          if (msg.createdAt) pollSinceRef.current = msg.createdAt;
          if (msg.role === "assistant") recentAssistantContent.add(msg.content.trim());
          const incomingMsg = {
            id: msg.id,
            role: msg.role,
            content: msg.content,
            senderName: msg.senderName,
            createdAt: msg.createdAt,
          };
          next.push(incomingMsg);
          added.push(incomingMsg);
        }
        return next;
      });
      if (added.length && activeTabRef.current !== "chat") {
        setUnreadChatCount((count) => count + added.length);
        const last = added[added.length - 1];
        showHeadsUp({
          id: last.id,
          from:
            last.role === "agent"
              ? last.senderName || name || agentNameRef.current || "Specialist"
              : "DE Desk",
          preview: previewChatLine(last.content),
          kind: "in",
          live: last.role === "agent" || !!live,
        });
      }
    };

    const poll = async () => {
      try {
        const qs = pollSinceRef.current
          ? `?since=${encodeURIComponent(pollSinceRef.current)}`
          : "";
        const res = await fetch(`/api/public/advisor/chat/${encodeURIComponent(advisorSessionId)}/messages${qs}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!data.success || cancelled) return;
        mergeIncoming(
          Array.isArray(data.messages) ? data.messages : [],
          !!data.agentLive,
          data.agentName || null,
        );
      } catch {
        /* ignore transient poll errors */
      }
    };

    void poll();
    const id = window.setInterval(poll, agentLive ? 1600 : 2400);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [advisorSessionId, isOpen, agentLive]);

  const handleSendChat = async (prompt?: string) => {
    const content = (prompt ?? chatInput).trim();
    if (!content || isChatSending) return;

    if (content.length > 2000) {
      toast({
        title: "Message is too long",
        description: "Please keep chat messages under 2,000 characters.",
        variant: "destructive",
      });
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    knownMsgIdsRef.current.add(userMessage.id);

    setChatMessages((current) => [...current, userMessage]);
    setChatInput("");
    setIsChatSending(true);
    if (activeTabRef.current !== "chat") {
      showHeadsUp({
        id: userMessage.id,
        from: "You",
        preview: previewChatLine(content, 90),
        kind: "out",
      }, 4000);
    }

    try {
      const response = await fetch("/api/public/advisor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: advisorSessionId,
          message: content,
          pageContext: {
            pathname: location,
            pageTitle: typeof document !== "undefined" ? document.title : undefined,
            pageType: location.includes("/store")
              ? "store"
              : location.includes("cyber")
                ? "cybersecurity"
                : location === "/"
                  ? "home"
                  : "other",
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "DE Desk couldn't answer right now. Try again or open a ticket.");
      }

      const replyContent = data.reply;
      if (!replyContent || typeof replyContent !== "string") {
        throw new Error("The advisor returned an invalid response.");
      }

      if (data.sessionId) {
        setAdvisorSessionId(data.sessionId);
      }
      setAssistantAvailable(true);
      if (data.agentLive) {
        setAgentLive(true);
        if (data.agentName) setAgentName(String(data.agentName));
      }

      // Prefer server ids/timestamps so poll won't re-add this bubble
      const assistantId =
        typeof data.messageId === "string" && data.messageId
          ? data.messageId
          : `assistant-${Date.now()}`;
      const createdAt =
        typeof data.messageCreatedAt === "string" && data.messageCreatedAt
          ? data.messageCreatedAt
          : new Date().toISOString();
      knownMsgIdsRef.current.add(assistantId);
      pollSinceRef.current = createdAt;

      const supportChips =
        data.suggestSupportChips && data.mode === "it_support" ? ASK_IT_HELP_CHIPS : undefined;

      setChatMessages((current) => [
        ...current,
        {
          id: assistantId,
          role: "assistant",
          content: replyContent,
          createdAt,
          senderName: data.agentLive ? data.agentName || "DE Desk" : null,
          supportChips,
        },
      ]);
      if (activeTabRef.current !== "chat") {
        setUnreadChatCount((count) => count + 1);
        showHeadsUp({
          id: assistantId,
          from: data.agentLive ? String(data.agentName || "Specialist") : "DE Desk",
          preview: previewChatLine(replyContent),
          kind: "in",
          live: !!data.agentLive,
        });
      }
    } catch (error) {
      const description = error instanceof Error ? error.message : "Chat is temporarily unavailable.";
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: `${description} You can create a support ticket here and the team will follow up.`,
          createdAt: new Date().toISOString(),
        },
      ]);
      if (activeTabRef.current !== "chat") {
        showHeadsUp({
          id: `assistant-error-${Date.now()}`,
          from: "DE Desk",
          preview: previewChatLine(description),
          kind: "in",
        });
      }
      toast({
        title: "Chat unavailable",
        description: "Your message was not submitted as a ticket. Use the Ticket tab if you need team follow-up.",
        variant: "destructive",
      });
    } finally {
      setIsChatSending(false);
    }
  };


  useEffect(() => {
    if (!pendingSeed || !isOpen || isChatSending || activeTab !== "chat") return;
    const seed = pendingSeed;
    setPendingSeed(null);
    void handleSendChat(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSeed, isOpen, activeTab]);

  const applyTicketChip = (chipId: DeskTicketChipId) => {
    const chip = DESK_TICKET_CHIPS.find((item) => item.id === chipId);
    if (!chip) return;
    const next = applyDeskTicketChip(chip, { message });
    setSelectedTicketChip(next.chipId);
    setSubject(next.subject);
    setCategory(next.category);
    setPriority(next.priority);
    setMessage(next.message);
    window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      ticketDetailsRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
      const focusId = fullName.trim() && email.trim() ? "support-message" : "support-name";
      document.getElementById(focusId)?.focus();
    });
  };

  const openSupportWithChip = (chipId: DeskTicketChipId) => {
    selectTab("ticket");
    applyTicketChip(chipId);
  };

  const authToolGroups: Array<{ heading: string; items: DeskLauncherItem[] }> = [
    {
      heading: "Support",
      items: [
        {
          title: "Create Support Ticket",
          icon: Ticket,
          testId: "resource-link-create-support-ticket",
          onSelect: () => openSupportWithChip("something-not-working"),
        },
        {
          title: "View My Tickets",
          href: PORTAL_TICKETS,
          icon: FileText,
          testId: "resource-link-view-my-tickets",
        },
        {
          title: "Start Remote Support",
          href: REMOTE_SUPPORT_HREF,
          icon: Monitor,
          external: true,
          testId: "resource-link-start-remote-support",
        },
      ],
    },
    {
      heading: "Secure services",
      items: [
        {
          title: "Secure File Exchange",
          href: PORTAL_FILES,
          icon: FolderLock,
          testId: "resource-link-secure-file-exchange",
        },
        {
          title: "Account & Password Help",
          icon: KeyRound,
          testId: "resource-link-account-password-help",
          onSelect: () => openSupportWithChip("sign-in"),
        },
      ],
    },
    {
      heading: "Account",
      items: [
        {
          title: "Open Client Portal",
          href: PORTAL_HOME,
          icon: LayoutGrid,
          testId: "resource-link-open-client-portal",
        },
        {
          title: "Documents & Agreements",
          href: PORTAL_CONTRACTS,
          icon: FileText,
          testId: "resource-link-documents-agreements",
        },
      ],
    },
  ];

  const handleSubmitTicket = async () => {
    const nextErrors: Partial<Record<"email" | "subject" | "message", string>> = {};
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      nextErrors.email = "Enter your work email.";
    } else if (!emailPattern.test(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!subject.trim()) nextErrors.subject = "Summarize what’s happening.";
    if (!message.trim()) nextErrors.message = "Add a few details so we can route this.";

    setTicketFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setTicketSubmitError("Please complete the required fields below.");
      toast({
        title: "Missing information",
        description: "Please enter your email, subject, and message.",
        variant: "destructive",
      });
      const firstId = nextErrors.email
        ? "support-email"
        : nextErrors.subject
          ? "support-subject"
          : "support-message";
      document.getElementById(firstId)?.focus();
      return;
    }

    setIsTicketSending(true);
    setTicketResult(null);
    setTicketSubmitError(null);

    const description = [
      message.trim(),
      "",
      fullName.trim() ? `Name: ${fullName.trim()}` : null,
      company.trim() ? `Company: ${company.trim()}` : null,
      category ? `Category: ${category}` : null,
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 5000);

    try {
      const response = await fetch("/api/portal/zoho/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          subject: subject.trim(),
          description,
          priority,
          name: fullName.trim() || undefined,
          sessionId: advisorSessionId || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.zohoTicketId) {
        throw new Error(data.error || "We couldn't open the ticket right now. Please try again.");
      }

      setTicketResult({
        ticketNumber: data.ticketNumber,
        message: data.message || "Your support request has been received.",
      });
      setFullName("");
      setEmail("");
      setCompany("");
      setSubject("");
      setMessage("");
      setPriority("Medium");
      setCategory("");
      setSelectedTicketChip(null);
      setTicketFieldErrors({});
      setTicketSubmitError(null);

      toast({
        title: "Ticket created",
        description: data.ticketNumber
          ? `Reference ${data.ticketNumber}`
          : "We’ll be in touch shortly.",
      });
    } catch (error) {
      const descriptionText = error instanceof Error ? error.message : "Please try again.";
      setTicketSubmitError(descriptionText);
      toast({
        title: "Couldn’t create the ticket",
        description: descriptionText,
        variant: "destructive",
      });
    } finally {
      setIsTicketSending(false);
    }
  };

  const deskTabs = [
    { id: "chat" as const, label: "Ask DE", icon: MessageCircle },
    { id: "ticket" as const, label: "Get Support", icon: FileText },
    { id: "resources" as const, label: "Client Tools", icon: LayoutGrid },
  ];

  const onDeskTabListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") {
      return;
    }
    event.preventDefault();
    const ids = deskTabs.map((tab) => tab.id);
    const current = ids.indexOf(activeTab);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? ids.length - 1
          : event.key === "ArrowRight"
            ? (current + 1) % ids.length
            : (current - 1 + ids.length) % ids.length;
    const next = ids[nextIndex];
    selectTab(next);
    window.requestAnimationFrame(() => {
      document.getElementById(`desk-tab-${next}`)?.focus();
    });
  };

  if (!isEnabled) return null;

  const dockClear =
    "calc(var(--de-chrome-inset) + env(safe-area-inset-bottom, 0px) + var(--de-cookie-h, 0px) + var(--de-unified-bar-h, 0px))";

  const canvasRight = "calc(var(--de-canvas-gutter) + var(--de-chrome-inset))";

  // Near-full-screen takeover: a 12px margin all around, overriding both the
  // docked classes and any dragged/resized inline geometry. Prior pos/size
  // stay in deskDrag state, so collapsing restores the previous layout.
  const deskFullscreenStyle = {
    left: 12,
    top: 12,
    right: 12,
    bottom: 12,
    width: "auto" as const,
    height: "auto" as const,
    maxWidth: "none" as const,
    maxHeight: "none" as const,
  };

  const deskWindowStyle = canDrag
    ? isDeskFullscreen
      ? deskFullscreenStyle
      : {
        ...(deskDrag.pos
          ? {
              left: deskDrag.pos.x,
              top: deskDrag.pos.y,
              right: "auto",
              bottom: "auto",
            }
          : {
              right: canvasRight,
              bottom: dockClear,
              left: "auto",
              top: "auto",
            }),
        ...(deskDrag.size
          ? {
              width: deskDrag.size.w,
              height: deskDrag.size.h,
              maxWidth: "none",
              maxHeight: "none",
            }
          : {}),
      }
    : undefined;

  return (
    <>
        {isOpen && (
          <section
            ref={deskDrag.panelRef}
            className="de-desk-shell fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[10040] flex max-h-[100dvh] w-auto flex-col overflow-hidden sm:inset-auto sm:h-[min(760px,calc(100dvh-5.5rem))] sm:max-h-[min(86vh,calc(100dvh-4.5rem))] sm:w-[440px] sm:max-w-[calc(100vw-2rem)]"
            style={deskWindowStyle}
            role="dialog"
            aria-modal="true"
            aria-label="DE Desk help"
            data-testid="desk-modal"
            data-tab={activeTab}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="de-desk-head">
              <div
                className={`de-desk-id ${
                  canDrag && !isDeskFullscreen
                    ? deskDrag.dragging
                      ? "cursor-grabbing select-none"
                      : "cursor-grab select-none"
                    : ""
                }`}
                onPointerDown={canDrag && !isDeskFullscreen ? deskDrag.onHandlePointerDown : undefined}
                onDoubleClick={canDrag && !isDeskFullscreen ? deskDrag.reset : undefined}
                style={canDrag && !isDeskFullscreen ? { touchAction: "none" } : undefined}
                data-testid="desk-drag-handle"
                aria-label={canDrag && !isDeskFullscreen ? "Move DE Desk window. Double-click to reset size and position." : undefined}
              >
                <div className="de-desk-avatar">
                  DE
                  <span className="de-desk-avatar-dot" />
                </div>
                <div className="min-w-0">
                  <h2 data-testid="text-widget-title">DE Desk</h2>
                  <p data-testid="text-widget-status">
                    {agentLive
                      ? `${agentName || "Specialist"} joined · live handoff`
                      : "DE Desk is available"}
                  </p>
                </div>
              </div>
              {canDrag ? (
                <button
                  type="button"
                  className="de-desk-close"
                  data-testid="button-expand-desk"
                  aria-label={isDeskFullscreen ? "Exit full screen" : "Expand DE Desk to full screen"}
                  title={isDeskFullscreen ? "Exit full screen" : "Full screen"}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setIsDeskFullscreen((current) => !current)}
                >
                  {isDeskFullscreen ? (
                    <Minimize2 size={13} aria-hidden="true" />
                  ) : (
                    <Maximize2 size={13} aria-hidden="true" />
                  )}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (Date.now() < ignoreDismissUntilRef.current) return;
                  setIsOpen(false);
                }}
                className="de-desk-close"
                data-testid="button-close-widget"
                aria-label="Close DE Desk"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </header>

            <div
              className="de-desk-tabs"
              role="tablist"
              aria-label="Support options"
              onKeyDown={onDeskTabListKeyDown}
            >
              {deskTabs.map(({ id, label, icon: Icon }) => {
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    id={`desk-tab-${id}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`desk-panel-${id}`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => selectTab(id)}
                    className={`de-desk-tab${isActive ? " is-active" : ""}${
                      id === "chat" && unreadChatCount > 0 ? " has-unread" : ""
                    }`}
                    data-testid={`button-tab-${id}`}
                    aria-label={
                      id === "chat" && unreadChatCount > 0
                        ? `Ask DE, ${unreadChatCount} new ${unreadChatCount === 1 ? "message" : "messages"}`
                        : undefined
                    }
                  >
                    <Icon aria-hidden="true" />
                    {label}
                    {id === "chat" && unreadChatCount > 0 ? (
                      <span className="de-desk-tab-badge" aria-hidden="true">
                        {unreadChatCount > 9 ? "9+" : unreadChatCount}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="de-desk-body">
              {headsUp && activeTab !== "chat" ? (
                <div
                  className={`de-desk-heads-up${headsUp.kind === "out" ? " is-out" : ""}${
                    headsUp.live ? " is-live" : ""
                  }`}
                  role="status"
                  aria-live="polite"
                  data-testid="desk-chat-heads-up"
                >
                  <button
                    type="button"
                    className="de-desk-heads-up-main"
                    onClick={() => selectTab("chat")}
                  >
                    <span className="de-desk-heads-up-mark" aria-hidden="true">
                      {headsUp.kind === "out" ? "You" : headsUp.live ? "AG" : "DE"}
                    </span>
                    <span className="de-desk-heads-up-copy">
                      <span className="de-desk-heads-up-top">
                        <strong>{headsUp.from}</strong>
                        <em>{headsUp.kind === "out" ? "sent" : "now"}</em>
                      </span>
                      <span className="de-desk-heads-up-preview">{headsUp.preview}</span>
                      <span className="de-desk-heads-up-hint">
                        Open Ask DE to reply
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="de-desk-heads-up-x"
                    onClick={() => {
                      setHeadsUp(null);
                      clearHeadsUpTimer();
                    }}
                    aria-label="Dismiss chat notification"
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </div>
              ) : null}
              {activeTab === "chat" && (
                <div
                  className="de-desk-panel"
                  id="desk-panel-chat"
                  role="tabpanel"
                  aria-labelledby="desk-tab-chat"
                  data-testid="panel-support-chat"
                >
                  <div className="de-desk-scroll" aria-live="polite">
                    {chatMessages.map((chatMessage, index) => {
                      const isUser = chatMessage.role === "user";
                      const isAgent = chatMessage.role === "agent";
                      const isOpening = !isUser && index === 0;
                      return (
                        <div
                          key={chatMessage.id}
                          className={`de-desk-msg ${isUser ? "is-user" : "is-bot"}`}
                        >
                          {!isUser ? (
                            <div className="de-desk-msg-id" aria-hidden="true">
                              {isAgent ? "AG" : "DE"}
                              {isOpening ? <span className="de-desk-avatar-dot" /> : null}
                            </div>
                          ) : null}
                          <div className="de-desk-msg-col">
                            {!isUser ? (
                              <div className="de-desk-msg-who">
                                <strong>
                                  {isAgent ? chatMessage.senderName || agentName || "Agent" : "DE Desk"}
                                </strong>
                                {isOpening ? <em>Available</em> : null}
                              </div>
                            ) : null}
                            <div
                              className={`de-desk-bubble ${
                                isUser ? "is-user" : isAgent ? "is-agent" : "is-bot"
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{chatMessage.content}</p>
                            </div>
                            {chatMessage.createdAt && formatDeskMessageTime(chatMessage.createdAt) ? (
                              <time
                                className="de-desk-msg-time"
                                dateTime={chatMessage.createdAt}
                              >
                                {formatDeskMessageTime(chatMessage.createdAt)}
                              </time>
                            ) : null}
                            {chatMessage.supportChips?.length ? (
                              <div className="de-desk-chips" role="group" aria-label="Open a support ticket">
                                {chatMessage.supportChips.map((chipId) => {
                                  const chip = DESK_TICKET_CHIPS.find((item) => item.id === chipId);
                                  if (!chip) return null;
                                  return (
                                    <button
                                      key={chip.id}
                                      type="button"
                                      data-testid={`ask-support-chip-${chip.id}`}
                                      onClick={() => openSupportWithChip(chip.id)}
                                      className="de-desk-chip"
                                    >
                                      <span className="de-desk-chip-icon">{getDeskChipIcon(chip.id)}</span>
                                      <span className="de-desk-chip-label">{chip.label}</span>
                                      <ChevronRight className="de-desk-chip-arrow" aria-hidden="true" />
                                    </button>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}

                    {chatMessages.length === 1 && chatMessages[0]?.id === "welcome" ? (
                      <div className="de-desk-discover">
                        <div className="de-desk-discover-intro">
                          <p className="de-desk-launch-heading">Engineering &amp; IT advisor</p>
                          <h3>How can our Arizona team assist you?</h3>
                          <p>Choose a prompt or type below for real-time guidance:</p>
                        </div>
                        <div className="de-desk-discover-list" role="group" aria-label="Common questions">
                          {QUICK_CHAT_PROMPTS.map(({ label, ticketChip, icon: PromptIcon }) => (
                            <button
                              key={label}
                              type="button"
                              data-testid={`ask-prompt-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                              onClick={() => {
                                if (ticketChip) {
                                  selectTab("ticket");
                                  applyTicketChip(ticketChip);
                                  return;
                                }
                                void handleSendChat(label);
                              }}
                              className={`de-desk-discover-row${ticketChip ? " is-incident" : ""}`}
                            >
                              <span className="de-desk-discover-icon">
                                <PromptIcon aria-hidden="true" />
                              </span>
                              <span className="de-desk-discover-label">{label}</span>
                              <ChevronRight className="de-desk-discover-arrow" aria-hidden="true" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {isChatSending && (
                      <div className="de-desk-msg is-bot" aria-live="polite">
                        <div className="de-desk-msg-id" aria-hidden="true">DE</div>
                        <div className="de-desk-msg-col">
                          <div className="de-desk-bubble is-bot">
                            <span className="inline-flex items-center gap-2">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#D3126A]" />
                              {agentLive ? "Delivering to specialist…" : "Thinking it through…"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </div>
              )}

              {activeTab === "ticket" && (
                <div
                  className="de-desk-panel"
                  id="desk-panel-ticket"
                  role="tabpanel"
                  aria-labelledby="desk-tab-ticket"
                  data-testid="panel-support-ticket"
                >
                  <div className="de-desk-scroll">
                    {ticketResult ? (
                      <div className="de-desk-hero de-desk-success">
                        <div className="de-desk-hero-ring">
                          <CheckCircle2 aria-hidden="true" />
                        </div>
                        <h3>Support request received</h3>
                        {ticketResult.ticketNumber && (
                          <p className="de-desk-ticket-ref">{ticketResult.ticketNumber}</p>
                        )}
                        <p>{ticketResult.message}</p>
                        <div className="de-desk-success-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setTicketResult(null);
                              selectTab("chat");
                            }}
                            className="de-desk-row"
                          >
                            <span className="de-desk-row-t">Back to Ask DE</span>
                          </button>
                          <button type="button" onClick={() => setTicketResult(null)} className="de-desk-btn-grad">
                            Create another ticket
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="de-desk-ticket-upper" onPointerMove={trackDeskSupportRowGlow}>
                        <div className="de-desk-ticket-lead">
                          <p className="de-desk-launch-heading">Incident reporting &amp; support</p>
                          <h3>Direct Engineering Support</h3>
                          <p>Tell us what happened. We&apos;ll immediately route your request to our Arizona desk.</p>
                          <ul className="de-desk-perk-list">
                            <li>100% Arizona-based engineering desk</li>
                            <li>Direct portal tracking &amp; phone escalation</li>
                          </ul>
                        </div>

                        <button
                          type="button"
                          className={`de-desk-incident${
                            selectedTicketChip === "security-incident" ? " is-on" : ""
                          }`}
                          data-testid="ticket-issue-security-incident"
                          onClick={() => applyTicketChip("security-incident")}
                        >
                          <span className="de-desk-incident-icon">
                            <ShieldAlert aria-hidden="true" />
                          </span>
                          <span className="de-desk-incident-copy">
                            <strong>Possible security incident</strong>
                            <span>{DESK_INCIDENT_CHIP.blurb}</span>
                          </span>
                          <ChevronRight className="de-desk-incident-arrow" aria-hidden="true" />
                        </button>

                        <p className="de-desk-launch-heading" id="support-issue-label">What do you need help with?</p>
                        <div className="de-desk-issue-list" role="group" aria-labelledby="support-issue-label">
                          {DESK_STANDARD_TICKET_CHIPS.map((chip) => (
                            <button
                              key={chip.id}
                              type="button"
                              className={`de-desk-issue-row${selectedTicketChip === chip.id ? " is-on" : ""}`}
                              data-testid={`ticket-issue-${chip.id}`}
                              onClick={() => applyTicketChip(chip.id)}
                            >
                              <span className="de-desk-issue-icon">{getDeskChipIcon(chip.id)}</span>
                              <span className="de-desk-issue-label">{chip.label}</span>
                              <ChevronRight className="de-desk-issue-arrow" aria-hidden="true" />
                            </button>
                          ))}
                        </div>

                        {selectedTicketChip === "security-incident" ? (
                          <p className="de-desk-route-note" data-testid="ticket-chip-security-incident">
                            Routed as a possible security incident.
                          </p>
                        ) : null}
                        </div>

                        <div
                          className="de-desk-form"
                          ref={ticketDetailsRef}
                          onPointerMove={trackDeskSupportFieldSpotlight}
                        >

                        <div className="de-desk-field">
                          <label htmlFor="support-name">Name</label>
                          <div className="de-desk-input-wrap">
                            <User aria-hidden="true" />
                            <Input
                              id="support-name"
                              autoComplete="name"
                              placeholder="Your name"
                              value={fullName}
                              onChange={(event) => setFullName(event.target.value)}
                              data-testid="input-support-name"
                              className="de-desk-input"
                            />
                          </div>
                        </div>
                        <div className="de-desk-field">
                          <label htmlFor="support-email">Work email</label>
                          <div className="de-desk-input-wrap">
                            <Mail aria-hidden="true" />
                            <Input
                              id="support-email"
                              type="email"
                              autoComplete="email"
                              placeholder="you@company.com"
                              value={email}
                              onChange={(event) => {
                                setEmail(event.target.value);
                                setTicketFieldErrors((current) => ({ ...current, email: undefined }));
                              }}
                              aria-required="true"
                              aria-invalid={ticketFieldErrors.email ? true : undefined}
                              aria-describedby={ticketFieldErrors.email ? "support-email-error" : undefined}
                              data-testid="input-support-email"
                              className="de-desk-input"
                            />
                          </div>
                          {ticketFieldErrors.email ? (
                            <p id="support-email-error" className="de-desk-field-error" role="alert">
                              {ticketFieldErrors.email}
                            </p>
                          ) : null}
                        </div>
                        <div className="de-desk-field">
                          <label htmlFor="support-subject">What&apos;s happening?</label>
                          <Input
                            id="support-subject"
                            maxLength={200}
                            placeholder="Short summary"
                            value={subject}
                            onChange={(event) => {
                              setSubject(event.target.value);
                              setTicketFieldErrors((current) => ({ ...current, subject: undefined }));
                            }}
                            aria-required="true"
                            aria-invalid={ticketFieldErrors.subject ? true : undefined}
                            aria-describedby={ticketFieldErrors.subject ? "support-subject-error" : undefined}
                            data-testid="input-support-subject"
                            className="de-desk-input is-bare"
                          />
                          {ticketFieldErrors.subject ? (
                            <p id="support-subject-error" className="de-desk-field-error" role="alert">
                              {ticketFieldErrors.subject}
                            </p>
                          ) : null}
                        </div>
                        <div className="de-desk-field">
                          <label htmlFor="support-message">Details</label>
                          <Textarea
                            id="support-message"
                            maxLength={2000}
                            placeholder="What broke, who is affected, and what you already tried."
                            value={message}
                            onChange={(event) => {
                              setMessage(event.target.value);
                              setTicketFieldErrors((current) => ({ ...current, message: undefined }));
                            }}
                            rows={4}
                            aria-required="true"
                            aria-invalid={ticketFieldErrors.message ? true : undefined}
                            aria-describedby={ticketFieldErrors.message ? "support-message-error" : undefined}
                            className="de-desk-input de-desk-ta is-bare"
                            data-testid="input-support-message"
                          />
                          {ticketFieldErrors.message ? (
                            <p id="support-message-error" className="de-desk-field-error" role="alert">
                              {ticketFieldErrors.message}
                            </p>
                          ) : null}
                        </div>
                        <div className="de-desk-field">
                          <span className="de-desk-urgency-label" id="support-urgency-label">
                            Urgency
                          </span>
                          <div className="de-desk-urgency" role="group" aria-labelledby="support-urgency-label">
                            {DESK_TICKET_PRIORITIES.map((level) => (
                              <button
                                key={level}
                                type="button"
                                className={priority === level ? "is-on" : undefined}
                                aria-pressed={priority === level}
                                data-testid={`select-support-priority-${level.toLowerCase()}`}
                                onClick={() => setPriority(level)}
                              >
                                {level}
                              </button>
                            ))}
                          </div>
                          <select
                            id="support-priority"
                            hidden
                            value={priority}
                            onChange={(event) => setPriority(event.target.value as DeskTicketPriority)}
                            className="sr-only"
                            data-testid="select-support-priority"
                            tabIndex={-1}
                            aria-hidden="true"
                          >
                            {DESK_TICKET_PRIORITIES.map((level) => (
                              <option key={level} value={level}>
                                {level}
                              </option>
                            ))}
                          </select>
                        </div>

                        <button
                          type="button"
                          className="de-desk-more-toggle"
                          aria-expanded={showTicketMore}
                          onClick={() => setShowTicketMore((open) => !open)}
                        >
                          {showTicketMore ? "Hide optional fields" : "Add company or category"}
                        </button>
                        {showTicketMore ? (
                          <div className="de-desk-more">
                            <div className="de-desk-field">
                              <label htmlFor="support-company">Company</label>
                              <Input
                                id="support-company"
                                autoComplete="organization"
                                placeholder="Company name"
                                value={company}
                                onChange={(event) => setCompany(event.target.value)}
                                data-testid="input-support-company"
                                className="de-desk-input is-bare"
                              />
                            </div>
                            <div className="de-desk-field">
                              <label htmlFor="support-category">Category</label>
                              <select
                                id="support-category"
                                value={category}
                                onChange={(event) => setCategory(event.target.value)}
                                className="de-desk-input de-desk-select is-bare"
                                data-testid="select-support-category"
                              >
                                <option value="">Select a category</option>
                                {DESK_TICKET_CATEGORIES.map((item) => (
                                  <option key={item} value={item}>
                                    {item}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ) : null}

                        {ticketSubmitError ? (
                          <div className="de-desk-form-error" role="alert" data-testid="support-submit-error">
                            {ticketSubmitError}
                          </div>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => void handleSubmitTicket()}
                          disabled={isTicketSending}
                          className="de-desk-btn-grad"
                          data-testid="button-submit-support"
                        >
                          {isTicketSending ? "Creating ticket…" : "Create ticket"}
                        </button>
                        <a
                          href={PRIMARY_PHONE.telHref}
                          className="de-desk-form-phone"
                          data-testid="desk-support-phone-link"
                        >
                          <Phone aria-hidden="true" />
                          Call {PRIMARY_PHONE.display}
                        </a>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "resources" && (
                <div
                  className="de-desk-panel de-desk-tools-panel"
                  id="desk-panel-resources"
                  role="tabpanel"
                  aria-labelledby="desk-tab-resources"
                  data-testid="panel-support-resources"
                >
                  <div className="de-desk-scroll">
                    {portalSession ? (
                      <>
                        <div className="de-desk-tools-intro">
                          <h3>Client Tools</h3>
                          <p>
                            Welcome back
                            {portalSession.fullName ? `, ${portalSession.fullName.split(" ")[0]}` : ""}.
                          </p>
                        </div>
                        {authToolGroups.map((group) => (
                          <div key={group.heading} className="de-desk-launch-group">
                            <p className="de-desk-launch-heading">{group.heading}</p>
                            <div className="de-desk-tools-list">
                              {group.items.map((item) => {
                                const Icon = item.icon;
                                if (item.onSelect) {
                                  return (
                                    <button
                                      key={item.title}
                                      type="button"
                                      className="de-desk-tool-link"
                                      data-testid={item.testId}
                                      onClick={item.onSelect}
                                    >
                                      <span className="de-desk-tool-icon">
                                        <Icon aria-hidden="true" />
                                      </span>
                                      <span className="de-desk-tool-copy">
                                        <span className="de-desk-tool-title">{item.title}</span>
                                      </span>
                                      <ChevronRight className="de-desk-tool-arrow" aria-hidden="true" />
                                    </button>
                                  );
                                }
                                return (
                                  <a
                                    key={item.title}
                                    href={item.href}
                                    className="de-desk-tool-link"
                                    data-testid={item.testId}
                                    {...(item.external || item.href?.startsWith("http")
                                      ? { target: "_blank", rel: "noopener noreferrer" }
                                      : {})}
                                  >
                                    <span className="de-desk-tool-icon">
                                      <Icon aria-hidden="true" />
                                    </span>
                                    <span className="de-desk-tool-copy">
                                      <span className="de-desk-tool-title">{item.title}</span>
                                    </span>
                                    {item.external || item.href?.startsWith("http") ? (
                                      <ExternalLink className="de-desk-tool-arrow" aria-hidden="true" />
                                    ) : (
                                      <ChevronRight className="de-desk-tool-arrow" aria-hidden="true" />
                                    )}
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="de-desk-tools-gate">
                        <div className="de-desk-tools-intro">
                          <h3>Client Tools</h3>
                          <p className="de-desk-tools-kicker">Already a Digerati Experts client?</p>
                          <p>
                            Access support, service resources, and your secure client portal.
                          </p>
                        </div>
                        {showInlineLogin ? (
                          <div
                            className="de-desk-login-slot"
                            onPointerMove={trackDeskSupportFieldSpotlight}
                          >
                            <DeskLoginCard
                              onSignedIn={handleDeskSignIn}
                              onBack={() => setShowInlineLogin(false)}
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="de-desk-signin"
                            aria-expanded={showInlineLogin}
                            onClick={() => setShowInlineLogin(true)}
                            data-testid="resource-link-sign-in-to-client-tools"
                          >
                            <LogIn aria-hidden="true" />
                            Sign in to Client Tools
                          </button>
                        )}
                        <div className="de-desk-tools-now">
                          <p className="de-desk-launch-heading">Need help right now?</p>
                          <div className="de-desk-tools-list">
                            <button
                              type="button"
                              className="de-desk-tool-link"
                              data-testid="resource-link-submit-support-request"
                              onClick={() => selectTab("ticket")}
                            >
                              <span className="de-desk-tool-icon">
                                <LifeBuoy aria-hidden="true" />
                              </span>
                              <span className="de-desk-tool-copy">
                                <span className="de-desk-tool-title">Submit a support request</span>
                              </span>
                              <ChevronRight className="de-desk-tool-arrow" aria-hidden="true" />
                            </button>
                            <a
                              href={REMOTE_SUPPORT_HREF}
                              className="de-desk-tool-link"
                              data-testid="resource-link-start-remote-support"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <span className="de-desk-tool-icon">
                                <Monitor aria-hidden="true" />
                              </span>
                              <span className="de-desk-tool-copy">
                                <span className="de-desk-tool-title">Start remote support</span>
                              </span>
                              <ExternalLink className="de-desk-tool-arrow" aria-hidden="true" />
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {activeTab === "chat" ? (
              <>
                <div className={`de-desk-composer${headsUp || unreadChatCount ? " is-live" : ""}`}>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleSendChat();
                      }
                    }}
                    maxLength={2000}
                    placeholder={
                      agentLive
                        ? `Message ${agentName || "the specialist"}…`
                        : "Type the issue — we're ready now"
                    }
                    disabled={isChatSending}
                    data-testid="input-support-chat"
                    aria-label="Ask DE message"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSendChat()}
                    disabled={!chatInput.trim() || isChatSending}
                    className="de-desk-send"
                    data-testid="button-send-support-chat"
                    aria-label="Send chat message"
                  >
                    <Send aria-hidden="true" />
                  </button>
                </div>
                <p className="de-desk-composer-caption">
                  <Lock aria-hidden="true" />
                  {agentLive
                    ? "A Digerati agent is in this thread. Never share passwords or MFA codes."
                    : "Never share passwords, MFA codes, or private keys."}
                </p>
              </>
            ) : null}
            {canDrag && !isDeskFullscreen ? (
              <>
                {(["n", "s", "e", "w", "ne", "nw", "sw"] as const).map((edge) => (
                  <button
                    key={edge}
                    type="button"
                    className={`de-desk-resize-edge de-desk-resize-${edge}`}
                    data-testid={`desk-resize-${edge}`}
                    aria-label={`Resize DE Desk from the ${edge} edge`}
                    onPointerDown={deskDrag.onResizePointerDown(edge)}
                  />
                ))}
                <button
                  type="button"
                  className={`de-desk-resize de-desk-resize-se${deskDrag.resizing ? " is-active" : ""}`}
                  data-testid="desk-resize-handle"
                  aria-label="Resize DE Desk. Drag any edge or this corner, or use Expand in the header."
                  onPointerDown={deskDrag.onResizePointerDown("se")}
                >
                  <span aria-hidden="true" />
                </button>
              </>
            ) : null}
          </section>
        )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .de-desk-shell {
              --desk-shell: var(--de-surface, #0a0a0a);
              --desk-shell-soft: rgba(0,0,0,0.28);
              --desk-shell-border: var(--de-hairline, rgba(255,255,255,0.10));
              --desk-shell-border-strong: rgba(255,255,255,0.18);
              --desk-shell-text: #ffffff;
              --desk-shell-muted: rgba(255,255,255,0.72);
              --desk-shell-dim: rgba(255,255,255,0.50);
              --desk-paper: var(--de-surface, #0a0a0a);
              --desk-well: var(--de-bg, #050312);
              --desk-surface: var(--de-surface, #0a0a0a);
              --desk-box: var(--de-raised, #151217);
              --desk-inset: var(--de-raised, #151217);
              --desk-border: var(--de-hairline, rgba(255,255,255,0.10));
              --desk-border-strong: rgba(255,255,255,0.18);
              --desk-ink: #ffffff;
              --desk-ink-muted: rgba(255,255,255,0.72);
              --desk-ink-dim: rgba(255,255,255,0.50);
              --desk-pink: #d3126a;
              --desk-red: #f0455b;
              --desk-green: #22c55e;
              --desk-cta: #d3126a;
              /* Unlayered rule must stay position:fixed. A relative value here
                 beat Tailwind fixed and laid the dialog out after the page. */
              position: fixed;
              z-index: 10040;
              color-scheme: dark;
              background: var(--de-surface, #0a0a0a);
              border: 1px solid rgba(211,18,106,0.28);
              border-radius: 18px;
              box-shadow:
                inset 0 1px 0 #D3126A,
                0 28px 80px rgba(0,0,0,0.72),
                0 0 0 1px rgba(211,18,106,0.12);
              color: var(--desk-shell-text);
            }
            .de-desk-shell::before {
              content: none;
            }
            .de-desk-shell :is(button, a, input, textarea, select):focus-visible {
              outline: 2px solid var(--desk-pink);
              outline-offset: 2px;
            }
            .de-desk-shell ::selection {
              background: color-mix(in srgb, #D3126A 38%, transparent);
              color: #fff;
              -webkit-text-fill-color: #fff;
            }
            .de-desk-shell [role="tablist"] ::selection,
            .de-desk-shell [role="tablist"] *::selection {
              background: transparent;
              color: inherit;
              -webkit-text-fill-color: inherit;
            }
            .de-desk-head {
              position: relative;
              z-index: 1;
              display: flex;
              align-items: center;
              gap: 11px;
              padding: 16px 16px 10px;
              flex-shrink: 0;
            }
            .de-desk-id { display: flex; align-items: center; gap: 11px; min-width: 0; flex: 1; }
            .de-desk-avatar {
              position: relative;
              width: 32px; height: 32px;
              border-radius: 9px;
              background: var(--de-raised, #151217);
              border: 1px solid rgba(211,18,106,0.42);
              color: #fff;
              display: flex; align-items: center; justify-content: center;
              flex: none;
              font-family: "Space Grotesk", sans-serif;
              font-weight: 700;
              font-size: 11px;
              letter-spacing: 0.02em;
            }
            .de-desk-avatar-dot {
              position: absolute; right: -2px; bottom: -2px;
              width: 9px; height: 9px; border-radius: 50%;
              background: var(--desk-green);
              border: 2px solid var(--desk-shell);
            }
            .de-desk-avatar-dot::after,
            .de-desk-status-dot.is-on::after {
              content: "";
              position: absolute; inset: -3px; border-radius: 50%;
              background: var(--desk-green);
              opacity: 0.4;
              animation: de-desk-pulse 2s ease-out infinite;
            }
            @keyframes de-desk-pulse {
              0% { transform: scale(0.6); opacity: 0.5; }
              100% { transform: scale(2.2); opacity: 0; }
            }
            @media (prefers-reduced-motion: reduce) {
              .de-desk-avatar-dot::after,
              .de-desk-status-dot.is-on::after,
              .de-desk-shell .animate-pulse { animation: none !important; }
            }
            .de-desk-id h2 {
              font-family: "Space Grotesk", sans-serif;
              font-weight: 600;
              font-size: 17px;
              color: var(--desk-shell-text);
              line-height: 1.2;
            }
            .de-desk-id p { font-size: 14px; color: var(--desk-shell-muted); margin-top: 1px; }
            .de-desk-close {
              width: 44px; height: 44px; border-radius: 9px;
              border: 1px solid var(--de-hairline, rgba(255,255,255,0.10));
              background: transparent;
              color: rgba(255,255,255,0.72);
              display: flex; align-items: center; justify-content: center;
              flex: none;
            }
            .de-desk-close:hover { color: #fff; border-color: rgba(255,255,255,0.28); }
            .de-desk-tabs {
              position: relative;
              z-index: 1;
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 0;
              margin: 0 14px 8px;
              padding: 0;
              background: transparent;
              border: 0;
              border-bottom: 1px solid var(--de-hairline, rgba(255,255,255,0.10));
              border-radius: 0;
              flex-shrink: 0;
            }
            .de-desk-tab {
              box-sizing: border-box;
              background: transparent; border: none;
              min-height: 44px;
              padding: 8px 4px 10px;
              border-radius: 0;
              font-family: "Space Grotesk", sans-serif;
              font-weight: 600; font-size: 14.5px;
              color: rgba(255,255,255,0.62);
              display: flex; align-items: center; justify-content: center; gap: 6px;
              position: relative;
              white-space: nowrap;
              transition: color 0.16s ease;
            }
            .de-desk-tab svg { width: 14px; height: 14px; opacity: 0.75; }
            .de-desk-tab:hover { color: #fff; background: transparent; }
            .de-desk-tab.is-active {
              background: transparent;
              color: #fff;
              font-weight: 700;
              box-shadow: none;
            }
            .de-desk-tab.is-active::after {
              content: "";
              position: absolute;
              left: 10px; right: 10px; bottom: 0;
              height: 2px;
              background: #D3126A;
              border-radius: 2px 2px 0 0;
            }
            .de-desk-tab.is-active svg { opacity: 1; }
            .de-desk-tab-badge {
              min-width: 16px; height: 16px; padding: 0 4px;
              border-radius: 999px;
              background: #D3126A; color: #fff;
              font-size: 9px; font-weight: 700; line-height: 16px;
              letter-spacing: 0; text-align: center;
            }
            .de-desk-tab.has-unread { color: var(--desk-shell-text); }
            .de-desk-body {
              position: relative;
              z-index: 1;
              min-height: 0;
              flex: 1;
              display: flex;
              flex-direction: column;
              overflow: hidden;
            }
            .de-desk-panel, .de-desk-scroll {
              min-height: 0;
              flex: 1;
              display: flex;
              flex-direction: column;
            }
            .de-desk-scroll { overflow-y: auto; overflow-x: hidden; padding: 14px 16px 16px; }
            .de-desk-scroll > * { flex-shrink: 0; }
            .de-desk-shell[data-tab="chat"] .de-desk-scroll { padding-bottom: 8px; }
            .de-desk-hero {
              display: flex;
              flex-direction: column;
              align-items: flex-start;
              gap: 8px;
              padding: 16px;
              border: 1px solid var(--de-hairline, rgba(255,255,255,0.10));
              border-radius: 14px;
              background: var(--de-raised, #151217);
            }
            .de-desk-hero h3 {
              font-family: "Space Grotesk", sans-serif;
              font-size: 18px; font-weight: 700; color: #fff;
            }
            .de-desk-hero p { font-size: 14px; color: var(--desk-ink-muted); line-height: 1.5; }
            .de-desk-hero-ring {
              display: inline-flex; align-items: center; justify-content: center;
              width: 36px; height: 36px; border-radius: 999px;
              background: rgba(34,197,94,0.14); color: #4ade80;
            }
            .de-desk-row {
              display: flex; align-items: center; gap: 10px;
              min-height: 44px;
              padding: 11px 12px; border-radius: 10px;
              background: var(--de-raised, #151217);
              border: 1px solid var(--de-hairline, rgba(255,255,255,0.10));
              color: #fff; text-align: left; width: 100%;
            }
            .de-desk-msg { display: flex; gap: 10px; align-items: flex-start; }
            .de-desk-msg + .de-desk-msg { margin-top: 12px; }
            .de-desk-msg.is-user { justify-content: flex-end; }
            .de-desk-msg-id {
              position: relative;
              width: 32px; height: 32px; border-radius: 9px;
              background: var(--de-raised, #151217); color: #fff;
              border: 1px solid var(--de-hairline, rgba(255,255,255,0.10));
              display: flex; align-items: center; justify-content: center;
              font-family: "Space Grotesk", sans-serif;
              font-size: 10px; font-weight: 700; letter-spacing: 0.02em; flex: none;
            }
            .de-desk-msg-col { min-width: 0; flex: 1; }
            .de-desk-msg.is-user .de-desk-msg-col { flex: 0 1 auto; max-width: min(86%, 310px); }
            .de-desk-msg-who {
              display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px;
            }
            .de-desk-msg-who strong {
              font-family: "Space Grotesk", sans-serif;
              font-size: 14.5px; font-weight: 650; color: #fff;
            }
            .de-desk-msg-who em { font-style: normal; font-size: 13px; font-weight: 600; color: #4ade80; }
            .de-desk-scroll::-webkit-scrollbar {
              width: 6px;
            }
            .de-desk-scroll::-webkit-scrollbar-track {
              background: transparent;
            }
            .de-desk-scroll::-webkit-scrollbar-thumb {
              background: rgba(255,255,255,0.18);
              border-radius: 999px;
            }
            .de-desk-scroll::-webkit-scrollbar-thumb:hover {
              background: #D3126A;
            }
            .de-desk-incident {
              --desk-row-x: 28px;
              --desk-row-y: 50%;
              position: relative;
              isolation: isolate;
              overflow: hidden;
              display: flex; align-items: center; gap: 12px;
              width: 100%; text-align: left;
              min-height: 54px;
              margin: 2px 0 16px;
              padding: 12px 14px;
              border: 1px solid rgba(20,16,30,0.12);
              border-radius: 13px;
              background: #fff;
              color: #17141f;
              box-shadow: inset 3px 0 0 #D3126A;
              transition:
                background 0.3s cubic-bezier(0.22, 1, 0.36, 1),
                box-shadow 0.3s cubic-bezier(0.22, 1, 0.36, 1),
                transform 0.3s cubic-bezier(0.22, 1, 0.36, 1),
                border-color 0.3s ease;
            }
            .de-desk-incident::before {
              content: "";
              position: absolute;
              inset: 0;
              pointer-events: none;
              opacity: 0;
              background: radial-gradient(
                160px circle at var(--desk-row-x) var(--desk-row-y),
                #fff 0%,
                rgba(255,255,255,0.7) 38%,
                transparent 70%
              );
              transition: opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1);
            }
            .de-desk-incident > * { position: relative; z-index: 1; }
            @media (hover: hover) and (pointer: fine) {
              .de-desk-incident:hover {
                background: #fff;
                border-color: rgba(20,16,30,0.10);
                transform: translateY(-1px);
                box-shadow:
                  inset 3px 0 0 #D3126A,
                  0 14px 28px -18px rgba(20,16,30,0.28);
              }
              .de-desk-incident:hover::before { opacity: 1; }
            }
            .de-desk-incident.is-on {
              border-color: rgba(211,18,106,0.45);
              background: #fff;
              box-shadow: inset 3px 0 0 #D3126A, 0 0 0 1px rgba(211,18,106,0.28);
            }
            .de-desk-incident-icon {
              display: inline-flex; flex: none;
              width: 39px; height: 39px;
              align-items: center; justify-content: center;
              border-radius: 11px;
              border: 1px solid color-mix(in srgb, #D3126A 38%, transparent);
              background: color-mix(in srgb, #D3126A 8%, #fff);
              color: #D3126A;
            }
            .de-desk-incident:hover .de-desk-incident-icon { background: #fff; }
            .de-desk-incident-icon svg { width: 17px; height: 17px; stroke-width: 1.9; }
            .de-desk-incident-copy { display: flex; flex-direction: column; min-width: 0; flex: 1; }
            .de-desk-incident-copy strong {
              font-family: "Space Grotesk", sans-serif;
              font-size: 14.5px; font-weight: 650; line-height: 1.3;
              color: #17141f;
            }
            .de-desk-incident-copy span {
              margin-top: 2px;
              color: #5c5668;
              font-size: 12.75px; line-height: 1.4;
            }
            .de-desk-incident-arrow {
              width: 15px; height: 15px; flex: none;
              color: #726c82;
            }
            .de-desk-incident:hover .de-desk-incident-arrow { color: #D3126A; }
            .de-desk-form {
              display: flex;
              flex-direction: column;
              gap: 14px;
              padding: 16px;
              margin: 0 0 8px;
              background: var(--de-raised, #151217);
              border: 1px solid var(--de-hairline, rgba(255,255,255,0.10));
              border-radius: 16px;
            }
            .de-desk-issue-list {
              overflow: visible;
              width: 100%;
              display: flex;
              flex-direction: column;
              margin: 0 0 16px;
              border: 1px solid rgba(20,16,30,0.12);
              border-radius: 15px;
              background: #fff;
              box-shadow:
                0 1px 0 rgba(255,255,255,0.9) inset,
                0 12px 28px -24px rgba(20,16,30,0.34);
            }
            .de-desk-issue-row {
              --desk-row-x: 28px;
              --desk-row-y: 50%;
              position: relative;
              isolation: isolate;
              overflow: hidden;
              display: flex;
              align-items: center;
              gap: 12px;
              width: 100%;
              text-align: left;
              min-height: 48px;
              padding: 12px 14px;
              border: 0;
              border-bottom: 1px solid rgba(20,16,30,0.08);
              border-radius: 0;
              background: #fff;
              color: #17141f;
              font-family: "Space Grotesk", sans-serif;
              font-size: 14.5px; font-weight: 650; line-height: 1.3;
              transition:
                background 0.3s cubic-bezier(0.22, 1, 0.36, 1),
                box-shadow 0.3s cubic-bezier(0.22, 1, 0.36, 1),
                transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
            }
            .de-desk-issue-row::before {
              content: "";
              position: absolute;
              inset: 0;
              pointer-events: none;
              z-index: 0;
              opacity: 0;
              background: radial-gradient(
                170px circle at var(--desk-row-x) var(--desk-row-y),
                #fff 0%,
                rgba(255,255,255,0.72) 36%,
                transparent 68%
              );
              transition: opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1);
            }
            .de-desk-issue-row::after {
              content: "";
              position: absolute;
              inset: 0;
              pointer-events: none;
              z-index: 0;
              background: linear-gradient(
                108deg,
                transparent 28%,
                rgba(255,255,255,0.95) 48%,
                transparent 68%
              );
              transform: translateX(-42%);
              opacity: 0;
              transition:
                transform 0.7s cubic-bezier(0.22, 1, 0.36, 1),
                opacity 0.35s ease;
            }
            .de-desk-issue-row > * { position: relative; z-index: 1; }
            .de-desk-issue-row:first-child { border-radius: 15px 15px 0 0; }
            .de-desk-issue-row:last-child { border-bottom: 0; border-radius: 0 0 15px 15px; }
            .de-desk-issue-row:first-child:last-child { border-radius: 15px; }
            @media (hover: hover) and (pointer: fine) {
              .de-desk-issue-row:hover {
                z-index: 2;
                background: #fff;
                transform: translateY(-1px);
                box-shadow: 0 12px 26px -16px rgba(20,16,30,0.28);
              }
              .de-desk-issue-row:hover::before { opacity: 1; }
              .de-desk-issue-row:hover::after {
                opacity: 1;
                transform: translateX(42%);
              }
            }
            .de-desk-issue-row.is-on {
              background: color-mix(in srgb, #D3126A 6%, #fff);
              box-shadow: inset 3px 0 0 #D3126A;
              color: #17141f;
            }
            .de-desk-issue-row.is-on:hover {
              background: #fff;
              box-shadow:
                inset 3px 0 0 #D3126A,
                0 12px 26px -16px rgba(20,16,30,0.28);
            }
            .de-desk-issue-icon {
              display: inline-flex; flex: none;
              width: 36px; height: 36px;
              align-items: center; justify-content: center;
              border-radius: 10px;
              border: 1px solid rgba(20,16,30,0.10);
              background: #f7f5f2;
              color: #D3126A;
              transition:
                background 0.3s cubic-bezier(0.22, 1, 0.36, 1),
                border-color 0.3s ease;
            }
            .de-desk-issue-row:hover .de-desk-issue-icon {
              background: #fff;
              border-color: rgba(20,16,30,0.08);
            }
            .de-desk-issue-label {
              flex: 1; min-width: 0;
              overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
              color: #17141f;
            }
            .de-desk-issue-arrow {
              width: 15px; height: 15px; flex: none;
              color: #726c82;
              transition: color 0.3s ease, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
            }
            .de-desk-issue-row:hover .de-desk-issue-arrow {
              color: #D3126A;
              transform: translateX(2px);
            }
            .de-desk-issue-row.is-on .de-desk-issue-arrow { color: #D3126A; }
            .de-desk-issues {
              display: flex; flex-wrap: wrap; gap: 6px;
            }
            .de-desk-issue {
              border: 1px solid var(--desk-border);
              background: var(--desk-box);
              color: rgba(255,255,255,0.82);
              border-radius: 8px;
              min-height: 40px;
              padding: 8px 12px;
              font-size: 12.5px; font-weight: 600;
            }
            .de-desk-issue:hover { border-color: var(--desk-border-strong); color: #fff; }
            .de-desk-issue.is-on {
              border-color: #D3126A;
              color: #fff;
              box-shadow: inset 0 0 0 1px rgba(211,18,106,0.28);
            }
            .de-desk-issue.is-incident.is-on { background: rgba(211,18,106,0.12); }
            .de-desk-urgency-label {
              display: block; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.92); margin-bottom: 6px;
            }
            .de-desk-urgency {
              display: grid; grid-template-columns: repeat(4, 1fr);
              gap: 4px;
              background: rgba(255,255,255,0.06);
              padding: 4px;
              border-radius: 11px;
              border: 1px solid rgba(255,255,255,0.12);
            }
            .de-desk-urgency button {
              min-height: 44px; border: none;
              border-radius: 8px;
              background: transparent; color: rgba(255,255,255,0.72);
              font-size: 12.5px; font-weight: 600;
              transition: background 0.15s ease, color 0.15s ease;
            }
            .de-desk-urgency button:hover {
              background: rgba(255,255,255,0.08);
              color: #fff;
            }
            .de-desk-urgency button.is-on {
              background: #D3126A; color: #fff; font-weight: 700;
              box-shadow: 0 3px 10px rgba(211,18,106,0.35);
            }
            .de-desk-more-toggle {
              align-self: flex-start;
              background: none; border: 0; padding: 8px 0;
              min-height: 40px;
              color: #D3126A; font-size: 13px; font-weight: 600;
            }
            .de-desk-more { display: flex; flex-direction: column; gap: 12px; }
            .de-desk-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .de-desk-field label {
              display: block; font-size: 11px; font-weight: 800;
              letter-spacing: 0.08em; text-transform: uppercase;
              color: rgba(255,255,255,0.92); margin-bottom: 6px;
            }
            .de-desk-input-wrap { position: relative; }
            .de-desk-input-wrap > svg {
              position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
              width: 15px; height: 15px; color: rgba(255,255,255,0.72); pointer-events: none;
            }
            .de-desk-shell .de-desk-input {
              --desk-spot-x: 50%;
              --desk-spot-y: 50%;
              width: 100%;
              min-height: 46px;
              height: 46px;
              border: 1px solid transparent !important;
              background-color: var(--de-raised, #151217) !important;
              background-image:
                linear-gradient(var(--de-raised, #151217), var(--de-raised, #151217)),
                linear-gradient(rgba(255,255,255,0.88), rgba(255,255,255,0.88)) !important;
              background-origin: border-box;
              background-clip: padding-box, border-box;
              color: #fff !important;
              border-radius: 11px;
              padding: 10px 14px 10px 34px;
              font-size: 14px;
              box-shadow:
                inset 0 2px 4px rgba(0,0,0,0.4),
                0 0 0 1px rgba(255,255,255,0.5) !important;
              transition: box-shadow 0.2s ease-out;
            }
            @media (hover: hover) and (pointer: fine) {
              .de-desk-shell .de-desk-input:hover:not(:focus):not([aria-invalid="true"]) {
                background-image:
                  linear-gradient(var(--de-raised, #151217), var(--de-raised, #151217)),
                  radial-gradient(
                    170px circle at var(--desk-spot-x) var(--desk-spot-y),
                    #fff 0%,
                    rgba(255,255,255,0.82) 26%,
                    rgba(255,255,255,0.42) 100%
                  ) !important;
                box-shadow:
                  inset 0 2px 4px rgba(0,0,0,0.4),
                  0 0 0 1px rgba(255,255,255,0.14),
                  0 0 18px rgba(255,255,255,0.12) !important;
              }
            }
            .de-desk-shell .de-desk-input:focus,
            .de-desk-shell .de-desk-input:focus-visible {
              background-image:
                linear-gradient(var(--de-raised, #151217), var(--de-raised, #151217)),
                linear-gradient(#D3126A, #D3126A) !important;
              box-shadow: 0 0 0 3px rgba(211,18,106,0.25), inset 0 2px 4px rgba(0,0,0,0.4) !important;
              outline: 2px solid #D3126A !important;
              outline-offset: 2px;
            }
            .de-desk-shell .de-desk-input[aria-invalid="true"] {
              background-image:
                linear-gradient(var(--de-raised, #151217), var(--de-raised, #151217)),
                linear-gradient(#f0455b, #f0455b) !important;
            }
            @media (prefers-reduced-motion: reduce) {
              .de-desk-shell .de-desk-input {
                transition: none;
              }
              .de-desk-shell .de-desk-input:hover:not(:focus):not([aria-invalid="true"]) {
                background-image:
                  linear-gradient(var(--de-raised, #151217), var(--de-raised, #151217)),
                  linear-gradient(rgba(255,255,255,0.88), rgba(255,255,255,0.88)) !important;
                box-shadow:
                  inset 0 2px 4px rgba(0,0,0,0.4),
                  0 0 0 1px rgba(255,255,255,0.5) !important;
              }
            }
            .de-desk-field-error {
              margin: 6px 0 0;
              color: #fecaca;
              font-size: 12px;
              line-height: 1.4;
            }
            .de-desk-form-error {
              padding: 10px 12px;
              border: 1px solid rgba(240,69,91,0.4);
              border-radius: 10px;
              background: var(--de-bg, #050312);
              color: #fecaca;
              font-size: 13px;
              line-height: 1.45;
            }
            .de-desk-form-phone {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              width: 100%;
              min-height: 44px;
              margin-top: 2px;
              color: #fff;
              font-size: 13.5px;
              font-weight: 600;
              text-decoration: none;
            }
            .de-desk-form-phone svg { width: 15px; height: 15px; color: #D3126A; }
            .de-desk-form-phone:hover { color: #D3126A; }
            .de-desk-shell .de-desk-input.is-bare { padding-left: 14px; }
            .de-desk-shell .de-desk-input::placeholder { color: rgba(255,255,255,0.52); }
            .de-desk-shell .de-desk-select { appearance: none; padding-right: 28px; }
            .de-desk-shell .de-desk-select option { background: #151217; color: #fff; }
            .de-desk-select-chev {
              position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
              width: 12px; height: 12px; color: var(--desk-ink-dim); pointer-events: none;
            }
            .de-desk-ta-wrap { position: relative; }
            .de-desk-shell .de-desk-ta {
              min-height: 90px; height: auto; padding-left: 14px; resize: vertical;
              line-height: 1.5;
            }
            .de-desk-counter {
              position: absolute; right: 10px; bottom: 8px;
              font-size: 10px; color: var(--desk-ink-dim); pointer-events: none;
            }
            .de-desk-attach {
              display: flex; align-items: flex-start; gap: 9px;
              width: 100%; text-align: left;
              margin-top: 2px; padding: 12px;
              border: 1px dashed rgba(255,255,255,0.25);
              border-radius: 11px; background: rgba(255,255,255,0.04);
              transition: all 0.15s ease;
            }
            .de-desk-attach:hover { border-color: var(--desk-pink); background: rgba(211,18,106,0.08); }
            .de-desk-attach svg { width: 14px; height: 14px; color: rgba(255,255,255,0.65); flex: none; margin-top: 2px; }
            .de-desk-attach-t { display: block; font-size: 14px; font-weight: 600; color: #fff; }
            .de-desk-attach-h { display: block; font-size: 12.5px; color: var(--desk-ink-muted); margin-top: 1px; }
            .de-desk-caption {
              display: flex; align-items: center; gap: 6px;
              font-size: 13px; color: var(--desk-shell-muted);
            }
            .de-desk-caption svg { width: 11px; height: 11px; }
            .de-desk-btn-grad {
              width: 100%; margin-top: 8px;
              min-height: 48px;
              background: linear-gradient(135deg, #D3126A 0%, #E61E76 100%);
              border: none; color: #fff;
              font-weight: 700; font-size: 15px; padding: 12px;
              border-radius: 12px;
              display: flex; align-items: center; justify-content: center; gap: 8px;
              box-shadow: 0 8px 24px -6px rgba(211,18,106,0.5);
              transition: all 0.18s ease;
            }
            .de-desk-btn-grad:hover {
              background: linear-gradient(135deg, #bd105f 0%, #D3126A 100%);
              transform: translateY(-1px);
              box-shadow: 0 10px 28px -6px rgba(211,18,106,0.6);
            }
            .de-desk-ticket-upper {
              display: flex;
              flex-direction: column;
              margin: 0 0 14px;
            }
            .de-desk-ticket-lead {
              padding: 0;
              margin: 0 0 14px;
              background: transparent;
              border: 0;
            }
            .de-desk-ticket-lead h3 {
              font-family: "Space Grotesk", sans-serif;
              font-size: 17px;
              font-weight: 700;
              letter-spacing: -0.015em;
              color: #ffffff;
              margin: 0;
              line-height: 1.25;
            }
            .de-desk-ticket-lead > p {
              font-size: 13.5px;
              color: rgba(255,255,255,0.68);
              margin: 4px 0 0;
              line-height: 1.45;
            }
            .de-desk-perk-list {
              list-style: none;
              margin: 12px 0 0;
              padding: 4px 0 0;
              border-top: 1px solid var(--de-hairline, rgba(255,255,255,0.10));
              display: flex;
              flex-direction: column;
              gap: 6px;
            }
            .de-desk-perk-list li {
              position: relative;
              padding: 0 0 0 14px;
              font-size: 12.75px;
              line-height: 1.4;
              color: rgba(255,255,255,0.62);
              font-weight: 500;
            }
            .de-desk-perk-list li::before {
              content: "";
              position: absolute;
              left: 0; top: 0.55em;
              width: 6px; height: 6px;
              border-radius: 50%;
              background: #D3126A;
            }
            .de-desk-route-note {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 5px 10px;
              background: rgba(211,18,106,0.12);
              border: 1px solid rgba(211,18,106,0.3);
              border-radius: 8px;
              font-size: 12px;
              font-weight: 600;
              color: #ff6ab0;
              margin-bottom: 4px;
            }
            .de-desk-bubble {
              max-width: 100%;
              min-width: 0;
              padding: 10px 13px;
              font-size: 15px; line-height: 1.5;
              border-radius: 12px;
              overflow-wrap: anywhere;
              word-break: break-word;
            }
            .de-desk-bubble.is-user {
              background: #D3126A; color: #fff;
              border-bottom-right-radius: 5px;
            }
            .de-desk-bubble.is-bot, .de-desk-bubble.is-agent {
              background: var(--de-raised, #151217); color: #fff;
              border: 1px solid var(--de-hairline, rgba(255,255,255,0.10));
              border-bottom-left-radius: 5px;
              max-width: 640px; /* keeps chat readable in the full-screen desk */
            }
            .de-desk-msg-time {
              display: block;
              margin-top: 5px;
              font-size: 11px;
              font-weight: 500;
              letter-spacing: 0.02em;
              color: rgba(255,255,255,0.38);
              font-variant-numeric: tabular-nums;
            }
            .de-desk-msg.is-user .de-desk-msg-time { text-align: right; }
            @media (prefers-reduced-motion: reduce) {
              .de-desk-msg-time { transition: none; }
            }
            .de-desk-discover {
              margin: 12px 0 2px;
              display: flex;
              flex-direction: column;
            }
            .de-desk-discover-intro {
              margin: 0 0 8px;
            }
            .de-desk-discover-intro h3 {
              margin: 0;
              font-family: "Space Grotesk", sans-serif;
              font-size: 17px;
              font-weight: 700;
              line-height: 1.25;
              letter-spacing: -0.015em;
              color: #fff;
            }
            .de-desk-discover-intro p {
              margin: 4px 0 0;
              color: rgba(255,255,255,0.68);
              font-size: 14.5px;
              line-height: 1.45;
            }
            .de-desk-discover-list {
              overflow: hidden;
              width: 100%;
              display: flex;
              flex-direction: column;
              border: 1px solid var(--de-hairline, rgba(255,255,255,0.10));
              border-radius: 15px;
              background: var(--de-raised, #151217);
            }
            .de-desk-discover-row {
              display: flex;
              align-items: center;
              gap: 12px;
              width: 100%;
              min-height: 44px;
              padding: 10px 12px 10px 13px;
              background: transparent;
              border: 0;
              border-bottom: 1px solid var(--de-hairline, rgba(255,255,255,0.10));
              color: #fff;
              font-family: "Space Grotesk", sans-serif;
              font-size: 15px;
              font-weight: 650;
              line-height: 1.3;
              text-align: left;
              cursor: pointer;
              transition: background 0.15s ease;
            }
            .de-desk-discover-row:last-child { border-bottom: 0; }
            .de-desk-discover-row:hover {
              background: rgba(255,255,255,0.04);
            }
            .de-desk-discover-row.is-incident {
              box-shadow: inset 3px 0 0 #D3126A;
            }
            .de-desk-discover-row.is-incident:hover {
              background: rgba(211,18,106,0.10);
            }
            .de-desk-discover-icon {
              display: inline-flex; flex: none;
              width: 32px; height: 32px;
              align-items: center; justify-content: center;
              border-radius: 9px;
              border: 1px solid var(--de-hairline, rgba(255,255,255,0.10));
              background: var(--de-bg, #050312);
              color: #D3126A;
            }
            .de-desk-discover-icon svg { width: 15px; height: 15px; stroke-width: 1.9; }
            .de-desk-discover-label {
              flex: 1; min-width: 0;
              overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            }
            .de-desk-discover-arrow {
              width: 15px; height: 15px; flex: none;
              color: rgba(255,255,255,0.38);
            }
            .de-desk-discover-row:hover .de-desk-discover-arrow { color: #D3126A; }
            .de-desk-chips {
              display: flex; flex-direction: column;
              gap: 0;
              margin-top: 10px;
              overflow: hidden;
              border: 1px solid var(--de-hairline, rgba(255,255,255,0.10));
              border-radius: 15px;
              background: var(--de-raised, #151217);
            }
            .de-desk-chip {
              display: flex;
              align-items: center;
              gap: 10px;
              width: 100%;
              min-height: 44px;
              padding: 10px 12px;
              border: 0;
              border-bottom: 1px solid var(--de-hairline, rgba(255,255,255,0.10));
              border-radius: 0;
              background: transparent;
              color: #fff;
              font-family: "Space Grotesk", sans-serif;
              font-size: 14.5px; font-weight: 650;
              text-align: left;
              transition: background 0.15s ease;
            }
            .de-desk-chip:last-child { border-bottom: 0; }
            .de-desk-chip:hover {
              background: rgba(211,18,106,0.10);
              color: #fff;
            }
            .de-desk-chip-icon {
              display: inline-flex; flex: none;
              width: 32px; height: 32px;
              align-items: center; justify-content: center;
              border-radius: 9px;
              border: 1px solid var(--de-hairline, rgba(255,255,255,0.10));
              background: var(--de-bg, #050312);
            }
            .de-desk-chip-label {
              flex: 1; min-width: 0;
              overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            }
            .de-desk-chip-arrow {
              width: 14px; height: 14px; flex: none;
              color: rgba(255,255,255,0.38);
            }
            .de-desk-chip:hover .de-desk-chip-arrow { color: #D3126A; }
            .de-desk-bubble-meta {
              display: flex; align-items: center; gap: 8px;
              margin-bottom: 6px;
              font-size: 10px; font-weight: 600;
              letter-spacing: 0.14em; text-transform: uppercase;
              color: var(--desk-pink);
            }
            .de-desk-bubble-meta span {
              width: 16px; height: 16px; border-radius: 4px;
              background: var(--desk-pink); color: #fff;
              display: inline-flex; align-items: center; justify-content: center;
              font-size: 8px; letter-spacing: 0;
            }
            .de-desk-success { flex-direction: column; align-items: flex-start; }
            .de-desk-success p { max-width: none; }
            .de-desk-ticket-ref {
              font-family: ui-monospace, monospace;
              font-size: 13px; font-weight: 600; color: var(--desk-pink);
              margin-top: 8px;
            }
            .de-desk-success-actions { display: flex; flex-direction: column; gap: 8px; width: 100%; margin-top: 14px; }
            .de-desk-heads-up {
              position: absolute;
              left: 10px; right: 10px; bottom: 10px;
              z-index: 6;
              display: flex; align-items: stretch; gap: 4px;
              padding: 8px 8px 8px 8px;
              border-radius: 14px;
              background: var(--desk-box);
              border: 1px solid rgba(211,18,106,0.42);
              box-shadow: 0 16px 36px rgba(0,0,0,0.45);
              animation: de-desk-heads-in 0.28s ease-out;
            }
            .de-desk-heads-up.is-out { border-color: rgba(255,255,255,0.16); }
            .de-desk-heads-up.is-live { border-color: #3b9eff; }
            .de-desk-heads-up-main {
              flex: 1; min-width: 0;
              display: flex; align-items: flex-start; gap: 10px;
              text-align: left; background: none; border: none; color: inherit;
              padding: 2px 4px;
            }
            .de-desk-heads-up-mark {
              width: 28px; height: 28px; border-radius: 9px; flex: none;
              display: inline-flex; align-items: center; justify-content: center;
              background: var(--desk-pink); color: #fff;
              font-size: 9px; font-weight: 700; letter-spacing: 0.04em;
            }
            .de-desk-heads-up.is-out .de-desk-heads-up-mark { background: #3a3644; }
            .de-desk-heads-up.is-live .de-desk-heads-up-mark { background: #3b9eff; }
            .de-desk-heads-up-copy { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
            .de-desk-heads-up-top {
              display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
            }
            .de-desk-heads-up-top strong {
              font-size: 13.5px; font-weight: 700; color: #fff;
            }
            .de-desk-heads-up-top em {
              font-style: normal; font-size: 11px; color: var(--desk-ink-dim); flex: none;
            }
            .de-desk-heads-up-preview {
              font-size: 13.5px; line-height: 1.35; color: var(--desk-ink-muted);
              display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
            }
            .de-desk-heads-up-hint {
              font-size: 10.5px; font-weight: 600; color: var(--desk-pink); margin-top: 2px;
            }
            .de-desk-heads-up-x {
              width: 28px; height: 28px; border-radius: 8px; flex: none; align-self: flex-start;
              border: none; background: transparent; color: var(--desk-ink-dim);
              display: flex; align-items: center; justify-content: center;
            }
            .de-desk-heads-up-x:hover { color: var(--desk-ink); background: rgba(255,255,255,0.08); }
            @keyframes de-desk-heads-in {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @media (prefers-reduced-motion: reduce) {
              .de-desk-heads-up,
              .de-desk-shell .animate-pulse { animation: none !important; }
            }
            .de-desk-composer {
              position: relative;
              z-index: 1;
              display: flex; gap: 8px;
              margin: 0;
              padding: 10px 16px 8px;
              border-top: 1px solid var(--de-hairline, rgba(255,255,255,0.10));
              background: var(--de-surface, #0a0a0a);
              color: #fff;
              flex-shrink: 0;
            }
            .de-desk-composer.is-live input {
              border-color: rgba(211,18,106,0.6);
              box-shadow: 0 0 0 3px rgba(211,18,106,0.15);
            }
            .de-desk-composer input {
              flex: 1;
              min-height: 44px;
              background: var(--de-raised, #151217);
              border: 1px solid var(--de-hairline, rgba(255,255,255,0.10));
              border-radius: 10px;
              padding: 10px 14px;
              color: #fff; font-size: 15.5px;
            }
            .de-desk-shell input:-webkit-autofill,
            .de-desk-shell textarea:-webkit-autofill {
              -webkit-box-shadow: 0 0 0 1000px #151217 inset;
              -webkit-text-fill-color: #fff;
              caret-color: #fff;
            }
            .de-desk-composer input::placeholder { color: var(--desk-ink-dim); }
            .de-desk-composer input:focus {
              outline: none;
              border-color: #D3126A;
              box-shadow: 0 0 0 3px rgba(211,18,106,0.16);
            }
            .de-desk-send {
              width: 44px; height: 44px; border-radius: 10px;
              background: #D3126A; border: none;
              display: flex; align-items: center; justify-content: center;
              flex: none;
              box-shadow: 0 8px 18px -10px rgba(211,18,106,0.8);
            }
            .de-desk-send:hover:not(:disabled) { background: #bd105f; }
            .de-desk-send:disabled { opacity: 0.5; box-shadow: none; }
            .de-desk-send svg { width: 16px; height: 16px; color: #fff; }
            .de-desk-composer-caption {
              position: relative;
              z-index: 1;
              display: flex; align-items: center; gap: 6px;
              margin: 0;
              padding: 0 16px 10px;
              background: transparent;
              font-size: 13px; color: rgba(255,255,255,0.46);
              flex-shrink: 0;
            }
            .de-desk-composer-caption svg { width: 11px; height: 11px; color: rgba(255,255,255,0.46); }
            .de-desk-shell[data-tab="ticket"] .de-desk-body,
            .de-desk-shell[data-tab="resources"] .de-desk-body {
              margin-bottom: 0;
              border-radius: 0;
              padding-bottom: 16px;
            }
            .de-desk-shell[data-tab="resources"] .de-desk-row,
            .de-desk-shell[data-tab="ticket"] .de-desk-row {
              background: #16121e;
              color: #f7f5f2;
            }
            .de-desk-shell[data-tab="resources"] .de-desk-row-t,
            .de-desk-shell[data-tab="ticket"] .de-desk-row-t { color: #f7f5f2; }
            .de-desk-shell[data-tab="resources"] .de-desk-row-d { color: rgba(247,245,242,0.65); }
            .de-desk-shell[data-tab="ticket"] .de-desk-heads-up-top strong,
            .de-desk-shell[data-tab="resources"] .de-desk-heads-up-top strong { color: #f7f5f2; }
            .de-desk-tools-panel .de-desk-scroll {
              gap: 0;
              padding: 16px 16px 14px;
            }
            .de-desk-tools-intro {
              margin: 1px 0 14px;
            }
            .de-desk-tools-intro h3 {
              margin: 0;
              font-family: "Space Grotesk", sans-serif;
              font-size: 18px;
              font-weight: 700;
              line-height: 1.25;
              letter-spacing: -0.015em;
              color: #fff;
            }
            .de-desk-tools-intro p {
              margin: 4px 0 0;
              color: rgba(255,255,255,0.68);
              font-size: 14.5px;
              line-height: 1.45;
            }
            .de-desk-tools-kicker {
              margin: 10px 0 6px !important;
              color: #fff !important;
              font-family: "Space Grotesk", sans-serif;
              font-size: 16px !important;
              font-weight: 650;
              line-height: 1.35 !important;
            }
            .de-desk-tools-gate { display: flex; flex-direction: column; gap: 0; }
            .de-desk-signin {
              display: inline-flex;
              align-items: center; justify-content: center; gap: 8px;
              min-height: 44px;
              margin: 16px 0 8px;
              padding: 11px 16px;
              border: 0; border-radius: 10px;
              background: #D3126A; color: #fff;
              font-family: inherit;
              font-size: 14.5px; font-weight: 700;
              text-decoration: none;
              cursor: pointer;
              box-shadow: 0 8px 18px -10px rgba(211,18,106,0.8);
            }
            .de-desk-signin:hover { background: #bd105f; }
            .de-desk-signin svg { width: 16px; height: 16px; }
            .de-desk-signin:focus-visible,
            .de-desk-launch-row:focus-visible {
              outline: 2px solid #D3126A;
              outline-offset: 2px;
            }
            .de-desk-signin-alt {
              align-self: flex-start;
              display: inline-flex; align-items: center;
              min-height: 40px;
              margin: 0 0 14px;
              color: rgba(255,255,255,0.62);
              font-size: 13px;
              text-decoration: underline;
              text-underline-offset: 3px;
            }
            .de-desk-signin-alt:hover { color: #fff; }
            .de-desk-login-slot { margin-top: 16px; }
            .de-desk-login-slot .de-desk-form { margin: 0 0 4px; }
            .de-desk-login .de-desk-btn-grad {
              display: inline-flex; align-items: center; justify-content: center; gap: 8px;
            }
            .de-desk-login .de-desk-btn-grad svg { width: 16px; height: 16px; }
            .de-desk-login .de-desk-form-error {
              display: flex; align-items: flex-start; gap: 8px;
            }
            .de-desk-login .de-desk-form-error svg {
              width: 15px; height: 15px; flex-shrink: 0; margin-top: 2px;
            }
            .de-desk-login-hint {
              display: flex; align-items: flex-start; gap: 8px;
              margin: 0;
              color: rgba(255,255,255,0.68);
              font-size: 13px; line-height: 1.45;
            }
            .de-desk-login-hint svg {
              width: 15px; height: 15px; flex-shrink: 0; margin-top: 2px; color: #D3126A;
            }
            .de-desk-login-links {
              display: flex; justify-content: space-between; gap: 10px;
            }
            .de-desk-login-links a {
              display: inline-flex; align-items: center;
              min-height: 40px;
              color: #D3126A;
              font-size: 13px; font-weight: 600;
              text-decoration: none;
            }
            .de-desk-login-links a:hover { text-decoration: underline; }
            .de-desk-login .de-desk-more-toggle {
              display: inline-flex; align-items: center; gap: 6px;
            }
            .de-desk-login .de-desk-more-toggle svg { width: 14px; height: 14px; }
            .de-desk-tools-now {
              padding-top: 16px;
              border-top: 1px solid var(--de-hairline, rgba(255,255,255,0.10));
            }
            .de-desk-tools-list button.de-desk-tool-link {
              border: 0;
              background: transparent;
              cursor: pointer;
              font: inherit;
            }
            .de-desk-tool-link {
              min-height: 44px;
            }
            .de-desk-launch-group { margin-bottom: 14px; }
            .de-desk-launch-heading {
              margin: 0 0 8px;
              color: rgba(255,255,255,0.52);
              font-size: 12px;
              font-weight: 700;
              letter-spacing: 0.08em;
              text-transform: uppercase;
            }
            .de-desk-launch-list,
            .de-desk-tools-now {
              display: flex; flex-direction: column; gap: 4px;
            }
            .de-desk-launch-row {
              display: flex; align-items: center; gap: 10px;
              width: 100%; min-height: 44px;
              padding: 8px 10px;
              border: 1px solid var(--de-hairline, rgba(255,255,255,0.10));
              border-radius: 10px;
              background: var(--de-raised, #151217);
              color: #f7f5f2;
              text-align: left;
              text-decoration: none;
            }
            .de-desk-launch-row:hover {
              border-color: rgba(255,255,255,0.22);
              background: #1a171c;
            }
            .de-desk-launch-icon {
              display: inline-flex; flex: none;
              width: 28px; height: 28px;
              align-items: center; justify-content: center;
              border-radius: 8px;
              border: 1px solid rgba(255,255,255,0.10);
              color: #D3126A;
            }
            .de-desk-launch-icon svg { width: 14px; height: 14px; }
            .de-desk-launch-title {
              flex: 1; min-width: 0;
              font-size: 14.5px; font-weight: 650;
            }
            .de-desk-tools-list {
              --desk-ink: #17141f;
              --desk-ink-muted: #5c5668;
              --desk-ink-dim: #726c82;
              --desk-border: rgba(20,16,30,0.08);
              --desk-border-strong: rgba(20,16,30,0.12);
              overflow: hidden;
              width: 100%;
              border: 1px solid var(--desk-border-strong);
              border-radius: 15px;
              background: #fff;
              box-shadow:
                0 1px 0 rgba(255,255,255,0.9) inset,
                0 12px 28px -24px rgba(20,16,30,0.34);
            }
            .de-desk-tool-group {
              position: relative;
              background: #fff;
              border-bottom: 1px solid var(--desk-border);
            }
            .de-desk-tool-group:last-child {
              border-bottom: 0;
            }
            .de-desk-tool-group.is-featured {
              background:
                linear-gradient(
                  90deg,
                  rgba(211,18,106,0.055),
                  rgba(211,18,106,0.018) 62%,
                  transparent
                ),
                #fff;
            }
            .de-desk-tool-group.is-featured::before {
              content: "";
              position: absolute;
              left: 0;
              top: 11px;
              bottom: 11px;
              width: 3px;
              border-radius: 0 999px 999px 0;
              background: var(--desk-pink);
            }
            .de-desk-tool-link {
              --tool-color: #17141f;
              display: flex;
              width: 100%;
              min-width: 0;
              align-items: center;
              gap: 12px;
              padding: 14px 14px 14px 15px;
              color: var(--desk-ink);
              text-align: left;
              text-decoration: none;
              transition:
                background-color 150ms ease,
                color 150ms ease;
            }
            .de-desk-tool-group.is-featured .de-desk-tool-link { --tool-color: var(--desk-pink); }
            .de-desk-tool-link:hover { background: rgba(20,16,30,0.025); }
            .de-desk-tool-link:focus-visible,
            .de-desk-tool-guide:focus-visible,
            .de-desk-security-action:focus-visible {
              outline: 2px solid var(--desk-pink);
              outline-offset: -2px;
            }
            .de-desk-tool-icon {
              display: inline-flex;
              flex: 0 0 auto;
              width: 39px;
              height: 39px;
              align-items: center;
              justify-content: center;
              border: 1px solid rgba(20,16,30,0.10);
              border-radius: 11px;
              background: #f7f5f2;
              color: var(--tool-color);
            }
            .de-desk-tool-group.is-featured .de-desk-tool-icon {
              border-color: color-mix(in srgb, #D3126A 38%, transparent);
              background: color-mix(in srgb, #D3126A 8%, #fff);
            }
            .de-desk-tool-icon svg { width: 17px; height: 17px; stroke-width: 1.9; }
            .de-desk-tool-copy {
              display: block;
              flex: 1 1 auto;
              min-width: 0;
            }
            .de-desk-tool-title-line {
              display: flex;
              min-width: 0;
              align-items: center;
              gap: 7px;
            }
            .de-desk-tool-title {
              color: var(--desk-ink);
              font-family: "Space Grotesk", sans-serif;
              font-size: 15.5px;
              font-weight: 650;
              line-height: 1.3;
            }
            .de-desk-tool-description {
              display: block;
              margin-top: 2px;
              color: var(--desk-ink-muted);
              font-size: 13.75px;
              line-height: 1.4;
            }
            .de-desk-tool-badge {
              display: inline-flex;
              flex: 0 0 auto;
              align-items: center;
              min-height: 19px;
              padding: 2px 7px;
              border: 1px solid rgba(211,18,106,0.32);
              border-radius: 6px;
              background: transparent;
              color: #D3126A;
              font-size: 9.5px;
              font-weight: 700;
              line-height: 1;
              letter-spacing: 0.025em;
              text-transform: uppercase;
            }
            .de-desk-tool-arrow {
              width: 15px;
              height: 15px;
              flex: 0 0 auto;
              color: var(--desk-ink-dim);
              stroke-width: 1.8;
              transition:
                color 150ms ease,
                transform 150ms ease;
            }
            .de-desk-tool-link:hover .de-desk-tool-arrow {
              color: var(--tool-color);
              transform: translateX(1px);
            }
            .de-desk-tool-guide {
              display: inline-flex;
              align-items: center;
              gap: 2px;
              margin: -5px 14px 10px 66px;
              padding: 3px 2px;
              color: var(--desk-pink);
              font-size: 11.75px;
              font-weight: 650;
              line-height: 1.3;
              text-decoration: none;
            }
            .de-desk-tool-guide svg { width: 11px; height: 11px; }
            .de-desk-tool-guide:hover {
              text-decoration: underline;
              text-underline-offset: 3px;
            }
            .de-desk-security-escape {
              display: flex;
              width: 100%;
              align-items: center;
              gap: 10px;
              margin-top: 14px;
              padding: 11px 12px;
              border: 1px solid var(--de-hairline, rgba(255,255,255,0.10));
              border-radius: 13px;
              background: var(--de-raised, #151217);
              box-shadow: inset 3px 0 0 #D3126A;
              --desk-ink: #fff;
              --desk-ink-muted: rgba(255,255,255,0.62);
              --desk-ink-dim: rgba(255,255,255,0.46);
            }
            .de-desk-security-icon {
              display: inline-flex;
              flex: 0 0 auto;
              width: 31px;
              height: 31px;
              align-items: center;
              justify-content: center;
              border-radius: 9px;
              border: 1px solid rgba(211,18,106,0.32);
              background: rgba(211,18,106,0.12);
              color: var(--desk-pink);
            }
            .de-desk-security-icon svg { width: 15px; height: 15px; stroke-width: 2; }
            .de-desk-security-copy {
              display: flex;
              flex: 1 1 auto;
              min-width: 0;
              flex-direction: column;
            }
            .de-desk-security-copy strong {
              color: var(--desk-ink);
              font-size: 12.75px;
              font-weight: 700;
              line-height: 1.3;
            }
            .de-desk-security-copy span {
              margin-top: 2px;
              color: var(--desk-ink-muted);
              font-size: 11.75px;
              line-height: 1.35;
            }
            .de-desk-security-action {
              flex: 0 0 auto;
              min-height: 44px;
              padding: 10px 12px;
              border: 0;
              border-radius: 9px;
              background: var(--desk-pink);
              color: #fff;
              font-size: 11.5px;
              font-weight: 700;
              line-height: 1;
              box-shadow: 0 5px 14px -8px rgba(211,18,106,0.72);
              transition:
                background-color 150ms ease,
                transform 150ms ease,
                box-shadow 150ms ease;
            }
            .de-desk-security-action:hover {
              background: #bd105f;
              transform: translateY(-1px);
              box-shadow: 0 8px 18px -9px rgba(211,18,106,0.76);
            }
            @media (max-width: 639px) {
              .de-desk-tools-intro { margin-bottom: 12px; }
              .de-desk-tools-list { border-radius: 14px; }
              .de-desk-tool-link {
                gap: 11px;
                padding: 13px 12px 13px 13px;
              }
              .de-desk-tool-icon { width: 37px; height: 37px; }
              .de-desk-tool-guide { margin-left: 61px; }
              .de-desk-security-escape {
                align-items: flex-start;
                flex-wrap: wrap;
              }
              .de-desk-security-copy { padding-top: 1px; }
              .de-desk-security-action {
                width: 100%;
                margin-left: 41px;
              }
            }
            @media (prefers-reduced-motion: reduce) {
              .de-desk-tool-link,
              .de-desk-tool-arrow,
              .de-desk-security-action,
              .de-desk-discover-row,
              .de-desk-issue-row,
              .de-desk-chip,
              .de-desk-incident,
              .de-desk-send { transition: none; }
              .de-desk-tool-link:hover .de-desk-tool-arrow,
              .de-desk-security-action:hover { transform: none; }
              .de-desk-issue-row:hover,
              .de-desk-incident:hover { transform: none; }
              .de-desk-issue-row:hover::before,
              .de-desk-issue-row:hover::after,
              .de-desk-incident:hover::before { opacity: 0; }
              .de-desk-issue-row:hover .de-desk-issue-arrow { transform: none; }
            }
            .de-desk-foot { display: none; }
            .de-desk-resize-edge {
              position: absolute;
              border: 0;
              padding: 0;
              background: transparent;
              touch-action: none;
              z-index: 4;
            }
            .de-desk-resize-n { top: 0; left: 14px; right: 14px; height: 10px; cursor: ns-resize; }
            .de-desk-resize-s { bottom: 0; left: 14px; right: 14px; height: 10px; cursor: ns-resize; }
            .de-desk-resize-e { right: 0; top: 14px; bottom: 14px; width: 10px; cursor: ew-resize; }
            .de-desk-resize-w { left: 0; top: 14px; bottom: 14px; width: 10px; cursor: ew-resize; }
            .de-desk-resize-nw { top: 0; left: 0; width: 16px; height: 16px; cursor: nwse-resize; }
            .de-desk-resize-ne { top: 0; right: 0; width: 16px; height: 16px; cursor: nesw-resize; }
            .de-desk-resize-sw { bottom: 0; left: 0; width: 16px; height: 16px; cursor: nesw-resize; }
            .de-desk-resize {
              position: absolute;
              right: 0;
              bottom: 0;
              width: 44px;
              height: 44px;
              border: 0;
              background: transparent;
              cursor: nwse-resize;
              touch-action: none;
              z-index: 5;
            }
            .de-desk-resize span {
              position: absolute;
              right: 8px;
              bottom: 8px;
              width: 14px;
              height: 14px;
              background:
                linear-gradient(135deg, transparent 46%, rgba(247,245,242,0.42) 46%, rgba(247,245,242,0.42) 54%, transparent 54%),
                linear-gradient(135deg, transparent 66%, rgba(247,245,242,0.42) 66%, rgba(247,245,242,0.42) 74%, transparent 74%),
                linear-gradient(135deg, transparent 86%, rgba(247,245,242,0.42) 86%, rgba(247,245,242,0.42) 94%, transparent 94%);
            }
            .de-desk-resize:hover span,
            .de-desk-resize.is-active span,
            .de-desk-resize:focus-visible span {
              background:
                linear-gradient(135deg, transparent 46%, #d3126a 46%, #d3126a 54%, transparent 54%),
                linear-gradient(135deg, transparent 66%, #d3126a 66%, #d3126a 74%, transparent 74%),
                linear-gradient(135deg, transparent 86%, #d3126a 86%, #d3126a 94%, transparent 94%);
            }
            .de-desk-resize:focus-visible {
              outline: 2px solid #d3126a;
              outline-offset: -4px;
              border-radius: 10px;
            }
            @media (max-width: 420px) {
              .de-desk-grid2 { grid-template-columns: 1fr; }
              .de-desk-hero-art { display: none; }
              .de-desk-tab { font-size: 13.5px; gap: 4px; padding: 8px 2px 10px; }
              .de-desk-tab svg { width: 13px; height: 13px; }
              .de-desk-hero h3 { font-size: 17px; }
            }
          `,
        }}
      />
      {customCSS && <style dangerouslySetInnerHTML={{ __html: customCSS }} />}
    </>
  );
};
