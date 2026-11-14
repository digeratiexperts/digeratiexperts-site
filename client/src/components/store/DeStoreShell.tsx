import { useEffect, useState, type ReactNode } from "react";
import { MegaMenu } from "@/components/MegaMenu";
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
      <div className="min-h-screen bg-black text-white">
        <MegaMenu />
        <main className="mx-auto max-w-5xl px-6 py-24">
          <p className="text-de-muted">Loading the Digerati Experts store.</p>
        </main>
      </div>
    );
  }

  if (!status) return <NotFound />;

  return (
    <div className="min-h-screen bg-black text-white">
      <MegaMenu />
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-16 sm:px-8">{children(status)}</main>
      <DigeratiEnhancedFooterSection />
    </div>
  );
}
