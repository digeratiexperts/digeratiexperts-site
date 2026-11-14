import { useEffect, useState, type ReactNode } from "react";
import { MegaMenu } from "@/components/MegaMenu";
import { StorePageAtmosphere } from "@/components/store/StorePageAtmosphere";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import { useSEO } from "@/hooks/useSEO";
import NotFound from "@/pages/not-found";
import { loadDeStoreStatus, type DeStoreStatus } from "@/lib/deStoreApi";

export function DeStoreShell({
  title,
  description,
  canonical,
  children,
}: {
  title: string;
  description: string;
  canonical: string;
  children: (status: DeStoreStatus) => ReactNode;
}) {
  const [status, setStatus] = useState<DeStoreStatus | null | undefined>(undefined);
  useSEO({ title, description, canonical, noIndex: true });

  useEffect(() => {
    let cancelled = false;
    loadDeStoreStatus()
      .then((value) => {
        if (!cancelled) setStatus(value);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === undefined) {
    return (
      <div className="relative min-h-screen bg-black text-white" data-accent="electric">
        <StorePageAtmosphere intensity={0.28} />
        <MegaMenu />
        <main className="relative mx-auto max-w-7xl px-5 pb-24 pt-[calc(var(--de-nav-offset)+1.5rem)] sm:px-8">
          <p className="text-de-muted">Loading the Digerati Experts store.</p>
        </main>
      </div>
    );
  }

  if (!status) return <NotFound />;

  return (
    <div className="relative min-h-screen bg-black text-white" data-accent="electric">
      <StorePageAtmosphere intensity={0.32} />
      <MegaMenu />
      <main className="relative mx-auto max-w-7xl px-5 pb-32 pt-[calc(var(--de-nav-offset)+1.5rem)] sm:px-8 lg:pb-24">
        {children(status)}
      </main>
      <DigeratiEnhancedFooterSection />
    </div>
  );
}
