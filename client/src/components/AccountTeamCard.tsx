import { Mail, Phone } from "lucide-react";
import { accountTeamFor, type AccountTeam } from "@shared/accountManagers";

/**
 * "Your account team": the prospect/client's assigned account manager (photo,
 * title, direct contact) plus the sales department. `team` comes from the API
 * (resolved server-side from portal_clients.account_manager); without it the
 * default team is shown.
 *
 * tone="store" sits on the dark Store pages; tone="portal" uses portal tokens.
 */
export function AccountTeamCard({
  team,
  tone = "portal",
  stacked = false,
  className = "",
}: {
  team?: AccountTeam | null;
  tone?: "store" | "portal";
  /** Narrow containers (sidebars): manager above sales, never side by side. */
  stacked?: boolean;
  className?: string;
}) {
  const { manager, sales } = team ?? accountTeamFor(null);
  const store = tone === "store";
  const muted = store ? "text-white/60" : "text-muted-foreground";
  const strong = store ? "text-white" : "text-foreground";
  const link = store
    ? "text-white/80 hover:text-de-accent-ink transition-colors"
    : "pt-link hover:underline";
  const divider = store ? "border-white/10" : "border-border";

  return (
    <div
      className={`grid gap-5 ${stacked ? "" : "sm:grid-cols-[minmax(0,1fr)_auto]"} ${className}`}
      data-testid="account-team"
    >
      <div className="flex items-start gap-4 min-w-0">
        <picture className="shrink-0">
          <source srcSet={manager.photo.webp} type="image/webp" />
          <img
            src={manager.photo.jpg}
            alt={manager.photo.alt}
            width={64}
            height={64}
            loading="lazy"
            decoding="async"
            className="h-16 w-16 rounded-full object-cover"
          />
        </picture>
        <div className="min-w-0 text-sm">
          <p className={`text-xs uppercase tracking-wide ${muted}`}>Your account manager</p>
          <p className={`font-semibold ${strong}`} data-testid="account-manager-name">{manager.name}</p>
          <p className={`mb-2 ${muted}`}>{manager.title}</p>
          <a href={`mailto:${manager.email}`} className={`flex items-center gap-2 break-all ${link}`} data-testid="account-manager-email">
            <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
            {manager.email}
          </a>
          <a href={manager.phoneHref} className={`mt-1 flex items-center gap-2 ${link}`} data-testid="account-manager-phone">
            <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
            {manager.phoneDisplay}
          </a>
        </div>
      </div>
      <div className={`text-sm border-t pt-4 ${stacked ? "" : "sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5"} ${divider}`}>
        <p className={`text-xs uppercase tracking-wide ${muted}`}>{sales.name}</p>
        <a href={`mailto:${sales.email}`} className={`mt-2 flex items-center gap-2 break-all ${link}`} data-testid="sales-email">
          <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
          {sales.email}
        </a>
        <a href={sales.phoneHref} className={`mt-1 flex items-center gap-2 ${link}`} data-testid="sales-phone">
          <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
          {sales.phoneDisplay}
        </a>
      </div>
    </div>
  );
}
