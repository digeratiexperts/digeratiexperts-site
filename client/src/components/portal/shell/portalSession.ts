import { useEffect, useState } from "react";
import { clearPortalLocalSession, clearPortalUserSnapshot, PORTAL_SESSION_RESET_EVENT, portalGet, redirectToPortalLogin } from "@/lib/portalApi";
import type { PortalUserSession } from "@/lib/portalRoles";
import { clearPortalAppearanceScope, setVerifiedPortalAppearanceContext } from "./portalTheme";

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
let epoch = 0;
let signingOut = false;
let eventWindow: Window | null = null;
const listeners = new Set<(state: SessionState) => void>();

export function subscribePortalSession(listener: (state: SessionState) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function listenForSessionChanges() {
  if (typeof window === "undefined" || eventWindow === window) return;
  eventWindow = window;
  window.addEventListener(PORTAL_SESSION_RESET_EVENT, () => resetPortalSession());
  window.addEventListener("de-portal-auth-changed", () => resetPortalSession());
  window.addEventListener("storage", (event) => {
    // Same-account reauthentication in another tab must preserve this tab's
    // unsaved work. These comparisons suppress invalidation only; disk never
    // establishes a session or changes the verified principal.
    if (event.key === "portalUser" && event.newValue && cached) {
      try {
        const incoming = JSON.parse(event.newValue);
        if (incoming?.id === cached.id && incoming?.clientId === cached.clientId) return;
      } catch { /* malformed snapshots invalidate */ }
    }
    if (event.key === "portalUserId" && cached && event.newValue === cached.id) return;
    if (event.key === null || ["portalUser", "portalUserId", "impersonatingCompany"].includes(event.key)) {
      // The incoming shared snapshot belongs to the other tab. Invalidating
      // this document must not delete it and reset that tab in return.
      invalidatePortalSession(false);
    }
  });
}

function notify() {
  const state = { ready: resolved, user: cached };
  // A UI subscriber cannot prevent other subscribers, cleanup or server logout.
  // Snapshot the set so subscription changes cannot extend this dispatch.
  for (const listener of [...listeners]) {
    try { listener(state); } catch { /* observers do not own session lifecycle */ }
  }
}

function persist(user: PortalUserSession) {
  // Compatibility snapshot for existing page readers, never session authority.
  // Migrating those readers and the Store's separate email capture is a later slice.
  for (const [key, value] of [["portalUser", JSON.stringify(user)], ["portalUserId", user.id || "portal-user"]]) {
    try { localStorage.setItem(key, value); } catch { /* memory remains usable */ }
  }
}

export function ensurePortalSession(): Promise<PortalUserSession | null> {
  listenForSessionChanges();
  if (signingOut) return Promise.resolve(null);
  if (inflight) return inflight;
  const requestEpoch = epoch;
  inflight = (async () => {
    try {
      // This checker owns current 401/403 handling below. Background-query
      // expiry events must not escape an outdated check before its epoch guard.
      const me = await portalGet<{ user: PortalUserSession }>("/api/portal/me", { notifySessionExpiry: false });
      if (requestEpoch !== epoch) return null;
      if (me?.user && typeof me.user.id === "string" && me.user.id.trim().length > 0) {
        await setVerifiedPortalAppearanceContext(me.user);
        if (requestEpoch !== epoch) return null;
        persist(me.user);
        cached = me.user;
      }
    } catch (err) {
      if (requestEpoch !== epoch) return null;
      const message = err instanceof Error ? err.message : "";
      const status = Number.parseInt(message.split(":")[0] ?? "", 10);
      if (status === 401 || status === 403) {
        resetPortalSession();
        redirectToPortalLogin(`${window.location.pathname}${window.location.search || ""}`);
        return null;
      }
      // Only retain a user verified in this document. Disk snapshots may belong
      // to a previous account and cannot recover a failed session check.
    }
    resolved = true;
    notify();
    return cached;
  })();
  return inflight;
}

function invalidatePortalSession(clearSnapshot: boolean) {
  epoch += 1;
  inflight = null;
  resolved = false;
  cached = null;
  // Preserve the cookie/token and selected-company markers for the existing
  // tenant switch flow; only the outgoing user's compatibility snapshot goes.
  if (clearSnapshot) clearPortalUserSnapshot();
  clearPortalAppearanceScope();
  notify();
}

/** Forget the cached session (logout, impersonation change). */
export function resetPortalSession() {
  invalidatePortalSession(true);
}

export function usePortalSession(): SessionState {
  const [state, setState] = useState<SessionState>(() => ({
    ready: resolved,
    user: cached,
  }));

  useEffect(() => {
    const unsubscribe = subscribePortalSession(setState);
    if (resolved) setState({ ready: true, user: cached });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!state.ready) void ensurePortalSession();
  }, [state]);

  return state;
}

/** End the portal session here and on the server, then go to the login page. */
export async function signOutOfPortal(): Promise<void> {
  signingOut = true;
  // Invalidate before waiting for the server: old /me responses are now inert.
  resetPortalSession();
  clearPortalLocalSession();
  try {
    await fetch("/api/portal/logout", { method: "POST", credentials: "include" });
  } catch {
    /* still clear local */
  }
  clearPortalLocalSession();
  window.location.href = "/portal/login";
}
