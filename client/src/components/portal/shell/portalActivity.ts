import { useEffect, useState } from "react";

/**
 * The live-update feed shown in the topbar. It records only what the portal
 * SSE stream (/api/portal/events/stream) actually delivered this session;
 * there is no invented notification data (design/DESIGN-AUTHORITY.md Tier 0).
 */
export type PortalActivityEvent = {
  id: string;
  eventType: string;
  entityId?: string;
  receivedAt: number;
};

export type PortalActivityState = {
  connected: boolean;
  events: PortalActivityEvent[];
  unseen: number;
};

const MAX_EVENTS = 25;
let state: PortalActivityState = { connected: false, events: [], unseen: 0 };
const listeners = new Set<(s: PortalActivityState) => void>();

function emit() {
  listeners.forEach((fn) => fn(state));
}

export function portalActivityConnected(connected: boolean) {
  if (state.connected === connected) return;
  state = { ...state, connected };
  emit();
}

export function recordPortalActivity(payload: { eventType: string; entityId?: string }) {
  const event: PortalActivityEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    eventType: payload.eventType,
    entityId: payload.entityId,
    receivedAt: Date.now(),
  };
  state = {
    ...state,
    events: [event, ...state.events].slice(0, MAX_EVENTS),
    unseen: state.unseen + 1,
  };
  emit();
}

export function markPortalActivitySeen() {
  if (state.unseen === 0) return;
  state = { ...state, unseen: 0 };
  emit();
}

export function usePortalActivity(): PortalActivityState {
  const [snapshot, setSnapshot] = useState(state);
  useEffect(() => {
    listeners.add(setSnapshot);
    setSnapshot(state);
    return () => {
      listeners.delete(setSnapshot);
    };
  }, []);
  return snapshot;
}

/** "ticket.comment_added" → "Ticket comment added". */
export function describeActivity(eventType: string): string {
  const words = eventType.replace(/[._-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
