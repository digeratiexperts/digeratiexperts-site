import { useRef, type FormEvent, type ReactNode } from "react";
import { Link } from "wouter";
import { ChevronRight, Heart, Loader2, Paperclip, ShoppingCart, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Callout } from "@/components/portal/ui";
import { PORTAL_TICKET_ACCEPT } from "@shared/portalTicketFileRules";
import type { RequiredChip, ServiceRequestType } from "@shared/serviceRequests";
import { readFavorites, useFavorites } from "./favorites";

/**
 * Catalog item page frame shared by every service request form: card header
 * with favourite, glyph + description, "* Indicates required", the form, an
 * "Add attachments" link, and a sticky right rail (Add to Cart / Order Now +
 * one chip per unfilled required field). Under lg the rail becomes a chip
 * summary above the form and a fixed action bar at the bottom.
 */

export function isFavoriteRequest(type: ServiceRequestType): boolean {
  return typeof window !== "undefined" && readFavorites().includes(type);
}

export interface ServiceRequestShellProps {
  type: ServiceRequestType;
  title: string;
  subtitle: string;
  description: string;
  icon: ReactNode;
  chips: RequiredChip[];
  onChipClick: (field: string) => void;
  onOrderNow: () => void;
  onAddToCart: () => void;
  busy: false | "submit" | "basket";
  basketCount: number;
  files: File[];
  onAddFiles: (files: FileList) => void;
  onRemoveFile: (index: number) => void;
  fileError: string | null;
  formError: string | null;
  announcement: string;
  children: ReactNode;
}

function Chips({ chips, onChipClick, className }: { chips: RequiredChip[]; onChipClick: (f: string) => void; className?: string }) {
  if (!chips.length) {
    return <p className={cn("text-xs text-muted-foreground", className)}>All required information is filled in.</p>;
  }
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Required information still needed">
      {chips.map((c) => (
        <li key={c.field}>
          <button
            type="button"
            onClick={() => onChipClick(c.field)}
            className="rounded-[3px] bg-[hsl(var(--sidebar-background))] px-2.5 py-1 text-left text-xs font-semibold leading-tight text-white shadow-sm ring-1 ring-white/10 hover:bg-[hsl(var(--sidebar-accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {c.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ServiceRequestShell(props: ServiceRequestShellProps) {
  const { type, chips, busy } = props;
  const { isFavorite, toggle } = useFavorites();
  const favorite = isFavorite(type);
  const fileInput = useRef<HTMLInputElement>(null);

  const toggleFavorite = () => toggle(type);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    props.onOrderNow();
  };

  const actions = (layout: "rail" | "bar") => (
    <div className={cn(layout === "rail" ? "space-y-3" : "grid grid-cols-2 gap-2")}>
      <button
        type="button"
        onClick={props.onAddToCart}
        disabled={Boolean(busy)}
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        {busy === "basket" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShoppingCart className="h-4 w-4" aria-hidden="true" />}
        Add to Cart
      </button>
      <button
        type="submit"
        form="service-request-form"
        disabled={Boolean(busy)}
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
      >
        {busy === "submit" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Order Now
      </button>
    </div>
  );

  return (
    <div className="pb-28 lg:pb-8">
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm">
          <li>
            <Link href="/portal/dashboard" className="text-[hsl(var(--primary))] hover:underline">
              Home
            </Link>
          </li>
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <li>
            <Link href="/portal/requests" className="text-[hsl(var(--primary))] hover:underline">
              Request Services
            </Link>
          </li>
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <li>
            <Link href="/portal/requests#computers" className="text-[hsl(var(--primary))] hover:underline">
              Computers
            </Link>
          </li>
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <li aria-current="page" className="font-semibold text-foreground">
            {props.title}
          </li>
        </ol>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] xl:grid-cols-[minmax(0,1fr)_18.5rem]">
        <article className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm" aria-labelledby="sr-title">
          <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h1 id="sr-title" className="text-xl font-semibold text-foreground sm:text-2xl">
                {props.title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{props.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={toggleFavorite}
              aria-pressed={favorite}
              aria-label={favorite ? `Remove ${props.title} from favourites` : `Add ${props.title} to favourites`}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[hsl(var(--primary))] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Heart className={cn("h-5 w-5", favorite && "fill-current")} aria-hidden="true" />
            </button>
          </header>

          <div className="flex flex-col items-center gap-5 border-b border-border px-5 py-6 sm:flex-row sm:items-start sm:gap-10 sm:px-8">
            <div className="flex w-36 shrink-0 justify-center text-foreground/75 sm:w-48">{props.icon}</div>
            <p className="max-w-xl text-sm leading-relaxed text-foreground sm:pt-2">{props.description}</p>
          </div>

          <div className="space-y-5 px-5 py-6 sm:px-6">
            <div className="lg:hidden">
              <p className="mb-2 text-sm font-medium text-foreground">Required information</p>
              <Chips chips={chips} onChipClick={props.onChipClick} />
            </div>

            <p className="text-sm text-foreground">
              <span className="mr-1 text-destructive" aria-hidden="true">
                *
              </span>
              Indicates required
            </p>

            {props.formError && (
              <Callout tone="bad" title="The request wasn't sent">
                {props.formError}
              </Callout>
            )}

            <form id="service-request-form" noValidate onSubmit={onSubmit} className="space-y-5" aria-describedby="sr-title">
              {props.children}
            </form>

            <div className="flex flex-col items-end gap-2 border-t border-border pt-4">
              <input
                ref={fileInput}
                type="file"
                multiple
                accept={PORTAL_TICKET_ACCEPT}
                className="sr-only"
                id="sr-attachments"
                onChange={(e) => {
                  if (e.target.files?.length) props.onAddFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-[hsl(var(--primary))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0"
              >
                <Paperclip className="h-4 w-4" aria-hidden="true" />
                Add attachments
              </button>
              {props.fileError && <p className="text-xs font-medium text-destructive">{props.fileError}</p>}
              {props.files.length > 0 && (
                <ul className="w-full space-y-1" aria-label="Attachments to upload">
                  {props.files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-1.5 text-sm">
                      <span className="min-w-0 truncate">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => props.onRemoveFile(i)}
                        aria-label={`Remove ${f.name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </article>

        <aside className="hidden lg:block" aria-label="Order">
          <div className="sticky top-20 space-y-5">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">{actions("rail")}</div>
            <div className="border-t border-border pt-4">
              <h2 className="mb-2 text-sm font-medium text-foreground">Required information</h2>
              <Chips chips={chips} onChipClick={props.onChipClick} />
            </div>
            {props.basketCount > 0 && (
              <Link href="/portal/requests/basket" className="block text-sm font-medium text-[hsl(var(--primary))] hover:underline">
                Request basket ({props.basketCount})
              </Link>
            )}
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.12)] backdrop-blur lg:hidden">
        {props.basketCount > 0 && (
          <Link href="/portal/requests/basket" className="mb-2 block text-center text-xs font-medium text-[hsl(var(--primary))]">
            Request basket ({props.basketCount})
          </Link>
        )}
        {actions("bar")}
      </div>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {props.announcement}
      </div>
    </div>
  );
}
