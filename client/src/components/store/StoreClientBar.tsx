import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CartButton } from "@/components/store/CartButton";
import { useStoreAuth } from "@/hooks/useStoreAuth";

/**
 * Quiet store utility row. Electric stays the store accent;
 * the button is outline so it does not compete with hero CTAs.
 */
export function StoreClientBar({ staff = false }: { staff?: boolean }) {
  const { isLoggedIn, user, clientType, logout, loginRedirect } = useStoreAuth();

  return (
    <div className="mb-6 flex items-center justify-between gap-3">
      {isLoggedIn && user ? (
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="flex min-w-0 items-center gap-2 rounded-lg border border-de-accent/20 bg-de-accent/10 px-3 py-2">
            <User className="h-4 w-4 shrink-0 text-de-accent-ink" />
            <span className="truncate text-sm text-white" data-testid="text-user-greeting">
              {staff ? "Staff session, " : "Welcome, "}
              <span className="font-semibold text-de-accent-ink">{user.fullName || user.username}</span>
            </span>
            {clientType !== "public" && !staff ? (
              <span className="ml-1 hidden rounded-full bg-de-accent/20 px-2 py-0.5 text-xs font-medium text-de-accent-ink sm:inline">
                {clientType === "managed" ? "Managed Client" : "Co-Managed Client"}
              </span>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="shrink-0 text-white/60 hover:bg-de-accent/10 hover:text-white"
            data-testid="button-store-logout"
          >
            <LogOut className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={loginRedirect}
          className="h-11 border-de-accent/40 bg-transparent px-3 text-sm text-de-accent-ink hover:border-de-accent hover:bg-de-accent/10 sm:px-4 sm:text-base"
          data-testid="button-store-login"
        >
          <User className="mr-2 h-4 w-4" />
          <span className="sm:hidden">{staff ? "Staff login" : "Client login"}</span>
          <span className="hidden sm:inline">{staff ? "Staff Portal login" : "Login for Client Pricing"}</span>
        </Button>
      )}
      <CartButton />
    </div>
  );
}
