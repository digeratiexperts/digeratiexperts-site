import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PortalLayout } from "./PortalLayout";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Send,
  AlertCircle,
  MessageSquare,
  Ticket,
  X,
  Users,
  Radio,
  Globe2,
  Building2,
  Clock3,
  Headphones,
  RefreshCw,
  Copy,
  UserCheck,
  Bot,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { portalGet, portalPost } from "@/lib/portalApi";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  id: string;
  senderName: string;
  senderRole: "client" | "support";
  content: string;
  timestamp: string;
  isRead: boolean;
}

interface DeskSession {
  sessionId: string;
  email: string | null;
  contactName: string | null;
  companyName: string | null;
  pagePath: string | null;
  messageCount: number;
  preview: string | null;
  agentActive?: boolean;
  agentName?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DeskMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "agent";
  content: string;
  senderName?: string | null;
  createdAt: string;
}

type OpsChannel = "website" | "portal";

type DeskSessionAction =
  | "open"
  | "claim"
  | "release"
  | "copy-id"
  | "copy-email"
  | "copy-path"
  | "create-ticket"
  | "close-tab";

type FloatingSessionMenu = {
  session: DeskSession;
  x: number;
  y: number;
};

const LONG_PRESS_MS = 480;
const DESK_TICKET_DRAFT_KEY = "de-portal-desk-ticket-draft";

function sessionNameLabel(s: DeskSession): string {
  const name = s.contactName?.trim();
  return name || "Name not given yet";
}

function sessionCompanyLabel(s: DeskSession): string | null {
  const company = s.companyName?.trim();
  return company || null;
}

