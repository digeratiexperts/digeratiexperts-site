import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
  type CSSProperties,
} from "react";
import type { StoreProduct, PricingType } from "@/data/storeProducts";
import { storeProducts } from "@/data/storeProducts";
import { computeSolutionSnapshot, type SolutionSnapshot, type SolutionTotals } from "@shared/storeCommerce";
import { analytics } from "@/lib/analytics";

export interface CartItem {
  product: StoreProduct;
  quantity: number;
  clientPrice?: number;
  originalPrice: number;
  hasClientDiscount: boolean;
}

interface ClientPricing {
  productId: string;
  customPrice: number;
  discountPercent: number;
}

interface CartContextType {
  items: CartItem[];
  savedForLater: CartItem[];
  addToCart: (product: StoreProduct, quantity?: number, clientPrice?: number) => void;
  removeFromCart: (productId: string) => void;
  undoRemove: () => void;
  canUndoRemove: boolean;
  updateQuantity: (productId: string, quantity: number) => void;
  saveForLater: (productId: string) => void;
  moveToSolution: (productId: string) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getOriginalTotal: () => number;
  getSavings: () => number;
  getItemCount: () => number;
  snapshot: SolutionSnapshot;
  totals: SolutionTotals;
  lastUpdated: string | null;
  solutionId: string | null;
  announcement: string;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  setClientPricing: (pricing: ClientPricing[]) => void;
  getItemPrice: (productId: string) => { price: number; hasDiscount: boolean };
  panelTheme: "dark" | "light";
  togglePanelTheme: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "digerati-store-cart";
const SESSION_KEY = "digerati-store-session";
const SAVED_KEY = "digerati-store-saved";
const PANEL_THEME_KEY = "digerati-store-panel-theme";

function readStoredPanelTheme(): "dark" | "light" {
  try {
    return localStorage.getItem(PANEL_THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

const PANEL_THEME_STYLES: Record<"dark" | "light", CSSProperties> = {
  dark: {
    "--dp-panel-bg": "#0a0a0a",
    "--dp-card-bg": "rgb(255 255 255 / 0.03)",
    "--dp-tint-bg": "rgb(255 255 255 / 0.10)",
    "--dp-hover-bg": "rgb(255 255 255 / 0.08)",
    "--dp-border-10": "rgb(255 255 255 / 0.10)",
    "--dp-border-15": "rgb(255 255 255 / 0.15)",
    "--dp-border-20": "rgb(255 255 255 / 0.20)",
    "--dp-border-25": "rgb(255 255 255 / 0.25)",
    "--dp-text-primary": "#ffffff",
    "--dp-text-hover": "#ffffff",
    "--dp-text-80": "rgb(255 255 255 / 0.80)",
    "--dp-text-75": "rgb(255 255 255 / 0.75)",
    "--dp-text-70": "rgb(255 255 255 / 0.70)",
    "--dp-text-65": "rgb(255 255 255 / 0.65)",
    "--dp-text-60": "rgb(255 255 255 / 0.60)",
    "--dp-text-55": "rgb(255 255 255 / 0.55)",
    "--dp-text-50": "rgb(255 255 255 / 0.50)",
    "--dp-text-45": "rgb(255 255 255 / 0.45)",
    "--dp-text-40": "rgb(255 255 255 / 0.40)",
    "--dp-text-35": "rgb(255 255 255 / 0.35)",
    "--dp-danger": "#fca5a5",
    "--dp-danger-hover-bg": "rgb(239 68 68 / 0.10)",
    "--dp-warn-border": "rgb(251 191 36 / 0.25)",
    "--dp-warn-bg": "rgb(251 191 36 / 0.05)",
    "--dp-warn-text": "#fde68a",
    "--dp-success": "#34d399",
  } as CSSProperties,
  light: {
    "--dp-panel-bg": "#ffffff",
    "--dp-card-bg": "#f8fafc",
    "--dp-tint-bg": "#f1f5f9",
    "--dp-hover-bg": "#f1f5f9",
    "--dp-border-10": "#e2e8f0",
    "--dp-border-15": "#cbd5e1",
    "--dp-border-20": "#cbd5e1",
    "--dp-border-25": "#cbd5e1",
    "--dp-text-primary": "#0f172a",
    "--dp-text-hover": "#0f172a",
    "--dp-text-80": "#334155",
    "--dp-text-75": "#475569",
    "--dp-text-70": "#475569",
    "--dp-text-65": "#475569",
    "--dp-text-60": "#64748b",
    "--dp-text-55": "#64748b",
    "--dp-text-50": "#64748b",
    "--dp-text-45": "#94a3b8",
    "--dp-text-40": "#94a3b8",
    "--dp-text-35": "#94a3b8",
    "--dp-danger": "#dc2626",
    "--dp-danger-hover-bg": "#fef2f2",
    "--dp-warn-border": "#fde68a",
    "--dp-warn-bg": "#fffbeb",
    "--dp-warn-text": "#b45309",
    "--dp-success": "#059669",
  } as CSSProperties,
};

export function getPanelThemeStyle(theme: "dark" | "light"): CSSProperties {
  return PANEL_THEME_STYLES[theme];
}

const isRecurringPricing = (pricingType: PricingType): boolean => {
  return ["monthly", "yearly", "per_user", "per_endpoint", "per_device", "per_location", "per_seat"].includes(pricingType);
};

function readOrCreateSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return `anon-${Date.now()}`;
  }
}

function migrateItems(parsed: unknown): CartItem[] {
  if (!Array.isArray(parsed)) return [];
  const results: CartItem[] = [];
  for (const item of parsed) {
    const product = storeProducts.find((candidate) => candidate.id === item?.product?.id);
    if (!product) continue;
    results.push({
      product,
      quantity: Math.max(product.minimumQuantity, Number(item.quantity) || product.minimumQuantity),
      originalPrice: item.originalPrice ?? product.basePrice,
      hasClientDiscount: item.hasClientDiscount ?? false,
      clientPrice: item.clientPrice,
    });
  }
  return results;
}

function snapshotFromItems(items: CartItem[]): SolutionSnapshot {
  return computeSolutionSnapshot(
    items.map((item) => ({ productId: item.product.id, sku: item.product.sku, quantity: item.quantity })),
    storeProducts,
  );
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [savedForLater, setSavedForLater] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [clientPricingMap, setClientPricingMap] = useState<Map<string, ClientPricing>>(new Map());
  const [lastRemoved, setLastRemoved] = useState<CartItem | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [solutionId, setSolutionId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [panelTheme, setPanelTheme] = useState<"dark" | "light">(readStoredPanelTheme);
  const [syncReady, setSyncReady] = useState(false);
  const sessionIdRef = useRef("");
  const solutionIdRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);
  const persistTimer = useRef<number | null>(null);
  const lastClaimedUserRef = useRef<string | null>(null);

  const announce = useCallback((message: string) => {
    setAnnouncement(message);
  }, []);

  useEffect(() => {
    sessionIdRef.current = readOrCreateSessionId();
    try {
      setItems(migrateItems(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]")));
      setSavedForLater(migrateItems(JSON.parse(localStorage.getItem(SAVED_KEY) || "[]")));
    } catch (error) {
      console.error("Failed to load solution from localStorage:", error);
    }

    const sessionId = sessionIdRef.current;
    void fetch(`/api/store/solutions/current?sessionId=${encodeURIComponent(sessionId)}`, {
      credentials: "include",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const remote = payload?.solution;
        if (!remote?.items) return;
        setSolutionId(remote.id);
        solutionIdRef.current = remote.id;
        setLastUpdated(remote.updatedAt || new Date().toISOString());
        setItems((local) => {
          if (local.length === 0 && Array.isArray(remote.items) && remote.items.length > 0) {
            return migrateItems(
              remote.items.map((line: { productId: string; quantity: number }) => ({
                product: storeProducts.find((product) => product.id === line.productId),
                quantity: line.quantity,
              })),
            );
          }
          return local;
        });
      })
      .catch(() => {
        /* localStorage remains the offline cache */
      })
      .finally(() => {
        hydratedRef.current = true;
        setSyncReady(true);
      });
  }, []);

  useEffect(() => {
    if (!hydratedRef.current && items.length === 0) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      localStorage.setItem(SAVED_KEY, JSON.stringify(savedForLater));
    } catch (error) {
      console.error("Failed to save solution locally:", error);
    }
  }, [items, savedForLater]);

  const persistRemote = useCallback((nextItems: CartItem[], nextSaved: CartItem[]) => {
    if (!hydratedRef.current || !sessionIdRef.current) return;
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      void fetch("/api/store/solutions/current", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: solutionIdRef.current,
          sessionId: sessionIdRef.current,
          items: nextItems.map((item) => ({
            productId: item.product.id,
            sku: item.product.sku,
            quantity: item.quantity,
          })),
          savedForLater: nextSaved.map((item) => ({
            productId: item.product.id,
            sku: item.product.sku,
            quantity: item.quantity,
          })),
        }),
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          if (payload?.solution?.id) {
            setSolutionId(payload.solution.id);
            solutionIdRef.current = payload.solution.id;
          }
          setLastUpdated(payload?.solution?.updatedAt || new Date().toISOString());
        })
        .catch(() => {
          setLastUpdated(new Date().toISOString());
        });
    }, 400);
  }, []);

  useEffect(() => {
    if (!syncReady) return;
    persistRemote(items, savedForLater);
  }, [items, savedForLater, persistRemote, syncReady]);

  useEffect(() => {
    const claimIfLoggedIn = async () => {
      if (!sessionIdRef.current) return;
      try {
        const me = await fetch("/api/portal/me", { credentials: "include", cache: "no-store" });
        if (!me.ok) {
          lastClaimedUserRef.current = null;
          return;
        }
        const data = await me.json().catch(() => ({}));
        const userId = data?.user?.id || data?.user?.email || "portal-user";
        if (userId === lastClaimedUserRef.current) return;
        lastClaimedUserRef.current = userId;
        await fetch("/api/store/solutions/claim", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionIdRef.current }),
        });
      } catch {
        /* guest solution stays local until auth is valid */
      }
    };
    void claimIfLoggedIn();
    const claim = () => void claimIfLoggedIn();
    window.addEventListener("focus", claim);
    window.addEventListener("storage", claim);
    window.addEventListener("de-portal-auth-changed", claim);
    return () => {
      window.removeEventListener("focus", claim);
      window.removeEventListener("storage", claim);
      window.removeEventListener("de-portal-auth-changed", claim);
    };
  }, []);

  const setClientPricing = useCallback((pricing: ClientPricing[]) => {
    const map = new Map<string, ClientPricing>();
    pricing.forEach((entry) => map.set(entry.productId, entry));
    setClientPricingMap(map);
  }, []);

  const getItemPrice = useCallback(
    (productId: string): { price: number; hasDiscount: boolean } => {
      const pricing = clientPricingMap.get(productId);
      if (pricing) return { price: pricing.customPrice, hasDiscount: true };
      const item = items.find((entry) => entry.product.id === productId);
      return { price: item?.product.basePrice || 0, hasDiscount: false };
    },
    [clientPricingMap, items],
  );

  const addToCart = useCallback((product: StoreProduct, quantity: number = 1, clientPrice?: number) => {
    if (product.isContractOnly || !product.isCheckoutEnabled) return;

    const pricing = clientPricingMap.get(product.id);
    const effectiveClientPrice = clientPrice ?? pricing?.customPrice;
    const hasDiscount = !!effectiveClientPrice && effectiveClientPrice < product.basePrice;

    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + quantity,
                clientPrice: effectiveClientPrice,
                hasClientDiscount: hasDiscount,
              }
            : item,
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: Math.max(quantity, product.minimumQuantity),
          clientPrice: effectiveClientPrice,
          originalPrice: product.basePrice,
          hasClientDiscount: hasDiscount,
        },
      ];
    });
    setSavedForLater((prev) => prev.filter((item) => item.product.id !== product.id));
    announce(`${product.name} added to your solution`);
    analytics.storeAddToCart(product.name, product.basePrice, product.id);
  }, [announce, clientPricingMap]);

  const removeFromCart = useCallback((productId: string) => {
    setItems((prev) => {
      const removed = prev.find((item) => item.product.id === productId) || null;
      setLastRemoved(removed);
      if (removed) {
        announce(`${removed.product.name} removed. Undo available.`);
        analytics.storeRemoveFromCart(removed.product.name, removed.product.id);
      }
      return prev.filter((item) => item.product.id !== productId);
    });
  }, [announce]);

  const undoRemove = useCallback(() => {
    if (!lastRemoved) return;
    setItems((prev) => {
      if (prev.some((item) => item.product.id === lastRemoved.product.id)) return prev;
      return [...prev, lastRemoved];
    });
    announce(`${lastRemoved.product.name} restored`);
    setLastRemoved(null);
  }, [announce, lastRemoved]);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const next = Number.isFinite(quantity) ? quantity : item.quantity;
        return { ...item, quantity: Math.max(next, item.product.minimumQuantity) };
      }),
    );
  }, []);

  const saveForLater = useCallback((productId: string) => {
    setItems((prev) => {
      const item = prev.find((entry) => entry.product.id === productId);
      if (item) {
        setSavedForLater((saved) =>
          saved.some((entry) => entry.product.id === productId) ? saved : [...saved, item],
        );
        announce(`${item.product.name} saved for later`);
      }
      return prev.filter((entry) => entry.product.id !== productId);
    });
  }, [announce]);

  const moveToSolution = useCallback((productId: string) => {
    setSavedForLater((prev) => {
      const item = prev.find((entry) => entry.product.id === productId);
      if (item) {
        setItems((current) =>
          current.some((entry) => entry.product.id === productId) ? current : [...current, item],
        );
        announce(`${item.product.name} moved back to your solution`);
      }
      return prev.filter((entry) => entry.product.id !== productId);
    });
  }, [announce]);

  const clearCart = useCallback(() => {
    setItems([]);
    setLastRemoved(null);
    announce("Solution cleared");
  }, [announce]);

  const getCartTotal = useCallback(() => {
    return items.reduce((total, item) => {
      const price = item.clientPrice ?? item.product.basePrice;
      return total + price * item.quantity;
    }, 0);
  }, [items]);

  const getOriginalTotal = useCallback(() => {
    return items.reduce((total, item) => total + item.originalPrice * item.quantity, 0);
  }, [items]);

  const getSavings = useCallback(() => getOriginalTotal() - getCartTotal(), [getOriginalTotal, getCartTotal]);

  const getItemCount = useCallback(
    () => items.reduce((count, item) => count + item.quantity, 0),
    [items],
  );

  const snapshot = snapshotFromItems(items);
  const totals = snapshot.totals;

  const openCart = useCallback(() => {
    setIsOpen(true);
    analytics.storeViewCart(getCartTotal(), getItemCount());
  }, [getCartTotal, getItemCount]);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const toggleCart = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) analytics.storeViewCart(getCartTotal(), getItemCount());
      return !prev;
    });
  }, [getCartTotal, getItemCount]);

  const togglePanelTheme = useCallback(() => {
    setPanelTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(PANEL_THEME_KEY, next);
      } catch {
        // best-effort persistence only
      }
      return next;
    });
  }, []);

  return (
    <CartContext.Provider
      value={{
        items,
        savedForLater,
        addToCart,
        removeFromCart,
        undoRemove,
        canUndoRemove: !!lastRemoved,
        updateQuantity,
        saveForLater,
        moveToSolution,
        clearCart,
        getCartTotal,
        getOriginalTotal,
        getSavings,
        getItemCount,
        snapshot,
        totals,
        lastUpdated,
        solutionId,
        announcement,
        isOpen,
        openCart,
        closeCart,
        toggleCart,
        panelTheme,
        togglePanelTheme,
        setClientPricing,
        getItemPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}

export { isRecurringPricing };
