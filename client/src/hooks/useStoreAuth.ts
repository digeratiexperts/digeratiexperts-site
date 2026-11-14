import { useState, useEffect, useCallback, useMemo } from "react";
import type { ClientType } from "@/data/storeProducts";
import { portalLoginWithReturn } from "@/lib/portalUrls";

// Store role types for RBAC
export type StoreRole = 'public' | 'prospect' | 'managed' | 'comanaged' | 'admin';

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
  clientType: ClientType;
  clientId: string | null;
  storeRole: StoreRole;
  clientPricing: ClientPricing[];
  canPurchase: boolean;
  isAdmin: boolean;
  loginRedirect: () => void;
  logout: () => Promise<void>;
  refreshPricing: () => Promise<void>;
  getProductPrice: (productId: string, basePrice: number) => { price: number; hasDiscount: boolean; discountPercent: number };
}

const PORTAL_USER_KEY = "portalUser";

export function useStoreAuth(): StoreAuthState {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<PortalUser | null>(null);
  const [clientType, setClientType] = useState<ClientType>("public");
  const [clientPricing, setClientPricing] = useState<ClientPricing[]>([]);

  const fetchClientInfo = useCallback(async () => {
    try {
      const response = await fetch("/api/store/client-info", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setClientType(data.clientType || "public");
        return data.clientType as ClientType;
      }
    } catch (error) {
      console.error("Failed to fetch client info:", error);
    }
    return "public" as ClientType;
  }, []);

  const fetchClientPricing = useCallback(async () => {
    try {
      const response = await fetch("/api/store/client-pricing", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setClientPricing(data.pricing || []);
      }
    } catch (error) {
      console.error("Failed to fetch client pricing:", error);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/portal/me", { credentials: "include" });
        if (!response.ok) {
          setUser(null);
          setClientType("public");
          setClientPricing([]);
          return;
        }
        const data = (await response.json()) as { user?: PortalUser };
        if (!data.user) throw new Error("Portal session did not return a user");
        setUser(data.user);
        localStorage.setItem(PORTAL_USER_KEY, JSON.stringify(data.user));
        await Promise.all([fetchClientInfo(), fetchClientPricing()]);
      } catch (error) {
        console.error("Failed to initialize store auth:", error);
        setUser(null);
        setClientType("public");
        setClientPricing([]);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    const handleFocus = () => void initAuth();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchClientInfo, fetchClientPricing]);

  const loginRedirect = useCallback(() => {
    const currentPath = window.location.pathname;
    localStorage.setItem("storeRedirectAfterLogin", currentPath);
    window.location.href = portalLoginWithReturn(currentPath);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/portal/logout", { method: "POST", credentials: "include" });
    } catch {
      // Local UI still returns to public state; the cookie expires server-side.
    }
    localStorage.removeItem(PORTAL_USER_KEY);
    setUser(null);
    setClientType("public");
    setClientPricing([]);
  }, []);

  const refreshPricing = useCallback(async () => {
    if (user) {
      await fetchClientPricing();
    }
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
      return {
        price: basePrice,
        hasDiscount: false,
        discountPercent: 0,
      };
    },
    [clientPricing]
  );

  const isLoggedIn = useMemo(() => !!user, [user]);
  const clientId = useMemo(() => user?.clientId || null, [user]);
  
  // Derive store role from user data - defaults to 'public' for unauthenticated
  const storeRole: StoreRole = useMemo(() => {
    if (!user) return 'public';
    return user.storeRole || 'prospect';
  }, [user]);
  
  // Check if user can purchase (comanaged or admin only)
  const canPurchase = useMemo(() => {
    return storeRole === 'comanaged' || storeRole === 'admin';
  }, [storeRole]);
  
  // Check if user is admin
  const isAdmin = useMemo(() => storeRole === 'admin', [storeRole]);

  return {
    isLoggedIn,
    isLoading,
    user,
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
