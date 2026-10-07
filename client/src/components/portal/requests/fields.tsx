import { useEffect, useId, useState, type ReactNode } from "react";
import { CalendarDays, ChevronDown, Info, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { COUNTRIES, US_STATES, isIsoDate, type ServiceRequestAddress } from "@shared/serviceRequests";

/**
 * Form controls for the service request pages. Every control has a visible
 * label tied by id, aria-invalid + aria-describedby to its error, and a
 * `highlighted` state the help chat uses to show which fields it filled.
 */

export const controlClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed read-only:bg-muted read-only:text-muted-foreground aria-[invalid=true]:border-destructive";

export function FieldLabel({ htmlFor, id, required, children }: { htmlFor?: string; id?: string; required?: boolean; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} id={id} className="mb-1.5 block text-sm font-medium text-foreground">
      {required && (
        <span className="mr-0.5 text-destructive" aria-hidden="true">
          *
        </span>
      )}
      {children}
      {required && <span className="sr-only"> (required)</span>}
    </label>
  );
}

export function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={id} className="mt-1 text-xs font-medium text-destructive">
      {error}
    </p>
  );
}

/** Ring that fades out after the help chat fills a field. */
export function Highlight({ on, children, className }: { on?: boolean; children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg transition-shadow duration-700 motion-reduce:transition-none",
        on && "shadow-[0_0_0_3px_hsl(var(--ring)/0.45)]",
        className,
      )}
      data-ai-filled={on ? "true" : undefined}
    >
      {children}
    </div>
  );
}

type BaseProps = {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  highlighted?: boolean;
  className?: string;
};

export function TextField({
  id,
  label,
  required,
  error,
  highlighted,
  className,
  value,
  onChange,
  type = "text",
  autoComplete,
  inputMode,
  readOnly,
}: BaseProps & {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: "text" | "tel" | "numeric";
  readOnly?: boolean;
}) {
  const errId = `${id}-error`;
  return (
    <Highlight on={highlighted} className={className}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        readOnly={readOnly}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
        className={controlClass}
      />
      <FieldError id={errId} error={error} />
    </Highlight>
  );
}

export function TextAreaField({
  id,
  label,
  required,
  error,
  highlighted,
  className,
  value,
  onChange,
  rows = 3,
  maxLength,
}: BaseProps & { value: string; onChange: (v: string) => void; rows?: number; maxLength?: number }) {
  const errId = `${id}-error`;
  return (
    <Highlight on={highlighted} className={className}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <textarea
        id={id}
        name={id}
        value={value}
        rows={rows}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
        className={cn(controlClass, "min-h-[72px] resize-y")}
      />
      <FieldError id={errId} error={error} />
    </Highlight>
  );
}

