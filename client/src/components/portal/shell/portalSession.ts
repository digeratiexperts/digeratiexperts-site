import { useEffect, useState } from "react";
import { portalGet, redirectToPortalLogin } from "@/lib/portalApi";
import { readPortalUser, type PortalUserSession } from "@/lib/portalRoles";

/**
 * One session check per page load, shared by every PortalLayout mount.
 *
 * Every portal page renders its own <PortalLayout>, so wouter remounts the
 * shell on each navigation. The previous shell re-fetched /api/portal/me on
 * every mount and showed "Checking session…" each time. This module keeps the
 * in-flight promise so the second and later mounts resolve synchronously.
 *
 * Only a genuine auth rejection (401/403) ends the session; a 500 or a network
 * blip keeps whatever we have (error-sweep finding, 2026-08-31).
 */

type SessionState = { ready: boolean; user: PortalUserSession | null };

let inflight: Promise<PortalUserSession | null> | null = null;
let resolved = false;
let cached: PortalUserSession | null = null;
const listeners = new Set<(state: SessionState) => void>();

function notify() {
  const state = { ready: resolved, user: cached };
  listeners.forEach((fn) => fn(state));
}

function persist(user: PortalUserSession) {
  localStorage.setItem("portalUser", JSON.stringify(user));
  localStorage.setItem("portalUserId", user.id || "portal-user");
  if (user.email) localStorage.setItem("userEmail", user.email);
}

export function ensurePortalSession(): Promise<PortalUserSession | null> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const me = await portalGet<{ user: PortalUserSession }>("/api/portal/me");
      if (me?.user) {
        persist(me.user);
        cached = me.user;
      } else {
        cached = readPortalUser();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const status = Number.parseInt(message.split(":")[0] ?? "", 10);
      if (status === 401 || status === 403) {
        resetPortalSession();
        redirectToPortalLogin(`${window.location.pathname}${window.location.search || ""}`);
        return null;
      }
      cached = readPortalUser();
    }
    resolved = true;
    notify();
    return cached;
  })();
  return inflight;
}

/** Forget the cached session (logout, impersonation change). */
export function resetPortalSession() {
  inflight = null;
  resolved = false;
  cached = null;
}

export function usePortalSession(): SessionState {
  const [state, setState] = useState<SessionState>(() => ({
    ready: resolved,
    user: resolved ? cached : readPortalUser(),
  }));

  useEffect(() => {
    listeners.add(setState);
    void ensurePortalSession();
    if (resolved) setState({ ready: true, user: cached });
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return state;
}