function viewerLabel(s: DeskSession): string {
  return sessionNameLabel(s);
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function clampMenuPosition(x: number, y: number, width = 240, height = 320) {
  const pad = 8;
  const maxX = Math.max(pad, window.innerWidth - width - pad);
  const maxY = Math.max(pad, window.innerHeight - height - pad);
  return {
    left: Math.min(Math.max(pad, x), maxX),
    top: Math.min(Math.max(pad, y), maxY),
  };
}

export default function PortalChat() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(true);
  const [chatAllowed, setChatAllowed] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [token, setToken] = useState<string>("");
  const [deskSessions, setDeskSessions] = useState<DeskSession[]>([]);
  const [openDeskIds, setOpenDeskIds] = useState<string[]>([]);
  const [selectedDesk, setSelectedDesk] = useState<string | null>(null);
  const [deskThreads, setDeskThreads] = useState<Record<string, DeskMessage[]>>({});
  const [deskLoading, setDeskLoading] = useState(false);
  const [deskReply, setDeskReply] = useState("");
  const [deskSending, setDeskSending] = useState(false);
  const [channel, setChannel] = useState<OpsChannel>("website");
  const [floatingMenu, setFloatingMenu] = useState<FloatingSessionMenu | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const deskEndRef = useRef<HTMLDivElement>(null);
  const deskComposerRef = useRef<HTMLTextAreaElement>(null);
  const liveMessagesRef = useRef<ChatMessage[]>([]);
  const selectedDeskRef = useRef<string | null>(null);
  const openDeskIdsRef = useRef<string[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const suppressNextClickRef = useRef(false);
  const longPressRef = useRef<{
    timer: number | null;
    startX: number;
    startY: number;
  }>({ timer: null, startX: 0, startY: 0 });

  useEffect(() => {
    liveMessagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    selectedDeskRef.current = selectedDesk;
  }, [selectedDesk]);

  useEffect(() => {
    openDeskIdsRef.current = openDeskIds;
  }, [openDeskIds]);

  const loadLiveMessages = useCallback(async (authToken: string | null, since?: string) => {
    const url = since
      ? `/api/portal/chat/messages?since=${encodeURIComponent(since)}`
      : "/api/portal/chat/messages";
    const res = await fetch(url, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      credentials: "include",
    });
    if (res.status === 403) {
      setChatAllowed(false);
      const data = await res.json().catch(() => ({}));
      setStatusMessage(data.error || "Live Chat is limited to your company IT contact.");
      setConnected(false);
      return;
    }
    if (!res.ok) throw new Error("Failed to load chat");
    const data = await res.json();
    if (data.success && Array.isArray(data.messages)) {
      if (since) {
        setMessages((prev) => {
          const known = new Set(prev.map((m) => m.id));
          const incoming = data.messages.filter((m: ChatMessage) => !known.has(m.id));
          return incoming.length ? [...prev, ...incoming] : prev;
        });
      } else {
        setMessages(data.messages);
      }
      setConnected(true);
      setChatAllowed(true);
    }
  }, []);

  const loadDeskSessions = useCallback(async () => {
    try {
      const data = await portalGet<{ success: boolean; sessions: DeskSession[] }>(
        "/api/portal/desk-chats",
      );
      if (data.success) setDeskSessions(data.sessions || []);
    } catch (err) {
      console.error("Failed to load DE Desk chats:", err);
    }
  }, []);

  const refreshDeskThread = useCallback(async (sessionId: string) => {
    try {
      const data = await portalGet<{
        success: boolean;
        messages: DeskMessage[];
        session?: DeskSession;
      }>(`/api/portal/desk-chats/${sessionId}`);
      if (data.success) {
        setDeskThreads((prev) => ({ ...prev, [sessionId]: data.messages || [] }));
        if (data.session) {
          setDeskSessions((prev) => {
            const idx = prev.findIndex((s) => s.sessionId === sessionId);
            if (idx < 0) return [data.session!, ...prev];
            const next = [...prev];
            next[idx] = { ...next[idx], ...data.session! };
            return next;
          });
        }
      }
    } catch (err) {
      console.error("Failed to refresh DE Desk thread:", err);
    }
  }, []);

  useEffect(() => {
    const authToken = localStorage.getItem("portalToken");
    setToken(authToken || "");

    fetch("/api/portal/chat/status", {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.allowed === false) {
          setChatAllowed(false);
          setConnected(false);
          setStatusMessage(data.message || "Live Chat is limited to IT contacts.");
        }
      })
      .catch(() => {});

    loadLiveMessages(authToken).catch((err) => console.error(err));
    loadDeskSessions();

    pollRef.current = setInterval(() => {
      const live = liveMessagesRef.current;
      const last = live[live.length - 1]?.timestamp;
      loadLiveMessages(authToken, last).catch(() => {});
      loadDeskSessions().catch(() => {});
      const openIds = openDeskIdsRef.current;
      for (const id of openIds) {
        refreshDeskThread(id).catch(() => {});
      }
    }, 4000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadLiveMessages, loadDeskSessions, refreshDeskThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    deskEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedDesk, deskThreads]);

  const clearLongPress = useCallback(() => {
    if (longPressRef.current.timer != null) {
      window.clearTimeout(longPressRef.current.timer);
      longPressRef.current.timer = null;
    }
  }, []);

  useEffect(() => {
    if (!floatingMenu) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFloatingMenu(null);
    };
    const onPointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("[data-desk-session-menu]")) return;
      setFloatingMenu(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("touchstart", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("touchstart", onPointer);
    };
  }, [floatingMenu]);

  const openDeskSession = async (sessionId: string) => {
    setChannel("website");
    setSelectedDesk(sessionId);
    setOpenDeskIds((prev) => (prev.includes(sessionId) ? prev : [...prev, sessionId]));
    if (!deskThreads[sessionId]) setDeskLoading(true);
    try {
      await refreshDeskThread(sessionId);
      requestAnimationFrame(() => deskComposerRef.current?.focus());
    } finally {
      setDeskLoading(false);
    }
  };

  const closeDeskTab = (sessionId: string) => {
    setOpenDeskIds((prev) => prev.filter((id) => id !== sessionId));
    setSelectedDesk((cur) => {
      if (cur !== sessionId) return cur;
      const remaining = openDeskIds.filter((id) => id !== sessionId);
      return remaining[remaining.length - 1] || null;
    });
  };

  const mergeDeskSession = useCallback((updated: DeskSession) => {
    setDeskSessions((prev) => {
      const idx = prev.findIndex((s) => s.sessionId === updated.sessionId);
      if (idx < 0) return [updated, ...prev];
      const next = [...prev];
      next[idx] = { ...next[idx], ...updated };
      return next;
    });
  }, []);

  const claimDeskSession = async (sessionId: string) => {
    try {
      const data = await portalPost<{ success: boolean; session: DeskSession }>(
        `/api/portal/desk-chats/${sessionId}/claim`,
        {},
      );
      if (data.session) mergeDeskSession(data.session);
      toast({
        title: "Claimed for live handoff",
        description: "AI is paused on this thread while you reply.",
      });
      await openDeskSession(sessionId);
    } catch (err) {
      toast({
        title: "Could not claim session",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const releaseDeskSession = async (sessionId: string) => {
    try {
      const data = await portalPost<{ success: boolean; session: DeskSession }>(
        `/api/portal/desk-chats/${sessionId}/release`,
        {},
      );
      if (data.session) mergeDeskSession(data.session);
      toast({
        title: "Released to AI",
        description: "Visitor chat returns to DE Desk AI.",
      });
    } catch (err) {
      toast({
        title: "Could not release session",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const copyDeskText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `Copied ${label}` });
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard permission was denied.",
        variant: "destructive",
      });
    }
  };

  const createTicketFromDesk = (session: DeskSession) => {
    const subject = `Website chat follow-up — ${viewerLabel(session)}`.slice(0, 200);
    const description = [
      "Source: Website DE Desk",
      `Session: ${session.sessionId}`,
      session.email ? `Visitor email: ${session.email}` : null,
      session.contactName ? `Name: ${session.contactName}` : null,
      session.companyName ? `Company: ${session.companyName}` : null,
      session.pagePath ? `Page: ${session.pagePath}` : null,
      session.preview ? `Last preview: ${session.preview}` : null,
      "",
      "Agent notes:",
    ]
      .filter((line): line is string => line !== null)
      .join("\n");
    sessionStorage.setItem(
      DESK_TICKET_DRAFT_KEY,
      JSON.stringify({ subject, description, priority: "medium" }),
    );
    navigate("/portal/tickets/create");
  };

  const runDeskSessionAction = (session: DeskSession, action: DeskSessionAction) => {
    setFloatingMenu(null);
    switch (action) {
      case "open":
        void openDeskSession(session.sessionId);
        break;
      case "claim":
        void claimDeskSession(session.sessionId);
        break;
      case "release":
        void releaseDeskSession(session.sessionId);
        break;
      case "copy-id":
        void copyDeskText("session ID", session.sessionId);
        break;
      case "copy-email":
        if (session.email) void copyDeskText("email", session.email);
        break;
      case "copy-path":
        if (session.pagePath) void copyDeskText("page path", session.pagePath);
        break;
      case "create-ticket":
        createTicketFromDesk(session);
        break;
      case "close-tab":
        closeDeskTab(session.sessionId);
        break;
      default:
        break;
    }
  };

  const startSessionLongPress = (session: DeskSession, clientX: number, clientY: number) => {
    clearLongPress();
    longPressRef.current.startX = clientX;
    longPressRef.current.startY = clientY;
    longPressRef.current.timer = window.setTimeout(() => {
      suppressNextClickRef.current = true;
      setFloatingMenu({ session, x: clientX, y: clientY });
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate?.(12);
        } catch {
          /* ignore */
        }
      }
    }, LONG_PRESS_MS);
  };

  const handleDeskReply = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedDesk || !deskReply.trim() || deskSending || !token) return;
    const content = deskReply.trim();
    setDeskSending(true);
    setDeskReply("");
    const tempId = `temp-agent-${Date.now()}`;
    setDeskThreads((prev) => ({
      ...prev,
      [selectedDesk]: [
        ...(prev[selectedDesk] || []),
        {
          id: tempId,
          sessionId: selectedDesk,
          role: "agent",
          content,
          senderName: "You",
          createdAt: new Date().toISOString(),
        },
      ],
    }));

    try {
      const response = await fetch(`/api/portal/desk-chats/${selectedDesk}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Failed to send reply");
      setDeskThreads((prev) => {
        const thread = (prev[selectedDesk] || []).filter((m) => m.id !== tempId);
        if (data.message) thread.push(data.message as DeskMessage);
        return { ...prev, [selectedDesk]: thread };
      });
      setDeskSessions((prev) =>
        prev.map((s) =>
          s.sessionId === selectedDesk
            ? {
                ...s,
                agentActive: true,
                agentName: data.agentName || s.agentName,
                updatedAt: new Date().toISOString(),
              }
            : s,
        ),
      );
    } catch (err) {
      console.error(err);
      setDeskThreads((prev) => ({
        ...prev,
        [selectedDesk]: (prev[selectedDesk] || []).filter((m) => m.id !== tempId),
      }));
      setDeskReply(content);
    } finally {
      setDeskSending(false);
    }
  };

  const handleSendMessage = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!messageText.trim() || sending || !chatAllowed) return;

      const currentMessage = messageText;
      setSending(true);
      setMessageText("");

      const tempMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        senderName: "You",
        senderRole: "client",
        content: currentMessage,
        timestamp: new Date().toISOString(),
        isRead: true,
      };
      setMessages((prev) => [...prev, tempMessage]);

      try {
        const response = await fetch("/api/portal/chat/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
          body: JSON.stringify({
            senderName: "You",
            content: currentMessage,
          }),
        });

        if (!response.ok) throw new Error("Failed to send message");

        const data = await response.json();
        if (data.success && data.message) {
          setMessages((prev) => {
            const withoutTemp = prev.filter((m) => m.id !== tempMessage.id);
            const next = [...withoutTemp, data.message];
            if (data.reply) next.push(data.reply);
            return next;
          });
        }
      } catch (error) {
        console.error("Error sending message:", error);
        setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id));
      } finally {
        setSending(false);
      }
    },
    [messageText, sending, token, chatAllowed],
  );

  const activeSession = deskSessions.find((s) => s.sessionId === selectedDesk) || null;
  const activeMessages = selectedDesk ? deskThreads[selectedDesk] || [] : [];
  const liveCount = deskSessions.filter((s) => s.agentActive).length;

  return (
    <PortalLayout title="Chats / DE Desk">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
        {/* Ops header */}
        <div className="overflow-hidden rounded-2xl border border-[#D3126A]/35 bg-gradient-to-br from-[#151217] via-[#0a0a0a] to-[#050312] p-4 text-white shadow-[0_0_0_1px_rgba(211,18,106,0.2),0_20px_50px_rgba(40,10,70,0.35)] sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#F04C97]/35 bg-[#D3126A]/15 px-2.5 py-1 text-sm font-semibold uppercase tracking-[0.14em] text-[#F04C97]">
                <Headphones className="h-3.5 w-3.5" aria-hidden />
                Operations desk
              </div>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Chats &amp; DE Desk</h2>
              <p className="mt-1 max-w-2xl text-sm text-white/65">
                Website DE Desk replies land in the visitor widget. Portal live chat is a separate
                IT-contact channel. Tickets stay under{" "}
                <Link
                  href="/portal/tickets"
                  className="font-medium text-[#F04C97] underline-offset-2 hover:underline"
                >
                  Support Tickets
                </Link>
                .
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70">
                <span className="font-semibold text-white">{deskSessions.length}</span> website
                sessions
              </div>
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">
                <span className="font-semibold">{liveCount}</span> live handoffs
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white"
                onClick={() => {
                  void loadDeskSessions();
                  if (token) void loadLiveMessages(token);
                  if (selectedDesk) void refreshDeskThread(selectedDesk);
                }}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Refresh
              </Button>
            </div>
          </div>

          <div
            className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/20 p-1"
            role="tablist"
            aria-label="Chat channel"
          >
            <button
              type="button"
              role="tab"
              aria-selected={channel === "website"}
              onClick={() => setChannel("website")}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                channel === "website"
                  ? "bg-gradient-to-r from-[#D3126A] to-[#D3126A] text-white shadow-lg shadow-[#D3126A]/25"
                  : "text-white/55 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Globe2 className="h-4 w-4" aria-hidden />
              Website DE Desk
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={channel === "portal"}
              onClick={() => setChannel("portal")}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                channel === "portal"
                  ? "bg-gradient-to-r from-[#D3126A] to-[#D3126A] text-white shadow-lg shadow-[#D3126A]/25"
                  : "text-white/55 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Building2 className="h-4 w-4" aria-hidden />
              Portal live chat
            </button>
          </div>
        </div>

        {channel === "website" && (
          <div className="overflow-hidden rounded-2xl border border-[#D3126A]/30 bg-[#151217] text-white shadow-[0_0_0_1px_rgba(211,18,106,0.18),0_24px_60px_rgba(30,8,55,0.45)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <Users className="h-4 w-4 shrink-0 text-[#C4B5FD]" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Website viewers</p>
                  <p className="truncate text-xs text-white/50">
                    Replies here appear in the visitor&apos;s DE Desk widget
                  </p>
                </div>
              </div>
              <Link href="/portal/tickets">
                <Button
                  size="sm"
                  className="gap-2 border border-white/10 bg-white/[0.06] text-white hover:bg-white/10"
                >
                  <Ticket className="h-4 w-4" aria-hidden />
                  Tickets
                </Button>
              </Link>
            </div>

            {openDeskIds.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto border-b border-white/10 bg-[#151217]/80 px-2 py-2">
                {openDeskIds.map((id) => {
                  const s = deskSessions.find((d) => d.sessionId === id);
                  const label = s ? viewerLabel(s) : id.slice(0, 8);
                  const active = selectedDesk === id;
                  return (
                    <div
                      key={id}
                      className={`group flex max-w-[240px] items-center gap-1 rounded-lg border px-2 py-1.5 text-xs ${
                        active
                          ? "border-[#F04C97]/60 bg-[#D3126A]/25 text-white"
                          : "border-transparent text-white/60 hover:bg-white/5"
                      }`}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left font-medium"
                        onClick={() => void openDeskSession(id)}
                      >
                        {s?.agentActive && (
                          <Radio
                            className="mr-1 inline h-3 w-3 text-emerald-400"
                            aria-hidden="true"
                          />
                        )}
                        {s ? sessionNameLabel(s) : id.slice(0, 8)}
                      </button>
                      <button
                        type="button"
                        aria-label={`Close ${label}`}
                        className="rounded p-0.5 text-white/40 hover:bg-white/10 hover:text-white"
                        onClick={() => closeDeskTab(id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid min-h-[520px] grid-cols-1 lg:grid-cols-[300px_1fr]">
              <aside className="max-h-[640px] overflow-y-auto border-b border-white/10 lg:border-b-0 lg:border-r lg:border-white/10">
                {deskSessions.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                    <MessageSquare className="h-8 w-8 text-white/25" aria-hidden />
                    <p className="text-sm text-white/55">
                      No website conversations yet. When visitors use DE Desk, they appear here.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="border-b border-white/5 px-4 py-2 text-xs uppercase tracking-[0.14em] text-white/40">
                      Long-press or right-click for options
                    </p>
                    <ul className="divide-y divide-white/5">
                      {deskSessions.map((s) => {
                        const active = selectedDesk === s.sessionId;
                        const open = openDeskIds.includes(s.sessionId);
                        return (
                          <li key={s.sessionId}>
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (suppressNextClickRef.current) {
                                      suppressNextClickRef.current = false;
                                      return;
                                    }
                                    void openDeskSession(s.sessionId);
                                  }}
                                  onContextMenu={() => setFloatingMenu(null)}
                                  onTouchStart={(event) => {
                                    const touch = event.touches[0];
                                    if (!touch) return;
                                    startSessionLongPress(s, touch.clientX, touch.clientY);
                                  }}
                                  onTouchMove={(event) => {
                                    const touch = event.touches[0];
                                    if (!touch) return;
                                    const dx = touch.clientX - longPressRef.current.startX;
                                    const dy = touch.clientY - longPressRef.current.startY;
                                    if (Math.hypot(dx, dy) > 12) clearLongPress();
                                  }}
                                  onTouchEnd={clearLongPress}
                                  onTouchCancel={clearLongPress}
                                  className={`w-full px-4 py-3.5 text-left transition select-none ${
                                    active
                                      ? "bg-[#D3126A]/20"
                                      : open
                                        ? "bg-white/[0.03]"
                                        : "hover:bg-white/[0.04]"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="min-w-0">
                                      <span className="block truncate text-sm font-semibold text-white">
                                        {sessionNameLabel(s)}
                                      </span>
                                      {sessionCompanyLabel(s) ? (
                                        <span className="mt-0.5 block truncate text-sm font-normal text-white/45">
                                          {sessionCompanyLabel(s)}
                                        </span>
                                      ) : null}
                                    </span>
                                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-white/45">
                                      <Clock3 className="h-3 w-3" aria-hidden />
                                      {formatClock(s.updatedAt)}
                                    </span>
                                  </div>
                                  <p className="mt-1 line-clamp-2 text-xs text-white/50">
                                    {s.preview || "DE Desk conversation"}
                                  </p>
                                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-white/55">
                                      {s.messageCount} msgs
                                    </span>
                                    {s.agentActive && (
                                      <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 font-semibold text-emerald-300">
                                        Live
                                      </span>
                                    )}
                                    {open && !active && (
                                      <span className="rounded-full bg-[#F04C97]/20 px-2 py-0.5 font-semibold text-[#F04C97]">
                                        Open
                                      </span>
                                    )}
                                    {s.pagePath && (
                                      <span className="truncate rounded-full bg-white/5 px-2 py-0.5 text-white/45">
                                        {s.pagePath}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 border-white/10 bg-[#151217] text-white">
                                <ContextMenuItem
                                  className="gap-2 focus:bg-white/10 focus:text-white"
                                  onSelect={() => runDeskSessionAction(s, "open")}
                                >
                                  <MessageSquare className="h-4 w-4" aria-hidden />
                                  Open conversation
                                </ContextMenuItem>
                                <ContextMenuItem
                                  className="gap-2 focus:bg-white/10 focus:text-white"
                                  disabled={!!s.agentActive}
                                  onSelect={() => runDeskSessionAction(s, "claim")}
                                >
                                  <UserCheck className="h-4 w-4" aria-hidden />
                                  Claim for live handoff
                                </ContextMenuItem>
                                <ContextMenuItem
                                  className="gap-2 focus:bg-white/10 focus:text-white"
                                  disabled={!s.agentActive}
                                  onSelect={() => runDeskSessionAction(s, "release")}
                                >
                                  <Bot className="h-4 w-4" aria-hidden />
                                  Release to AI
                                </ContextMenuItem>
                                <ContextMenuSeparator className="bg-white/10" />
                                <ContextMenuItem
                                  className="gap-2 focus:bg-white/10 focus:text-white"
                                  onSelect={() => runDeskSessionAction(s, "copy-id")}
                                >
                                  <Copy className="h-4 w-4" aria-hidden />
                                  Copy session ID
                                </ContextMenuItem>
                                <ContextMenuItem
                                  className="gap-2 focus:bg-white/10 focus:text-white"
                                  disabled={!s.email}
                                  onSelect={() => runDeskSessionAction(s, "copy-email")}
                                >
                                  <Copy className="h-4 w-4" aria-hidden />
                                  Copy email
                                </ContextMenuItem>
                                <ContextMenuItem
                                  className="gap-2 focus:bg-white/10 focus:text-white"
                                  disabled={!s.pagePath}
                                  onSelect={() => runDeskSessionAction(s, "copy-path")}
                                >
                                  <Copy className="h-4 w-4" aria-hidden />
                                  Copy page path
                                </ContextMenuItem>
                                <ContextMenuSeparator className="bg-white/10" />
                                <ContextMenuItem
                                  className="gap-2 focus:bg-white/10 focus:text-white"
                                  onSelect={() => runDeskSessionAction(s, "create-ticket")}
                                >
                                  <Ticket className="h-4 w-4" aria-hidden />
                                  Create support ticket
                                </ContextMenuItem>
                                <ContextMenuItem
                                  className="gap-2 focus:bg-white/10 focus:text-white"
                                  disabled={!open}
                                  onSelect={() => runDeskSessionAction(s, "close-tab")}
                                >
                                  <X className="h-4 w-4" aria-hidden />
                                  Close tab
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </aside>

              <div className="flex min-h-[520px] flex-col bg-[#050312]">
                {!selectedDesk ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
                    <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D3126A]/35 bg-[#D3126A]/15">
                      <MessageSquare className="h-6 w-6 text-[#C4B5FD]" aria-hidden />
                    </div>
                    <p className="text-sm font-medium text-white/80">
                      Select a website viewer to open their DE Desk thread
                    </p>
                    <p className="max-w-sm text-xs text-white/45">
                      Keep multiple viewers open as tabs. Long-press or right-click a session for
                      claim, release, copy, or ticket. Enter sends · Shift+Enter for a new line.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#151217]/70 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {activeSession ? sessionNameLabel(activeSession) : "Name not given yet"}
                        </p>
                        {activeSession && sessionCompanyLabel(activeSession) ? (
                          <p className="truncate text-sm text-white/45">
                            {sessionCompanyLabel(activeSession)}
                          </p>
                        ) : null}
                        <p className="truncate text-xs text-white/50">
                          {activeSession?.email || "no email yet"}
                          {activeSession?.pagePath ? ` · ${activeSession.pagePath}` : ""}
                          {activeSession?.agentActive
                            ? ` · ${activeSession.agentName || "Agent"} live`
                            : " · AI until you reply"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {activeSession?.agentActive ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 border-white/15 bg-white/5 text-white hover:bg-white/10"
                            onClick={() => void releaseDeskSession(activeSession.sessionId)}
                          >
                            <Bot className="h-3.5 w-3.5" aria-hidden />
                            Release
                          </Button>
                        ) : activeSession ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15"
                            onClick={() => void claimDeskSession(activeSession.sessionId)}
                          >
                            <UserCheck className="h-3.5 w-3.5" aria-hidden />
                            Claim
                          </Button>
                        ) : null}
                        {activeSession?.agentActive ? (
                          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-sm font-semibold text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            On desk
                          </span>
                        ) : (
                          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-sm font-medium text-white/55">
                            Standby
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto p-4 max-h-[420px] sm:max-h-[480px]">
                      {deskLoading && activeMessages.length === 0 ? (
                        <p className="text-sm text-white/50">Loading thread…</p>
                      ) : activeMessages.length === 0 ? (
                        <p className="text-sm text-white/50">No messages in this session.</p>
                      ) : (
                        activeMessages.map((m) => {
                          const isUser = m.role === "user";
                          const isAgent = m.role === "agent";
                          return (
                            <div
                              key={m.id}
                              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm ${
                                  isUser
                                    ? "rounded-br-md bg-[#D3126A] text-white shadow-[0_8px_24px_rgba(211,18,106,0.25)]"
                                    : isAgent
                                      ? "rounded-bl-md border border-sky-400/30 bg-sky-500/15 text-sky-50"
                                      : "rounded-bl-md border border-white/10 bg-white/[0.06] text-white/90"
                                }`}
                              >
                                <div className="mb-1 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.12em] opacity-70">
                                  <span>
                                    {isUser
                                      ? "Visitor"
                                      : isAgent
                                        ? m.senderName || "You (agent)"
                                        : "DE Desk AI"}
                                  </span>
                                  <span className="normal-case tracking-normal">
                                    {formatClock(m.createdAt)}
                                  </span>
                                </div>
                                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={deskEndRef} />
                    </div>

                    <form
                      onSubmit={handleDeskReply}
                      className="border-t border-white/10 bg-[#151217]/80 p-3"
                    >
                      <div className="flex gap-2">
                        <Textarea
                          ref={deskComposerRef}
                          value={deskReply}
                          onChange={(e) => setDeskReply(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              void handleDeskReply();
                            }
                          }}
                          placeholder="Reply as agent — visitor sees this in the website chat…"
                          rows={2}
                          className="min-h-[56px] resize-none border-white/15 bg-[#050312] text-white placeholder:text-white/35 focus-visible:ring-[#D3126A]"
                          disabled={deskSending}
                        />
                        <Button
                          type="submit"
                          disabled={!deskReply.trim() || deskSending}
                          className="h-auto min-h-[56px] shrink-0 bg-gradient-to-br from-[#D3126A] to-[#D3126A] px-4 text-white hover:opacity-95"
                          aria-label="Send agent reply"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="mt-2 text-sm text-white/40">
                        Enter to send · Shift+Enter for newline · This channel is website DE Desk
                        only
                      </p>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {channel === "portal" && (
          <>
            {!chatAllowed && statusMessage && (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                  <p className="text-sm text-amber-100">{statusMessage}</p>
                </div>
              </div>
            )}

            {chatAllowed && (
              <div className="flex h-[min(640px,70vh)] flex-col overflow-hidden rounded-2xl border border-[#D3126A]/30 bg-[#151217] text-white shadow-[0_0_0_1px_rgba(211,18,106,0.18),0_24px_60px_rgba(30,8,55,0.45)]">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">Portal live chat</p>
                    <p className="text-xs text-white/50">
                      IT-contact channel — separate from website DE Desk
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <span
                      className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`}
                    />
                    {connected ? "Online" : "Offline"}
                  </div>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {messages.length === 0 ? (
                    <p className="text-sm text-white/50">No portal messages yet.</p>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.senderRole === "client" ? "justify-end" : "justify-start"}`}
                        data-testid={`message-${message.id}`}
                      >
                        <div
                          className={`max-w-xs rounded-2xl px-4 py-2.5 sm:max-w-md ${
                            message.senderRole === "client"
                              ? "rounded-br-md bg-[#D3126A] text-white"
                              : "rounded-bl-md border border-white/10 bg-white/[0.06] text-white/90"
                          }`}
                        >
                          <p className="mb-1 text-xs font-medium opacity-70">{message.senderName}</p>
                          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                          <p className="mt-1 text-xs opacity-60">
                            {formatClock(message.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form
                  onSubmit={handleSendMessage}
                  className="flex gap-2 border-t border-white/10 bg-[#151217]/80 p-3"
                >
                  <Textarea
                    placeholder="Type your portal message…"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendMessage();
                      }
                    }}
                    disabled={!connected || sending}
                    rows={2}
                    className="min-h-[52px] flex-1 resize-none border-white/15 bg-[#050312] text-white placeholder:text-white/35 focus-visible:ring-[#D3126A]"
                    data-testid="input-message"
                  />
                  <Button
                    type="submit"
                    disabled={!messageText.trim() || !connected || sending}
                    className="h-auto min-h-[52px] shrink-0 bg-gradient-to-br from-[#D3126A] to-[#D3126A] text-white"
                    data-testid="button-send-message"
                    aria-label="Send portal message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            )}
          </>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm dark:border-white/10 dark:bg-white/[0.03] dark:text-white/60">
          <p>
            <strong className="text-gray-900 dark:text-white/80">Support hours:</strong> Monday–Friday,
            9 AM–6 PM EST. Outside hours, open a ticket anytime from DE Desk or{" "}
            <Link
              href="/portal/tickets/create"
              className="text-[#D3126A] hover:underline dark:text-[#F04C97]"
            >
              create a ticket
            </Link>
            .
          </p>
        </div>
      </div>

      {floatingMenu &&
        (() => {
          const session = floatingMenu.session;
          const open = openDeskIds.includes(session.sessionId);
          const pos = clampMenuPosition(floatingMenu.x, floatingMenu.y);
          return (
            <div
              data-desk-session-menu
              role="menu"
              aria-label={`Options for ${viewerLabel(session)}`}
              className="fixed z-[80] w-56 overflow-hidden rounded-xl border border-white/15 bg-[#151217] p-1 text-white shadow-2xl"
              style={{ left: pos.left, top: pos.top }}
            >
              {(
                [
                  {
                    action: "open" as const,
                    label: "Open conversation",
                    icon: MessageSquare,
                    disabled: false,
                  },
                  {
                    action: "claim" as const,
                    label: "Claim for live handoff",
                    icon: UserCheck,
                    disabled: !!session.agentActive,
                  },
                  {
                    action: "release" as const,
                    label: "Release to AI",
                    icon: Bot,
                    disabled: !session.agentActive,
                  },
                  {
                    action: "copy-id" as const,
                    label: "Copy session ID",
                    icon: Copy,
                    disabled: false,
                  },
                  {
                    action: "copy-email" as const,
                    label: "Copy email",
                    icon: Copy,
                    disabled: !session.email,
                  },
                  {
                    action: "copy-path" as const,
                    label: "Copy page path",
                    icon: Copy,
                    disabled: !session.pagePath,
                  },
                  {
                    action: "create-ticket" as const,
                    label: "Create support ticket",
                    icon: Ticket,
                    disabled: false,
                  },
                  {
                    action: "close-tab" as const,
                    label: "Close tab",
                    icon: X,
                    disabled: !open,
                  },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.action}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-white/90 hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
                    onClick={() => runDeskSessionAction(session, item.action)}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {item.label}
                  </button>
                );
              })}
            </div>
          );
        })()}
    </PortalLayout>
  );
};