export function SelectField({
  id,
  label,
  required,
  error,
  highlighted,
  className,
  value,
  onChange,
  options,
  disabled,
  placeholder,
}: BaseProps & {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  placeholder?: string;
}) {
  const errId = `${id}-error`;
  return (
    <Highlight on={highlighted} className={className}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <div className="relative">
        <select
          id={id}
          name={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          className={cn(controlClass, "appearance-none pr-9 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100")}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      </div>
      <FieldError id={errId} error={error} />
    </Highlight>
  );
}

export function CheckboxField({
  id,
  label,
  checked,
  onChange,
  highlighted,
  className,
}: {
  id: string;
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  highlighted?: boolean;
  className?: string;
}) {
  return (
    <Highlight on={highlighted} className={className}>
      <label htmlFor={id} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2.5 text-sm text-foreground sm:min-h-0">
        <input
          id={id}
          name={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 shrink-0 rounded border-input accent-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span>{label}</span>
      </label>
    </Highlight>
  );
}

/** YYYY-MM-DD text input with a calendar button, as in the reference form. */
export function DateField({
  id,
  label,
  required,
  error,
  highlighted,
  className,
  value,
  onChange,
  minDate,
}: BaseProps & { value: string; onChange: (v: string) => void; minDate?: string }) {
  const [open, setOpen] = useState(false);
  const errId = `${id}-error`;
  const hintId = `${id}-hint`;
  const selected = isIsoDate(value) ? new Date(`${value}T00:00:00`) : undefined;
  const min = minDate && isIsoDate(minDate) ? new Date(`${minDate}T00:00:00`) : undefined;
  return (
    <Highlight on={highlighted} className={className}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <div className="flex">
        <input
          id={id}
          name={id}
          type="text"
          inputMode="numeric"
          placeholder="YYYY-MM-DD"
          value={value}
          maxLength={10}
          onChange={(e) => onChange(e.target.value.replace(/[^\d-]/g, ""))}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, error ? errId : ""].filter(Boolean).join(" ")}
          className={cn(controlClass, "rounded-r-none")}
        />
        <span id={hintId} className="sr-only">
          Format year, month, day, for example 2026-10-21
        </span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Choose ${label} from a calendar`}
              className="inline-flex h-auto min-h-[38px] min-w-[44px] items-center justify-center rounded-r-md border border-l-0 border-input bg-muted text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected ?? min}
              disabled={min ? { before: min } : undefined}
              onSelect={(d) => {
                if (!d) return;
                const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                onChange(iso);
                setOpen(false);
                requestAnimationFrame(() => document.getElementById(id)?.focus());
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      <FieldError id={errId} error={error} />
    </Highlight>
  );
}

/**
 * Lookup (reference) field: info icon, selected value, clear ×, dropdown ▾,
 * search list. Used for Requested for, Site Location Code and assigned assets.
 */
export function LookupField<T>({
  id,
  label,
  required,
  error,
  highlighted,
  className,
  value,
  onChange,
  options,
  onSearch,
  getKey,
  getLabel,
  getDetail,
  renderInfo,
  emptyText = "No matches",
  placeholder = "",
  disabled,
}: BaseProps & {
  value: T | null;
  onChange: (v: T | null) => void;
  options: T[];
  onSearch?: (q: string) => void;
  getKey: (v: T) => string;
  getLabel: (v: T) => string;
  getDetail?: (v: T) => string | undefined;
  renderInfo?: (v: T) => ReactNode;
  emptyText?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const labelId = useId();
  const listId = `${id}-list`;
  const errId = `${id}-error`;
  useEffect(() => {
    if (open) onSearch?.("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <Highlight on={highlighted} className={className}>
      <FieldLabel id={labelId} htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <div
        className={cn(
          "flex min-h-[38px] items-stretch rounded-md border border-input bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring",
          error && "border-destructive",
        )}
      >
        <span className="flex items-center pl-2.5">
          {value && renderInfo ? (
            <HoverCard openDelay={150}>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  className="rounded-full p-0.5 text-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Details for ${getLabel(value)}`}
                >
                  <Info className="h-4 w-4" aria-hidden="true" />
                </button>
              </HoverCardTrigger>
              <HoverCardContent className="w-72 text-sm">{renderInfo(value)}</HoverCardContent>
            </HoverCard>
          ) : (
            <Info className="h-4 w-4 text-muted-foreground/60" aria-hidden="true" />
          )}
        </span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              id={id}
              type="button"
              role="combobox"
              disabled={disabled}
              aria-expanded={open}
              aria-controls={listId}
              aria-haspopup="listbox"
              aria-labelledby={labelId}
              aria-required={required || undefined}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errId : undefined}
              className="min-w-0 flex-1 truncate px-2.5 py-2 text-left text-sm text-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              {value ? getLabel(value) : <span className="text-muted-foreground">{placeholder}</span>}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[260px] p-0" align="start">
            <Command shouldFilter={!onSearch}>
              <CommandInput placeholder={`Search ${label.toLowerCase()}`} onValueChange={onSearch} />
              <CommandList id={listId}>
                <CommandEmpty>{emptyText}</CommandEmpty>
                <CommandGroup>
                  {options.map((o) => (
                    <CommandItem
                      key={getKey(o)}
                      value={`${getLabel(o)} ${getDetail?.(o) ?? ""} ${getKey(o)}`}
                      onSelect={() => {
                        onChange(o);
                        setOpen(false);
                      }}
                    >
                      <div className="min-w-0">
                        <div className="truncate">{getLabel(o)}</div>
                        {getDetail?.(o) && <div className="truncate text-xs text-muted-foreground">{getDetail(o)}</div>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {value && !disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`Clear ${label}`}
            className="flex min-w-[36px] items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-[36px] items-center justify-center border-l border-input text-muted-foreground hover:bg-accent"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      <FieldError id={errId} error={error} />
    </Highlight>
  );
}

/** Street / City / State / Country / Zipcode: read-only from the LID, or editable for a non-company address. */
export function AddressBlock({
  idPrefix,
  value,
  onChange,
  editable,
  errors,
  highlighted,
}: {
  idPrefix: string;
  value: Partial<ServiceRequestAddress>;
  onChange: (patch: Partial<ServiceRequestAddress>) => void;
  editable: boolean;
  errors: Record<string, string | undefined>;
  highlighted: (field: string) => boolean;
}) {
  const country = value.country || "United States of America";
  const isUS = country === "United States of America";
  const field = (k: keyof ServiceRequestAddress) => `customAddress.${String(k)}`;
  return (
    <div className="space-y-4">
      <TextField
        id={`${idPrefix}-street`}
        label="Street"
        required={editable}
        value={value.street ?? ""}
        onChange={(v) => onChange({ street: v })}
        readOnly={!editable}
        autoComplete="street-address"
        error={errors[field("street")]}
        highlighted={highlighted(field("street"))}
      />
      <TextField
        id={`${idPrefix}-city`}
        label="City"
        required={editable}
        value={value.city ?? ""}
        onChange={(v) => onChange({ city: v })}
        readOnly={!editable}
        autoComplete="address-level2"
        error={errors[field("city")]}
        highlighted={highlighted(field("city"))}
      />
      {isUS || !editable ? (
        <SelectField
          id={`${idPrefix}-state`}
          label="State"
          required={editable}
          value={value.state ?? ""}
          onChange={(v) => onChange({ state: v })}
          disabled={!editable}
          placeholder={editable ? "-- None --" : ""}
          options={[...US_STATES, ...(value.state && !(US_STATES as readonly string[]).includes(value.state) ? [value.state] : [])].map((s) => ({ value: s, label: s }))}
          error={errors[field("state")]}
          highlighted={highlighted(field("state"))}
        />
      ) : (
        <TextField
          id={`${idPrefix}-state`}
          label="State / Province"
          required
          value={value.state ?? ""}
          onChange={(v) => onChange({ state: v })}
          error={errors[field("state")]}
          highlighted={highlighted(field("state"))}
        />
      )}
      <SelectField
        id={`${idPrefix}-country`}
        label="Country"
        required={editable}
        value={country}
        onChange={(v) => onChange({ country: v })}
        disabled={!editable}
        options={COUNTRIES.map((c) => ({ value: c, label: c }))}
        error={errors[field("country")]}
        highlighted={highlighted(field("country"))}
      />
      <TextField
        id={`${idPrefix}-zip`}
        label="Zipcode"
        required={editable}
        value={value.zip ?? ""}
        onChange={(v) => onChange({ zip: v })}
        readOnly={!editable}
        autoComplete="postal-code"
        inputMode={isUS ? "numeric" : "text"}
        error={errors[field("zip")]}
        highlighted={highlighted(field("zip"))}
      />
    </div>
  );
}
