import { MapPin } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { AddressSuggestion, AddressSuggestResponse } from "@shared/addressLookup";

/**
 * Address type-ahead for any street-address input (Store checkout, portal
 * request forms). Suggestions come from GET /api/address/suggest
 * (server/addressLookup.ts, Geoapify); picking one fills the street, city,
 * state and ZIP through `onSelect`.
 *
 * It wraps the form's own input through a render prop, so react-hook-form
 * `register()` and controlled inputs keep their handlers: the wrapper listens
 * to the input's bubbling input / keydown / focusout events, and the render
 * prop only adds the ARIA combobox attributes.
 *
 * Keyboard: Down / Up move through the list, Enter picks, Escape closes.
 * When the server has no key it answers { enabled: false } and this becomes a
 * plain input for the rest of the page view.
 */

const MIN_QUERY = 4;
const DEBOUNCE_MS = 250;

/** Per page view: once the server says the lookup is off, stop asking. */
let lookupDisabled = false;

export interface AddressComboboxProps {
  role: "combobox";
  "aria-autocomplete": "list";
  "aria-expanded": boolean;
  "aria-controls": string;
  "aria-activedescendant"?: string;
}

export function AddressAutocomplete({
  country = "us",
  onSelect,
  children,
  listClassName = "border-border bg-popover text-popover-foreground",
  activeClassName = "bg-accent text-accent-foreground",
}: {
  /** ISO 3166-1 alpha-2, lower case. null switches the lookup off (e.g. "Other" country). */
  country?: string | null;
  onSelect: (suggestion: AddressSuggestion) => void;
  children: (comboboxProps: AddressComboboxProps) => ReactNode;
  listClassName?: string;
  activeClassName?: string;
}) {
  const listId = useId();
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const wrapper = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setActive(-1);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      request.current?.abort();
    },
    [],
  );

  const lookup = useCallback(
    (q: string) => {
      if (timer.current) clearTimeout(timer.current);
      request.current?.abort();
      if (lookupDisabled || !country || q.trim().length < MIN_QUERY) {
        setSuggestions([]);
        close();
        return;
      }
      timer.current = setTimeout(async () => {
        const ctrl = new AbortController();
        request.current = ctrl;
        try {
          const res = await fetch(`/api/address/suggest?q=${encodeURIComponent(q.trim())}&country=${country}`, {
            signal: ctrl.signal,
          });
          if (!res.ok) return;
          const data = (await res.json()) as AddressSuggestResponse;
          if (!data.enabled) {
            lookupDisabled = true;
            return;
          }
          setSuggestions(data.suggestions);
          setActive(-1);
          setOpen(data.suggestions.length > 0);
        } catch {
          // Aborted or offline: the field still works as a plain input.
        }
      }, DEBOUNCE_MS);
    },
    [country, close],
  );

  const pick = (s: AddressSuggestion) => {
    onSelect(s);
    setSuggestions([]);
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(suggestions[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  const optionId = (i: number) => `${listId}-opt-${i}`;

  return (
    <div
      ref={wrapper}
      className="relative"
      onInput={(e) => {
        const target = e.target as HTMLInputElement;
        if (target.getAttribute("role") === "combobox") lookup(target.value);
      }}
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        if (!wrapper.current?.contains(e.relatedTarget as Node | null)) close();
      }}
    >
      {children({
        role: "combobox",
        "aria-autocomplete": "list",
        "aria-expanded": open,
        "aria-controls": listId,
        "aria-activedescendant": open && active >= 0 ? optionId(active) : undefined,
      })}
      <div
        className={`absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border shadow-lg ${listClassName} ${open ? "" : "hidden"}`}
        data-testid="address-suggestions"
      >
        <ul id={listId} role="listbox" aria-label="Address suggestions" className="max-h-72 overflow-auto py-1">
          {suggestions.map((s, i) => (
            <li
              key={s.label}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
              onMouseEnter={() => setActive(i)}
              className={`flex min-h-[44px] cursor-pointer items-center gap-2 px-3 py-2 text-sm ${i === active ? activeClassName : ""}`}
              data-testid={`address-suggestion-${i}`}
            >
              <MapPin className="h-4 w-4 flex-shrink-0 opacity-60" aria-hidden="true" />
              <span className="min-w-0">{s.label}</span>
            </li>
          ))}
        </ul>
        <p className="border-t border-current/10 px-3 py-1.5 text-[11px] opacity-70">
          Powered by{" "}
          <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer" className="underline" tabIndex={-1}>
            Geoapify
          </a>
        </p>
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {open ? `${suggestions.length} address suggestion${suggestions.length === 1 ? "" : "s"}. Use the arrow keys to choose.` : ""}
      </span>
    </div>
  );
}

/** Form country label (shared/serviceRequests COUNTRIES) to the lookup's country code; null = no lookup. */
export function lookupCountryCode(country: string | null | undefined): string | null {
  switch (country) {
    case undefined:
    case null:
    case "":
    case "United States of America":
      return "us";
    case "Canada":
      return "ca";
    case "Mexico":
      return "mx";
    case "United Kingdom":
      return "gb";
    default:
      return null;
  }
}
