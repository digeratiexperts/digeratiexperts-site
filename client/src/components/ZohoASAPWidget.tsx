import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  FolderLock,
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
  Paperclip,
  Send,
  ShieldAlert,
  Ticket,
  User,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  PORTAL_CONTRACTS,
  PORTAL_FILES,
  PORTAL_HOME,
  PORTAL_LOGIN,
  PORTAL_TICKETS,
  REMOTE_SUPPORT_HREF,
} from "@/lib/portalUrls";
import { readPortalUser } from "@/lib/portalRoles";
import type { OpenMspAdvisorDetail } from "@/lib/openMspAdvisor";
import { STORE_ADVISOR_SEED } from "@/lib/openMspAdvisor";
import { analytics } from "@/lib/analytics";
import { useDraggableWindow } from "@/hooks/useDraggableWindow";
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

const CHAT_WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "DE Desk is here. Describe the outage, the risk, or the question — we'll take it and give you a clear next step.",
};

const QUICK_CHAT_PROMPTS: Array<{
  label: string;
  ticketChip?: DeskTicketChipId;
}> = [
  { label: "I need IT help" },
  { label: "I'm concerned about cybersecurity" },
  { label: "I need help with compliance" },
  { label: "I'm evaluating managed IT" },
  { label: "Possible security incident", ticketChip: "security-incident" },
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
    const response = await fetch("/api/portal/me", { credentials: "include" });
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

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([CHAT_WELCOME]);
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
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [isTicketSending, setIsTicketSending] = useState(false);
  const [ticketResult, setTicketResult] = useState<TicketResult | null>(null);
  const [showTicketMore, setShowTicketMore] = useState(false);
  const ticketFileRef = useRef<HTMLInputElement>(null);

  const [canDrag, setCanDrag] = useState(false);
  const ignoreDismissUntilRef = useRef(0);

  const deskDrag = useDraggableWindow({
    enabled: canDrag,
    open: isOpen,
    storageKey: "de-desk-window-pos",
  });

  const { toast } = useToast();
  activeTabRef.current = activeTab;
  agentNameRef.current = agentName;

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
    return () => {
      cancelled = true;
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
      setActiveTab("chat");
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

  const handleTicketFile = (file: File | undefined) => {
    if (!file) {
      setAttachmentName(null);
      return;
    }
    const allowed = ["image/png", "image/jpeg", "application/pdf"];
    const okType = allowed.includes(file.type) || /\.(png|jpe?g|pdf)$/i.test(file.name);
    if (!okType) {
      toast({
        title: "File type not supported",
        description: "Please choose a PNG, JPG, or PDF.",
        variant: "destructive",
      });
      if (ticketFileRef.current) ticketFileRef.current.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File is too large",
        description: "Please keep attachments under 10MB.",
        variant: "destructive",
      });
      if (ticketFileRef.current) ticketFileRef.current.value = "";
      return;
    }
    setAttachmentName(file.name);
  };

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
    if (!email || !subject || !message) {
      toast({
        title: "Missing information",
        description: "Please enter your email, subject, and message.",
        variant: "destructive",
      });
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email.trim())) {
      toast({
        title: "Check your email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setIsTicketSending(true);
    setTicketResult(null);

    const description = [
      message.trim(),
      "",
      fullName.trim() ? `Name: ${fullName.trim()}` : null,
      company.trim() ? `Company: ${company.trim()}` : null,
      category ? `Category: ${category}` : null,
      attachmentName
        ? `Visitor noted a file: ${attachmentName} (not uploaded in this form — follow up to collect PNG/JPG/PDF).`
        : null,
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
      setAttachmentName(null);
      if (ticketFileRef.current) ticketFileRef.current.value = "";

      toast({
        title: "Ticket created",
        description: data.ticketNumber
          ? `Reference ${data.ticketNumber}`
          : "We’ll be in touch shortly.",
      });
    } catch (error) {
      toast({
        title: "Couldn’t create the ticket",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTicketSending(false);
    }
  };

  if (!isEnabled) return null;

  const dockClear =
    "calc(var(--de-chrome-inset) + env(safe-area-inset-bottom, 0px) + var(--de-cookie-h, 0px) + var(--de-unified-bar-h, 0px))";

  const canvasRight = "calc(var(--de-canvas-gutter) + var(--de-chrome-inset))";

  const deskWindowStyle = canDrag
    ? {
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
            className="de-desk-shell fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[10040] flex max-h-[100dvh] w-auto flex-col overflow-hidden sm:inset-auto sm:h-[min(760px,calc(100dvh-5.5rem))] sm:max-h-[min(86vh,calc(100dvh-4.5rem))] sm:w-[410px] sm:max-w-[calc(100vw-2rem)]"
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
                  canDrag
                    ? deskDrag.dragging
                      ? "cursor-grabbing select-none"
                      : "cursor-grab select-none"
                    : ""
                }`}
                onPointerDown={canDrag ? deskDrag.onHandlePointerDown : undefined}
                onDoubleClick={canDrag ? deskDrag.reset : undefined}
                style={canDrag ? { touchAction: "none" } : undefined}
                data-testid="desk-drag-handle"
                aria-label={canDrag ? "Move DE Desk window. Double-click to reset size and position." : undefined}
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
                  aria-label={deskDrag.expanded ? "Reset DE Desk size" : "Expand DE Desk"}
                  title={deskDrag.expanded ? "Reset size" : "Expand"}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={deskDrag.toggleExpanded}
                >
                  {deskDrag.expanded ? (
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

            <nav className="de-desk-tabs" aria-label="Support options">
              {(
                [
                  { id: "chat" as const, label: "Ask DE", icon: MessageCircle },
                  { id: "ticket" as const, label: "Get Support", icon: FileText },
                  { id: "resources" as const, label: "Client Tools", icon: LayoutGrid },
                ]
              ).map(({ id, label, icon: Icon }) => {
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selectTab(id)}
                    className={`de-desk-tab${isActive ? " is-active" : ""}${
                      id === "chat" && unreadChatCount > 0 ? " has-unread" : ""
                    }`}
                    data-testid={`button-tab-${id}`}
                    aria-current={isActive ? "page" : undefined}
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
            </nav>

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
                <div className="de-desk-panel" data-testid="panel-support-chat">
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
                            {isOpening && chatMessages.length === 1 ? (
                              <div className="de-desk-chips" role="group" aria-label="Common questions">
                                {QUICK_CHAT_PROMPTS.map(({ label, ticketChip }) => (
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
                                    className="de-desk-chip"
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
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
                                      {chip.label}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}

                    {isChatSending && (
                      <div className="flex justify-start">
                        <div className="de-desk-bubble is-bot">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#D3126A]" />
                            {agentLive ? "Delivering to specialist…" : "Thinking it through…"}
                          </span>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </div>
              )}

              {activeTab === "ticket" && (
                <div className="de-desk-panel" data-testid="panel-support-ticket">
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
                      <div className="de-desk-form" ref={ticketDetailsRef}>
                        <div className="de-desk-ticket-lead">
                          <h3>Get support</h3>
                          <p>Tell us what happened. We&apos;ll route it to the desk.</p>
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
                        </button>

                        <p className="de-desk-urgency-label" id="support-issue-label">What do you need help with?</p>
                        <div className="de-desk-issue-list" role="group" aria-labelledby="support-issue-label">
                          {DESK_STANDARD_TICKET_CHIPS.map((chip) => (
                            <button
                              key={chip.id}
                              type="button"
                              className={`de-desk-issue-row${selectedTicketChip === chip.id ? " is-on" : ""}`}
                              data-testid={`ticket-issue-${chip.id}`}
                              onClick={() => applyTicketChip(chip.id)}
                            >
                              {chip.label}
                            </button>
                          ))}
                        </div>

                        {selectedTicketChip === "security-incident" ? (
                          <p className="de-desk-route-note" data-testid="ticket-chip-security-incident">
                            Routed as a possible security incident.
                          </p>
                        ) : null}

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
                              onChange={(event) => setEmail(event.target.value)}
                              data-testid="input-support-email"
                              className="de-desk-input"
                            />
                          </div>
                        </div>
                        <div className="de-desk-field">
                          <label htmlFor="support-subject">What&apos;s happening?</label>
                          <Input
                            id="support-subject"
                            maxLength={200}
                            placeholder="Short summary"
                            value={subject}
                            onChange={(event) => setSubject(event.target.value)}
                            data-testid="input-support-subject"
                            className="de-desk-input is-bare"
                          />
                        </div>
                        <div className="de-desk-field">
                          <label htmlFor="support-message">Details</label>
                          <Textarea
                            id="support-message"
                            maxLength={2000}
                            placeholder="What broke, who is affected, and what you already tried."
                            value={message}
                            onChange={(event) => setMessage(event.target.value)}
                            rows={4}
                            className="de-desk-input de-desk-ta is-bare"
                            data-testid="input-support-message"
                          />
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
                          {showTicketMore ? "Hide optional fields" : "Add company, category, or a file"}
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
                            <input
                              ref={ticketFileRef}
                              type="file"
                              accept="image/png,image/jpeg,application/pdf,.png,.jpg,.jpeg,.pdf"
                              className="sr-only"
                              onChange={(event) => handleTicketFile(event.target.files?.[0])}
                              data-testid="input-support-attachment"
                            />
                            <button type="button" onClick={() => ticketFileRef.current?.click()} className="de-desk-attach">
                              <Paperclip aria-hidden="true" />
                              <span>
                                <span className="de-desk-attach-t">{attachmentName || "Attach file or screenshot"}</span>
                                <span className="de-desk-attach-h">PNG, JPG, or PDF up to 10MB.</span>
                              </span>
                            </button>
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
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "resources" && (
                <div
                  className="de-desk-panel de-desk-tools-panel"
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
                            <div className="de-desk-launch-list">
                              {group.items.map((item) => {
                                const Icon = item.icon;
                                if (item.onSelect) {
                                  return (
                                    <button
                                      key={item.title}
                                      type="button"
                                      className="de-desk-launch-row"
                                      data-testid={item.testId}
                                      onClick={item.onSelect}
                                    >
                                      <span className="de-desk-launch-icon">
                                        <Icon aria-hidden="true" />
                                      </span>
                                      <span className="de-desk-launch-title">{item.title}</span>
                                      <ChevronRight className="de-desk-tool-arrow" aria-hidden="true" />
                                    </button>
                                  );
                                }
                                return (
                                  <a
                                    key={item.title}
                                    href={item.href}
                                    className="de-desk-launch-row"
                                    data-testid={item.testId}
                                    {...(item.external || item.href?.startsWith("http")
                                      ? { target: "_blank", rel: "noopener noreferrer" }
                                      : {})}
                                  >
                                    <span className="de-desk-launch-icon">
                                      <Icon aria-hidden="true" />
                                    </span>
                                    <span className="de-desk-launch-title">{item.title}</span>
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
                        <a
                          href={PORTAL_LOGIN}
                          className="de-desk-signin"
                          data-testid="resource-link-sign-in-to-client-tools"
                        >
                          <LogIn aria-hidden="true" />
                          Sign in to Client Tools
                        </a>
                        <div className="de-desk-tools-now">
                          <p className="de-desk-launch-heading">Need help right now?</p>
                          <button
                            type="button"
                            className="de-desk-launch-row"
                            data-testid="resource-link-submit-support-request"
                            onClick={() => selectTab("ticket")}
                          >
                            <span className="de-desk-launch-icon">
                              <LifeBuoy aria-hidden="true" />
                            </span>
                            <span className="de-desk-launch-title">Submit a support request</span>
                            <ChevronRight className="de-desk-tool-arrow" aria-hidden="true" />
                          </button>
                          <a
                            href={REMOTE_SUPPORT_HREF}
                            className="de-desk-launch-row"
                            data-testid="resource-link-start-remote-support"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <span className="de-desk-launch-icon">
                              <Monitor aria-hidden="true" />
                            </span>
                            <span className="de-desk-launch-title">Start remote support</span>
                            <ExternalLink className="de-desk-tool-arrow" aria-hidden="true" />
                          </a>
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
            {canDrag ? (
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
              --desk-shell: #0a0a0a;
              --desk-shell-soft: rgba(0,0,0,0.28);
              --desk-shell-border: rgba(255,255,255,0.10);
              --desk-shell-border-strong: rgba(255,255,255,0.16);
              --desk-shell-text: #ffffff;
              --desk-shell-muted: rgba(255,255,255,0.68);
              --desk-shell-dim: rgba(255,255,255,0.46);
              --desk-paper: #0a0a0a;
              --desk-well: #0a0a0a;
              --desk-surface: #0a0a0a;
              --desk-box: #151217;
              --desk-inset: #151217;
              --desk-border: rgba(255,255,255,0.10);
              --desk-border-strong: rgba(255,255,255,0.16);
              --desk-ink: #ffffff;
              --desk-ink-muted: rgba(255,255,255,0.68);
              --desk-ink-dim: rgba(255,255,255,0.46);
              --desk-pink: #d3126a;
              --desk-violet: #8b5cf6;
              --desk-blue: #3b9eff;
              --desk-teal: #22d3ee;
              --desk-red: #f0455b;
              --desk-green: #22c55e;
              --desk-cta: #d3126a;
              /* Unlayered rule must stay position:fixed. A relative value here
                 beat Tailwind fixed and laid the dialog out after the page. */
              position: fixed;
              z-index: 10040;
              color-scheme: dark;
              background: var(--de-surface, #0a0a0a);
              border: 1px solid var(--de-hairline, rgba(255,255,255,0.10));
              border-radius: 16px;
              box-shadow:
                inset 0 1px 0 #D3126A,
                0 24px 64px rgba(0,0,0,0.58);
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
            .de-desk-shell nav[aria-label="Support options"] ::selection,
            .de-desk-shell nav[aria-label="Support options"] *::selection {
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
              .de-desk-status-dot.is-on::after { animation: none; }
            }
            .de-desk-id h2 {
              font-family: "Space Grotesk", sans-serif;
              font-weight: 600;
              font-size: 16px;
              color: var(--desk-shell-text);
              line-height: 1.2;
            }
            .de-desk-id p { font-size: 13px; color: var(--desk-shell-muted); margin-top: 1px; }
            .de-desk-close {
              width: 40px; height: 40px; border-radius: 9px;
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
              display: flex; justify-content: space-between; gap: 12px;
              padding: 0 16px;
              border-bottom: 1px solid rgba(255,255,255,0.12);
              flex-shrink: 0;
            }
            .de-desk-tab {
              background: none; border: none;
              min-height: 44px;
              padding: 12px 0;
              font-family: "Space Grotesk", sans-serif;
              font-weight: 600; font-size: 15px;
              color: var(--desk-shell-dim);
              display: flex; align-items: center; gap: 6px;
              position: relative;
            }
            .de-desk-tab svg { width: 14px; height: 14px; }
            .de-desk-tab.is-active { color: var(--desk-shell-text); }
            .de-desk-tab.is-active::after {
              content: "";
              position: absolute; left: 0; right: 0; bottom: -1px;
              height: 2px; border-radius: 2px;
              background: var(--desk-pink);
            }
            .de-desk-tab-badge {
              min-width: 16px; height: 16px; padding: 0 4px;
              border-radius: 999px;
              background: var(--desk-pink); color: #fff;
              font-size: 9px; font-weight: 700; line-height: 16px;
              letter-spacing: 0; text-align: center;
            }
            .de-desk-tab.has-unread { color: var(--desk-shell-text); }
            .de-desk-status {
              display: flex; align-items: center; justify-content: space-between;
              padding: 9px 17px;
              background: var(--desk-shell);
              border-bottom: 1px solid var(--desk-shell-border);
              font-size: 13px;
              flex-shrink: 0;
            }
            .de-desk-status-l {
              display: flex; align-items: center; gap: 6px;
              color: var(--desk-shell-muted); font-weight: 500;
            }
            .de-desk-status-dot {
              width: 6px; height: 6px; border-radius: 50%;
              background: #c4c0cc; position: relative;
            }
            .de-desk-status-dot.is-on { background: var(--desk-green); }
            .de-desk-status-dot.is-live { background: #3b9eff; }
            .de-desk-status-dot.is-wait { background: #e8a23d; }
            .de-desk-status-r {
              display: flex; align-items: center; gap: 7px;
              color: var(--desk-pink); font-weight: 600;
            }
            .de-desk-status-ic {
              width: 22px; height: 22px; border-radius: 7px;
              border: 1.5px solid var(--desk-pink);
              display: flex; align-items: center; justify-content: center;
              background: rgba(211,18,106,0.10);
            }
            .de-desk-status-ic svg { width: 11px; height: 11px; }
            .de-desk-body {
              position: relative;
              z-index: 1;
              min-height: 0; flex: 1;
              margin: 0;
              padding: 16px 16px 8px;
              display: flex; flex-direction: column;
              background: transparent;
              color: var(--desk-ink);
            }
            .de-desk-shell[data-tab="ticket"] .de-desk-body,
            .de-desk-shell[data-tab="resources"] .de-desk-body {
              background: transparent;
              color: #fff;
            }
            .de-desk-panel, .de-desk-scroll {
              min-height: 0; flex: 1;
              display: flex; flex-direction: column;
            }
            .de-desk-scroll { overflow-y: auto; gap: 0; }
            .de-desk-hero {
              position: relative; overflow: hidden;
              border-radius: 12px;
              border: 1px solid var(--desk-border);
              background: var(--desk-box);
              padding: 16px 16px;
              display: flex; align-items: center; gap: 12px;
              flex-shrink: 0;
            }
            .de-desk-hero::before {
              content: "";
              position: absolute; inset: 0;
              background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1.15px);
              background-size: 7px 7px;
              opacity: 0.35;
              pointer-events: none;
            }
            .de-desk-hero-dots {
              position: absolute; top: 0; right: 0; bottom: 0; width: 42%;
              background: transparent;
              pointer-events: none;
            }
            .de-desk-hero-txt { flex: 1; min-width: 0; position: relative; z-index: 1; }
            .de-desk-hero-ring {
              width: 38px; height: 38px; border-radius: 50%;
              border: 1.5px solid var(--desk-pink);
              display: flex; align-items: center; justify-content: center;
              color: var(--desk-pink);
              margin-bottom: 10px;
              background: rgba(211,18,106,0.10);
            }
            .de-desk-hero-ring svg { width: 17px; height: 17px; }
            .de-desk-hero h3 {
              font-family: "Space Grotesk", sans-serif;
              font-size: 18px; font-weight: 700; color: #fff;
              letter-spacing: -0.01em;
            }
            .de-desk-hero p {
              font-size: 14px; color: var(--desk-ink-muted); margin-top: 5px;
              line-height: 1.5; max-width: 210px;
            }
            .de-desk-hero-art { width: 86px; height: 86px; flex: none; position: relative; z-index: 1; }
            .de-desk-rows { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
            .de-desk-rows.is-grid {
              display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
            }
            .de-desk-rows > .de-desk-rows.is-grid { margin-top: 0; }
            .de-desk-row {
              display: flex; align-items: center; gap: 10px;
              min-height: 44px;
              padding: 11px 12px; border-radius: 10px;
              background: var(--desk-box);
              border: 1px solid var(--desk-border);
              color: #fff; text-align: left; width: 100%;
              transition: background 0.16s ease, border-color 0.16s ease;
            }
            .de-desk-row:hover {
              background: #1b181e;
              border-color: var(--desk-border-strong);
            }
            .de-desk-row.is-selected {
              border-color: #D3126A;
              background: var(--desk-box);
              box-shadow: inset 0 0 0 1px rgba(211,18,106,0.28);
            }
            .de-desk-row.is-selected .de-desk-row-chev { color: #D3126A; }
            .de-desk-row.is-incident {
              background: var(--desk-box);
              border-color: rgba(211,18,106,0.42);
              box-shadow: inset 3px 0 0 #D3126A;
              align-items: flex-start;
            }
            .de-desk-row.is-incident .de-desk-row-ic {
              border-color: #D3126A;
              color: #D3126A;
              background: rgba(211,18,106,0.12);
            }
            .de-desk-row.is-incident .de-desk-row-t {
              display: flex;
              flex-wrap: wrap;
              align-items: center;
              gap: 6px 0;
            }
            .de-desk-row.is-incident:hover {
              background: #1b181e;
              border-color: #D3126A;
            }
            .de-desk-badge-urgent {
              display: inline-block;
              font-size: 9.5px; font-weight: 700; letter-spacing: 0.04em;
              text-transform: uppercase;
              color: #fff; background: #D3126A;
              border-radius: 5px; padding: 2px 6px;
              vertical-align: middle; margin-left: 8px;
            }
            .de-desk-tool-block { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
            .de-desk-sublink {
              align-self: flex-start;
              margin: 0 0 2px 42px;
              padding: 2px 0 4px;
              font-size: 12.5px; font-weight: 600;
              color: #D3126A; text-decoration: none;
            }
            .de-desk-sublink:hover,
            .de-desk-sublink:focus-visible { text-decoration: underline; }
            .de-desk-rows.is-grid .de-desk-row { padding: 9px 10px; align-items: flex-start; }
            .de-desk-rows.is-grid .de-desk-row-t { font-size: 13.5px; line-height: 1.3; }
            .de-desk-rows.is-grid .de-desk-tool-block .de-desk-row-actions { display: none; }
            .de-desk-row[data-tone="violet"] { --c: var(--desk-violet); }
            .de-desk-row[data-tone="blue"] { --c: var(--desk-blue); }
            .de-desk-row[data-tone="teal"] { --c: var(--desk-teal); }
            .de-desk-row[data-tone="red"] { --c: var(--desk-red); }
            .de-desk-row[data-tone="pink"] { --c: var(--desk-pink); }
            .de-desk-row-ic {
              width: 32px; height: 32px; border-radius: 8px;
              background: #0a0a0a;
              border: 1px solid var(--desk-border);
              color: rgba(255,255,255,0.82);
              display: flex; align-items: center; justify-content: center;
              flex: none; position: relative; overflow: hidden;
            }
            .de-desk-row-ic::after { content: none; }
            .de-desk-row-ic svg { width: 15px; height: 15px; position: relative; z-index: 1; }
            .de-desk-row.is-lg .de-desk-row-ic { width: 46px; height: 46px; border-radius: 13px; }
            .de-desk-row.is-lg .de-desk-row-ic svg { width: 20px; height: 20px; }
            .de-desk-row-body { flex: 1; min-width: 0; }
            .de-desk-row-t { font-size: 14.5px; font-weight: 600; color: #fff; }
            .de-desk-row.is-lg .de-desk-row-t { font-size: 13.5px; }
            .de-desk-row-d { display: block; font-size: 13px; color: var(--desk-ink-muted); margin-top: 2px; line-height: 1.4; }
            .de-desk-badge-rec {
              display: inline-block;
              font-size: 9.5px; font-weight: 700; letter-spacing: 0.03em;
              color: var(--desk-pink);
              background: rgba(211,18,106,0.16);
              border: 1px solid rgba(211,18,106,0.4);
              border-radius: 5px; padding: 2px 6px;
              vertical-align: middle; margin-left: 6px;
              text-transform: uppercase;
            }
            .de-desk-row-chev { width: 14px; height: 14px; color: var(--desk-ink-dim); flex: none; }
            .de-desk-row-actions { display: flex; align-items: center; gap: 6px; flex: none; }
            .de-desk-row-ext {
              width: 27px; height: 27px; border-radius: 8px;
              border: 1px solid var(--desk-border-strong);
              display: flex; align-items: center; justify-content: center;
              color: var(--desk-ink-muted);
            }
            .de-desk-row-ext svg { width: 12px; height: 12px; }
            .de-desk-row:hover .de-desk-row-ext { border-color: var(--c, var(--desk-pink)); color: var(--c, var(--desk-pink)); }
            .de-desk-row.is-highlight {
              background: var(--desk-box);
              border-color: rgba(211,18,106,0.45);
              box-shadow: inset 0 0 0 1px rgba(211,18,106,0.12);
            }
            .de-desk-row.is-alert {
              background: var(--desk-box);
              border-color: rgba(240,69,91,0.45);
              align-items: flex-start;
            }
            .de-desk-row.is-alert .de-desk-row-body { padding-top: 2px; }
            .de-desk-btn-mini {
              background: var(--desk-cta); color: #fff; border: none;
              font-weight: 600; font-size: 12px; padding: 9px 14px;
              border-radius: 9px; flex: none; white-space: nowrap;
              align-self: center;
            }
            .de-desk-section-head {
              display: flex; align-items: center; justify-content: space-between;
              margin: 20px 0 2px;
            }
            .de-desk-section-head h4 {
              font-family: "Space Grotesk", sans-serif;
              font-size: 14.5px; font-weight: 600; color: var(--desk-shell-text);
            }
            .de-desk-section-head a { font-size: 12px; color: var(--desk-pink); font-weight: 600; }
            .de-desk-details-head {
              display: flex; align-items: center; justify-content: space-between;
              margin: 12px 0 8px;
            }
            .de-desk-details-head h4 {
              font-family: "Space Grotesk", sans-serif;
              font-size: 13px; font-weight: 700;
              letter-spacing: 0.06em; text-transform: uppercase;
              color: var(--desk-shell-muted);
            }
            .de-desk-secure {
              display: flex; align-items: center; gap: 5px;
              border: 1px solid rgba(34,197,94,0.45); color: #86efac;
              border-radius: 999px; padding: 3px 9px;
              font-size: 12px; font-weight: 600;
              background: rgba(34,197,94,0.10);
            }
            .de-desk-secure svg { width: 10px; height: 10px; }
            .de-desk-form { display: flex; flex-direction: column; gap: 12px; }
            .de-desk-ticket-lead h3 {
              font-family: "Space Grotesk", sans-serif;
              font-size: 20px; font-weight: 700; color: #fff;
            }
            .de-desk-ticket-lead p {
              margin-top: 6px; font-size: 14px; line-height: 1.45; color: rgba(247,245,242,0.68);
            }
            .de-desk-route-note {
              font-size: 13px; font-weight: 600; color: #F0B4CC;
            }
            .de-desk-msg { display: flex; gap: 10px; align-items: flex-start; }
            .de-desk-msg.is-user { justify-content: flex-end; }
            .de-desk-msg-id {
              position: relative;
              width: 32px; height: 32px; border-radius: 50%;
              background: #151217; color: #fff;
              display: flex; align-items: center; justify-content: center;
              font-size: 9px; font-weight: 700; flex: none;
            }
            .de-desk-msg-id .de-desk-avatar-dot { border-color: #0a0a0a; }
            .de-desk-msg-col { min-width: 0; flex: 1; }
            .de-desk-msg.is-user .de-desk-msg-col { flex: 0 1 auto; }
            .de-desk-msg-who {
              display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px;
            }
            .de-desk-msg-who strong { font-size: 13px; font-weight: 700; color: #fff; }
            .de-desk-msg-who em { font-style: normal; font-size: 12px; font-weight: 600; color: #4ade80; }
            .de-desk-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
            .de-desk-chip {
              border: 1px solid var(--desk-border);
              background: var(--desk-box); color: rgba(255,255,255,0.78);
              border-radius: 8px;
              min-height: 40px;
              padding: 8px 12px;
              font-size: 12.5px; font-weight: 500;
            }
            .de-desk-chip:hover { border-color: #D3126A; color: #fff; }
            .de-desk-incident {
              display: flex; align-items: flex-start; gap: 12px;
              width: 100%; text-align: left;
              min-height: 52px;
              margin: 2px 0 14px;
              padding: 12px 13px;
              border: 1px solid rgba(211,18,106,0.42);
              border-radius: 12px;
              background: rgba(211,18,106,0.10);
              color: #fff;
              box-shadow: inset 3px 0 0 #D3126A;
            }
            .de-desk-incident:hover { background: rgba(211,18,106,0.16); }
            .de-desk-incident.is-on {
              border-color: #D3126A;
              background: rgba(211,18,106,0.18);
            }
            .de-desk-incident-icon {
              display: inline-flex; flex: none;
              width: 32px; height: 32px; margin-top: 1px;
              align-items: center; justify-content: center;
              border-radius: 9px;
              border: 1px solid rgba(211,18,106,0.38);
              background: rgba(211,18,106,0.16);
              color: #D3126A;
            }
            .de-desk-incident-icon svg { width: 16px; height: 16px; }
            .de-desk-incident-copy { display: flex; flex-direction: column; min-width: 0; }
            .de-desk-incident-copy strong {
              font-size: 13.5px; font-weight: 700; line-height: 1.3;
            }
            .de-desk-incident-copy span {
              margin-top: 3px;
              color: rgba(255,255,255,0.64);
              font-size: 12px; line-height: 1.4;
            }
            .de-desk-issue-list {
              display: flex; flex-direction: column;
              gap: 4px;
              margin-bottom: 14px;
            }
            .de-desk-issue-row {
              width: 100%; text-align: left;
              min-height: 40px;
              padding: 9px 12px;
              border: 1px solid var(--desk-border);
              border-radius: 9px;
              background: var(--desk-box);
              color: rgba(255,255,255,0.86);
              font-size: 13px; font-weight: 600;
            }
            .de-desk-issue-row:hover { border-color: rgba(255,255,255,0.22); color: #fff; }
            .de-desk-issue-row.is-on {
              border-color: #D3126A;
              color: #fff;
              box-shadow: inset 0 0 0 1px rgba(211,18,106,0.28);
            }
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
              display: block; font-size: 13px; font-weight: 600; color: #fff; margin-bottom: 6px;
            }
            .de-desk-urgency {
              display: grid; grid-template-columns: repeat(4, 1fr);
              gap: 4px;
            }
            .de-desk-urgency button {
              min-height: 40px; border: 1px solid var(--de-hairline, rgba(255,255,255,0.10));
              border-radius: 8px;
              background: var(--de-raised, #151217); color: rgba(255,255,255,0.72);
              font-size: 13px; font-weight: 600;
            }
            .de-desk-urgency button.is-on {
              background: #D3126A; color: #fff; border-color: #D3126A;
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
              display: block; font-size: 13px; font-weight: 600;
              color: #fff; margin-bottom: 6px;
            }
            .de-desk-input-wrap { position: relative; }
            .de-desk-input-wrap > svg {
              position: absolute; left: 11px; top: 50%; transform: translateY(-50%);
              width: 13px; height: 13px; color: rgba(255,255,255,0.46); pointer-events: none;
            }
            .de-desk-shell .de-desk-input {
              width: 100%;
              min-height: 44px;
              height: 44px;
              background: var(--de-raised, #151217) !important;
              border: 1px solid var(--de-hairline, rgba(255,255,255,0.10)) !important;
              color: #fff !important;
              border-radius: 10px;
              padding: 10px 14px 10px 32px;
              font-size: 14px;
              box-shadow: none !important;
            }
            .de-desk-shell .de-desk-input.is-bare { padding-left: 14px; }
            .de-desk-shell .de-desk-input::placeholder { color: rgba(255,255,255,0.40); }
            .de-desk-shell .de-desk-select { appearance: none; padding-right: 28px; }
            .de-desk-shell .de-desk-select option { background: #151217; color: #fff; }
            .de-desk-select-chev {
              position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
              width: 12px; height: 12px; color: var(--desk-ink-dim); pointer-events: none;
            }
            .de-desk-ta-wrap { position: relative; }
            .de-desk-shell .de-desk-ta {
              min-height: 80px; height: auto; padding-left: 11px; resize: vertical;
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
              border: 1px dashed var(--desk-border-strong);
              border-radius: 10px; background: var(--desk-box);
            }
            .de-desk-attach:hover { border-color: var(--desk-pink); }
            .de-desk-attach svg { width: 14px; height: 14px; color: var(--desk-ink-dim); flex: none; margin-top: 2px; }
            .de-desk-attach-t { display: block; font-size: 14px; font-weight: 600; color: #fff; }
            .de-desk-attach-h { display: block; font-size: 12.5px; color: var(--desk-ink-muted); margin-top: 1px; }
            .de-desk-caption {
              display: flex; align-items: center; gap: 6px;
              font-size: 13px; color: var(--desk-shell-muted);
            }
            .de-desk-caption svg { width: 11px; height: 11px; }
            .de-desk-btn-grad {
              width: 100%; margin-top: 4px;
              min-height: 44px;
              background: var(--desk-cta); border: none; color: #fff;
              font-weight: 600; font-size: 14px; padding: 12px;
              border-radius: 11px;
              display: flex; align-items: center; justify-content: center; gap: 8px;
            }
            .de-desk-btn-grad:hover { filter: brightness(1.08); }
            .de-desk-btn-grad:disabled { opacity: 0.6; }
            .de-desk-btn-grad svg { width: 14px; height: 14px; }
            .de-desk-bubble {
              max-width: 90%;
              padding: 11px 14px;
              font-size: 13.5px; line-height: 1.5;
              border-radius: 14px;
            }
            .de-desk-bubble.is-user {
              background: var(--desk-pink); color: #fff;
              border-bottom-right-radius: 6px;
            }
            .de-desk-bubble.is-bot, .de-desk-bubble.is-agent {
              background: #151217; color: #f7f5f2;
              border: 0;
              border-bottom-left-radius: 6px;
            }
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
              .de-desk-heads-up { animation: none; }
            }
            .de-desk-composer {
              position: relative;
              z-index: 1;
              display: flex; gap: 8px;
              margin: 0;
              padding: 12px 16px 10px;
              border-top: 1px solid var(--de-hairline, rgba(255,255,255,0.10));
              background: transparent;
              color: #fff;
              flex-shrink: 0;
            }
            .de-desk-composer.is-live input {
              border-color: rgba(211,18,106,0.55);
              box-shadow: 0 0 0 3px rgba(211,18,106,0.14);
            }
            .de-desk-composer input {
              flex: 1;
              min-height: 48px;
              background: var(--de-raised, #151217);
              border: 1px solid var(--de-hairline, rgba(255,255,255,0.10));
              border-radius: 10px;
              padding: 12px 14px;
              color: #fff; font-size: 15px;
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
              border-color: var(--desk-pink);
              box-shadow: 0 0 0 3px rgba(211,18,106,0.12);
            }
            .de-desk-send {
              width: 44px; height: 44px; border-radius: 11px;
              background: var(--desk-cta); border: none;
              display: flex; align-items: center; justify-content: center;
              flex: none;
            }
            .de-desk-send:disabled { opacity: 0.5; }
            .de-desk-send svg { width: 16px; height: 16px; color: #fff; }
            .de-desk-composer-caption {
              position: relative;
              z-index: 1;
              display: flex; align-items: center; gap: 6px;
              margin: 0;
              padding: 0 16px 14px;
              background: transparent;
              font-size: 12px; color: rgba(255,255,255,0.46);
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
              background: #151217;
              color: #f7f5f2;
            }
            .de-desk-shell[data-tab="resources"] .de-desk-row-t,
            .de-desk-shell[data-tab="ticket"] .de-desk-row-t { color: #f7f5f2; }
            .de-desk-shell[data-tab="resources"] .de-desk-row-d { color: rgba(247,245,242,0.62); }
            .de-desk-shell[data-tab="ticket"] .de-desk-heads-up-top strong,
            .de-desk-shell[data-tab="resources"] .de-desk-heads-up-top strong { color: #f7f5f2; }
            .de-desk-tools-panel .de-desk-scroll {
              gap: 0;
              padding: 0;
            }
            .de-desk-tools-intro {
              margin: 1px 0 14px;
            }
            .de-desk-tools-intro h3 {
              margin: 0;
              font-family: "Space Grotesk", sans-serif;
              font-size: 17px;
              font-weight: 700;
              line-height: 1.25;
              letter-spacing: -0.015em;
              color: #fff;
            }
            .de-desk-tools-intro p {
              margin: 4px 0 0;
              color: rgba(255,255,255,0.68);
              font-size: 13.5px;
              line-height: 1.45;
            }
            .de-desk-tools-kicker {
              margin: 10px 0 6px !important;
              color: #fff !important;
              font-family: "Space Grotesk", sans-serif;
              font-size: 15px !important;
              font-weight: 650;
              line-height: 1.35 !important;
            }
            .de-desk-tools-gate { display: flex; flex-direction: column; gap: 0; }
            .de-desk-signin {
              display: inline-flex;
              align-items: center; justify-content: center; gap: 8px;
              min-height: 44px;
              margin: 16px 0 18px;
              padding: 11px 16px;
              border: 0; border-radius: 10px;
              background: #D3126A; color: #fff;
              font-size: 14.5px; font-weight: 700;
              text-decoration: none;
              box-shadow: 0 8px 18px -10px rgba(211,18,106,0.8);
            }
            .de-desk-signin:hover { background: #bd105f; }
            .de-desk-signin svg { width: 16px; height: 16px; }
            .de-desk-signin:focus-visible,
            .de-desk-launch-row:focus-visible {
              outline: 2px solid #D3126A;
              outline-offset: 2px;
            }
            .de-desk-tools-now {
              padding-top: 16px;
              border-top: 1px solid var(--de-hairline, rgba(255,255,255,0.10));
            }
            .de-desk-launch-group { margin-bottom: 14px; }
            .de-desk-launch-heading {
              margin: 0 0 8px;
              color: rgba(255,255,255,0.52);
              font-size: 11px;
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
              font-size: 13.5px; font-weight: 650;
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
              font-size: 14.5px;
              font-weight: 650;
              line-height: 1.3;
            }
            .de-desk-tool-description {
              display: block;
              margin-top: 2px;
              color: var(--desk-ink-muted);
              font-size: 12.75px;
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
              .de-desk-security-action { transition: none; }
              .de-desk-tool-link:hover .de-desk-tool-arrow,
              .de-desk-security-action:hover { transform: none; }
            }
            .de-desk-foot {
              display: flex; align-items: center; justify-content: space-between;
              padding: 11px 17px;
              border-top: 1px solid var(--desk-shell-border);
              background: var(--desk-shell);
              color: var(--desk-ink-muted);
              flex-shrink: 0;
            }
            .de-desk-foot-nav {
              font-size: 13px; color: var(--desk-ink-muted);
              display: flex; align-items: center; gap: 5px; min-width: 0;
            }
            .de-desk-foot-nav button,
            .de-desk-foot-assist {
              background: none; border: none; padding: 8px 2px;
              min-height: 44px;
              font: inherit; color: inherit; cursor: pointer;
            }
            .de-desk-foot-nav button:hover,
            .de-desk-foot-assist:hover { color: var(--desk-ink); }
            .de-desk-foot-nav .is-active { color: var(--desk-pink); font-weight: 600; }
            .de-desk-foot-assist { text-decoration: underline; text-underline-offset: 2px; }
            .de-desk-foot-cta {
              font-size: 13px; color: var(--desk-pink); font-weight: 600;
              display: flex; align-items: center; gap: 4px; flex: none;
            }
            .de-desk-foot-cta svg { width: 11px; height: 11px; }
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
            @media (min-width: 640px) {
              .de-desk-foot { padding-right: 36px; }
            }
            @media (max-width: 480px) {
              .de-desk-foot-cta { display: none; }
            }
            @media (max-width: 420px) {
              .de-desk-grid2 { grid-template-columns: 1fr; }
              .de-desk-hero-art { display: none; }
              .de-desk-tab { font-size: 14px; }
              .de-desk-hero h3 { font-size: 17px; }
            }
          `,
        }}
      />
      {customCSS && <style dangerouslySetInnerHTML={{ __html: customCSS }} />}
    </>
  );
};
