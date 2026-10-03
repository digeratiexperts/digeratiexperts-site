import { lazy, Suspense, type ReactNode } from "react";
import { Route, Switch } from "wouter";
import { Helmet } from "react-helmet-async";
import { CartProvider } from "@/contexts/CartContext";
import { ShoppingCart } from "@/components/store/ShoppingCart";
import { SolutionMobileBar } from "@/components/store/SolutionMobileBar";
import { PageLoadingSkeleton } from "@/components/LoadingSkeleton";
import { WAREHOUSE_BASE } from "@/lib/warehousePaths";
import { WarehouseShell } from "./WarehouseShell";
import { WarehouseStockPanel } from "@/pages/store/WarehouseStockPanel";

const WarehouseHome = lazy(() => import("./WarehouseHome"));
const WarehouseHubCatalog = lazy(() => import("./WarehouseHubCatalog"));
const WarehouseVendors = lazy(() => import("./WarehouseVendors"));
const ManagedStore = lazy(() => import("@/pages/store/ManagedStore"));
const CoManagedStore = lazy(() => import("@/pages/store/CoManagedStore"));
const ProductDetail = lazy(() => import("@/pages/store/ProductDetail"));
const Checkout = lazy(() => import("@/pages/store/Checkout"));
const OrderConfirmation = lazy(() => import("@/pages/store/OrderConfirmation"));
const QuoteRequestPage = lazy(() => import("@/pages/store/QuoteRequest"));
const QuoteConfirmationPage = lazy(() => import("@/pages/store/QuoteConfirmation"));

function Screen({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoadingSkeleton />}>{children}</Suspense>;
}

export default function WarehouseApp() {
  return (
    <CartProvider>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <ShoppingCart />
      <SolutionMobileBar />
      <WarehouseShell>
        <WarehouseStockPanel />
        <Switch>
          <Route path={WAREHOUSE_BASE}>
            <Screen>
              <WarehouseHome />
            </Screen>
          </Route>
          <Route path={`${WAREHOUSE_BASE}/hub-catalog`}>
            <Screen>
              <WarehouseHubCatalog />
            </Screen>
          </Route>
          <Route path={`${WAREHOUSE_BASE}/vendors`}>
            <Screen>
              <WarehouseVendors />
            </Screen>
          </Route>
          <Route path={`${WAREHOUSE_BASE}/managed`}>
            <Screen>
              <ManagedStore />
            </Screen>
          </Route>
          <Route path={`${WAREHOUSE_BASE}/co-managed`}>
            <Screen>
              <CoManagedStore />
            </Screen>
          </Route>
          <Route path={`${WAREHOUSE_BASE}/product/:sku`}>
            <Screen>
              <ProductDetail />
            </Screen>
          </Route>
          <Route path={`${WAREHOUSE_BASE}/checkout`}>
            <Screen>
              <Checkout />
            </Screen>
          </Route>
          <Route path={`${WAREHOUSE_BASE}/order-confirmation`}>
            <Screen>
              <OrderConfirmation />
            </Screen>
          </Route>
          <Route path={`${WAREHOUSE_BASE}/quote-request`}>
            <Screen>
              <QuoteRequestPage />
            </Screen>
          </Route>
          <Route path={`${WAREHOUSE_BASE}/quote-confirmation/:id`}>
            <Screen>
              <QuoteConfirmationPage />
            </Screen>
          </Route>
        </Switch>
      </WarehouseShell>
    </CartProvider>
  );
}
