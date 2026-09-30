import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";

export function CartButton() {
  const { getItemCount, toggleCart } = useCart();
  const itemCount = getItemCount();
  const prefersReducedMotion = useReducedMotion();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-11 w-11 text-white/70 hover:bg-white/10 hover:text-white"
      onClick={toggleCart}
      data-testid="button-cart"
      aria-label={`Warehouse cart with ${itemCount} services`}
      title="Warehouse cart"
    >
      <Layers className="h-5 w-5" />
      <AnimatePresence>
        {itemCount > 0 && (
          <motion.span
            key={itemCount}
            initial={prefersReducedMotion ? false : { scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { scale: 0.7, opacity: 0 }}
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-de-accent px-1 text-xs font-medium text-white"
            data-testid="cart-item-count"
          >
            {itemCount > 99 ? "99+" : itemCount}
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );
}

export default CartButton;
