import { useState, useEffect, useCallback, useMemo } from "react";
import type { ClientType } from "@/data/storeProducts";
import { portalLoginWithReturn } from "@/lib/portalUrls";
import { marketplaceReturnTo } from "@shared/portalReturnTo";

export type StoreRole = "public" | "prospect" | "managed" | "comanaged" | "admin";

export interface PortalUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: string;
  storeRole?: StoreRole;
  clientId?: string | null;
}

export interface ClientPricing {
  productId: string;
  customPrice: number;
  discountPercent: number;
}

export interface StoreAuthState {
  isLoggedIn: boolean;
  isLoading: boolean;
  user: PortalUser | null;
  token: string | null;
  clientType: ClientType;
  clientId: string | null;
  storeRole: StoreRole;
  clientPricing: ClientPricing[];
  canPurchase: boolean;
  isAdmin: boolean;
  loginRedirect: () => void;
  logout: () => void;
  refreshPricing: () => Promise<void>;
  getProductPrice: (productId: string, basePrice: number) => { price: number; hasDiscount: boolean; discountPercent: number };
}

const PORTAL_USER_KEY = "portalUser";
const PORTAL_TOKEN_KEY = "portalToken";

export function useStoreAuth(): StoreAuthState {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<PortalUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [clientType, setClientType] = useState<ClientType>("public");
  const [clientPricing, setClientPricing] = useState<ClientPricing[]>([]);

  const fetchClientInfo = useCallback(async () => {
    try {
      const response = await fetch("/api/store/client-info", { credentials: "include", cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        setClientType(data.clientType || "public");
        return data.clientType as ClientType;
      }
      setClientType("public");
    } catch (error) {
      console.error("Failed to fetch client info:", error);
      setClientType("public");
    }
    return "public" as ClientType;
  }, []);

  const fetchClientPricing = useCallback(async () => {
    try {
      const response = await fetch("/api/store/client-pricing", { credentials: "include", cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        setClientPricing(Array.isArray(data.pricing) ? data.pricing : []);
        return;
      }
      setClientPricing([]);
    } catch (error) {
      console.error("Failed to fetch client pricing:", error);
      setClientPricing([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const initAuth = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/portal/me", {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) {
          localStorage.removeItem(PORTAL_USER_KEY);
          localStorage.removeItem(PORTAL_TOKEN_KEY);
          if (!cancelled) {
            setUser(null);
            setToken(null);
            setClientType("public");
            setClientPricing([]);
          }
          return;
        }
        const data = (await response.json()) as { user?: PortalUser };
        if (!data.user || cancelled) return;
        localStorage.setItem(PORTAL_USER_KEY, JSON.stringify(data.user));
        localStorage.setItem("portalUserId", data.user.id || "portal-user");
        if (data.user.email) localStorage.setItem("userEmail", data.user.email);
        setUser(data.user);
        setToken(localStorage.getItem(PORTAL_TOKEN_KEY));
        await Promise.all([fetchClientInfo(), fetchClientPricing()]);
      } catch (error) {
        console.error("Failed to initialize store auth:", error);
        if (!cancelled) {
          setUser(null);
          setToken(null);
          setClientType("public");
          setClientPricing([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void initAuth();
    const handleAuthChange = () => void initAuth();
    const handleStorageChange = (event: StorageEvent) => {
      if (!event.key || event.key === PORTAL_USER_KEY || event.key === PORTAL_TOKEN_KEY) {
        void initAuth();
      }
    };
    window.addEventListener("focus", handleAuthChange);
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("de-portal-auth-changed", handleAuthChange);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleAuthChange);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("de-portal-auth-changed", handleAuthChange);
    };
  }, [fetchClientInfo, fetchClientPricing]);

  const loginRedirect = useCallback(() => {
    const currentPath = window.location.pathname;
    localStorage.setItem("storeRedirectAfterLogin", currentPath);
    window.location.href = portalLoginWithReturn(marketplaceReturnTo(currentPath));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(PORTAL_USER_KEY);
    localStorage.removeItem(PORTAL_TOKEN_KEY);
    localStorage.removeItem("portalUserId");
    localStorage.removeItem("impersonatingCompany");
    setUser(null);
    setToken(null);
    setClientType("public");
    setClientPricing([]);
    void fetch("/api/portal/logout", { method: "POST", credentials: "include" }).finally(() => {
      window.dispatchEvent(new CustomEvent("de-portal-auth-changed"));
    });
  }, []);

  const refreshPricing = useCallback(async () => {
    if (user) await fetchClientPricing();
    else setClientPricing([]);
  }, [user, fetchClientPricing]);

  const getProductPrice = useCallback(
    (productId: string, basePrice: number) => {
      const pricing = clientPricing.find((p) => p.productId === productId);
      if (pricing) {
        return {
          price: pricing.customPrice,
          hasDiscount: true,
          discountPercent: pricing.discountPercent,
        };
      }
      return { price: basePrice, hasDiscount: false, discountPercent: 0 };
    },
    [clientPricing],
  );

  const isLoggedIn = useMemo(() => !!user, [user]);
  const clientId = useMemo(() => user?.clientId || null, [user]);
  const storeRole: StoreRole = useMemo(() => user?.storeRole || (user ? "prospect" : "public"), [user]);
  const canPurchase = useMemo(() => storeRole === "comanaged" || storeRole === "admin", [storeRole]);
  const isAdmin = useMemo(() => storeRole === "admin", [storeRole]);

  return {
    isLoggedIn,
    isLoading,
    user,
    token,
    clientType,
    clientId,
    storeRole,
    clientPricing,
    canPurchase,
    isAdmin,
    loginRedirect,
    logout,
    refreshPricing,
    getProductPrice,
  };
}
