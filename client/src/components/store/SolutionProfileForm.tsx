import { useEffect, useId, useState, type ReactNode } from "react";
import { ChoiceTiles } from "@/components/store/door2/ChoiceTiles";
import { LiveLine } from "@/components/store/door2/primitives";
import {
  isProfileComplete,
  profileGaps,
  profileSummary,
  type DeviceOwnership,
  type InternalItStatus,
  type SolutionEnvironment,
} from "@/lib/solutionDraft";

/*
 * The ProfileStrip (docs/STORE-EXPERIENCE-SOURCE-OF-TRUTH.md §5.6): four counts
 * and two facts, asked once and reused by every screen. Expanded while the
 * profile is incomplete; collapsed to a ProfileLine with Edit once it is.
 * The exported name stays SolutionProfileForm (door2Leakage.test.ts lock).
 */

const OWNERSHIP_OPTIONS = [
  { value: "company", label: "The company" },
  { value: "byod", label: "People bring their own" },
  { value: "hybrid", label: "A mix" },
] as const satisfies ReadonlyArray<{ value: Exclude<DeviceOwnership, "">; label: string }>;

const INTERNAL_IT_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Not sure" },
] as const satisfies ReadonlyArray<{ value: Exclude<InternalItStatus, "">; label: string }>;

const QUICK_USERS = ["5", "10", "25", "50", "100"] as const;

type CountKey = "userCount" | "workstationCount" | "mobileDeviceCount" | "siteCount";

function countProblem(value: string, allowZero: boolean): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (!/^\d{1,6}$/.test(trimmed)) return "Numbers only, up to 6 digits";
  if (!allowZero && Number(trimmed) === 0) return "At least 1";
  return null;
}

function CountField({
  id,
  label,
  value,
  placeholder,
  allowZero,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  allowZero: boolean;
  onChange: (value: string) => void;
  children?: ReactNode;
}) {
  const problem = countProblem(value, allowZero);
  const errorId = `${id}-error`;
  return (
    <div className="d2-field">
      <label htmlFor={id} className="d2-field__label">
        {label}
      </label>
      <input
        id={id}
        className="d2-input"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        aria-invalid={problem ? "true" : undefined}
        aria-describedby={problem ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {problem ? (
        <p id={errorId} className="d2-field__error">
          {problem}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export function sizingLine(environment: SolutionEnvironment): string {
  const gaps = profileGaps(environment);
  if (gaps.length === 6) return "Four counts and two facts. Then every package sizes itself.";
  if (gaps.length > 0) return `Missing: ${gaps.join(", ")}`;
  return `Sized for ${profileSummary(environment)}`;
}

/** The collapsed strip: one line and an Edit control. */
export function ProfileLine({
  environment,
  onEdit,
  editLabel = "Edit",
  testId = "profile-line",
}: {
  environment: SolutionEnvironment;
  onEdit: () => void;
  editLabel?: string;
  testId?: string;
}) {
  const complete = isProfileComplete(environment);
  return (
    <div className="d2-profile-line d2-small" data-testid={testId}>
      <span className="min-w-0">
        {complete ? (
          <>
            <span className="d2-label d2-accent-ink mr-2">Sized for</span>
            <span className="d2-ink-strong">{profileSummary(environment)}</span>
          </>
        ) : (
          <span className="d2-ink">Add your counts to size this</span>
        )}
      </span>
      <button type="button" className="d2-action d2-action--quiet" onClick={onEdit} data-testid="profile-edit">
        {complete ? editLabel : "Size it"}
      </button>
    </div>
  );
}

export function SolutionProfileForm({
  environment,
  onChange,
  heading = "Size it to your business",
  description = "Four counts and two facts. Then every package sizes itself.",
  headingLevel = 2,
  expandKey = 0,
  collapsible = true,
  suggestionSlot,
  testId = "profile-strip",
}: {
  environment: SolutionEnvironment;
  onChange: <K extends keyof SolutionEnvironment>(key: K, value: SolutionEnvironment[K]) => void;
  heading?: string;
  description?: string;
  headingLevel?: 2 | 3;
  /** Increment to force the strip open (a need was added with an empty profile). Focus never moves. */
  expandKey?: number;
  /** When false the strip never collapses (the contact summary, print). */
  collapsible?: boolean;
  /** A SuggestionLine rendered under the internal-IT question once it is answered. */
  suggestionSlot?: ReactNode;
  testId?: string;
}) {
  const complete = isProfileComplete(environment);
  const empty = profileGaps(environment).length === 6;
  // Empty: a closed 48px row. Partial: expanded. Complete: the ProfileLine.
  const [open, setOpen] = useState(() => (!collapsible ? true : !complete && !empty));
  const [focusWithin, setFocusWithin] = useState(false);
  const headingId = useId();
  const Heading = `h${headingLevel}` as "h2" | "h3";

  // Collapse once the profile completes, but never under the buyer's focus:
  // the strip waits until focus leaves it, so a keyboard user is not dropped.
  // A later gap re-opens it.
  useEffect(() => {
    if (!collapsible) return undefined;
    if (!complete) {
      if (!empty) setOpen(true);
      return undefined;
    }
    if (focusWithin) return undefined;
    const timer = window.setTimeout(() => setOpen(false), 900);
    return () => window.clearTimeout(timer);
  }, [complete, empty, collapsible, focusWithin]);

  useEffect(() => {
    if (expandKey > 0) setOpen(true);
  }, [expandKey]);

  const set = (key: CountKey) => (value: string) => onChange(key, value);

  if (!open && empty) {
    return (
      <div data-testid={testId} data-state="empty">
        <Heading id={headingId} className="sr-only">
          {heading}
        </Heading>
        <button type="button" className="d2-profile-empty" onClick={() => setOpen(true)} data-testid="profile-open" aria-expanded={false}>
          <span className="d2-body font-semibold">{heading}</span>
          <span className="d2-profile-empty__fields d2-small">Users · Computers · Mobile devices · Sites</span>
          <span className="d2-accent-ink d2-small font-semibold">Open</span>
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <div data-testid={testId} data-state="collapsed">
        <ProfileLine environment={environment} onEdit={() => setOpen(true)} />
      </div>
    );
  }

  return (
    <div
      data-testid={testId}
      data-state="expanded"
      aria-labelledby={headingId}
      role="group"
      onFocus={() => setFocusWithin(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false);
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <Heading id={headingId} className={headingLevel === 2 ? "d2-h2" : "d2-h3"}>
            {heading}
          </Heading>
          <p className="d2-small d2-ink-soft mt-2">{description}</p>
        </div>
        {complete && collapsible ? (
          <button type="button" className="d2-action d2-action--quiet" onClick={() => setOpen(false)}>
            Done
          </button>
        ) : null}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <CountField id="profile-users" label="Users" value={environment.userCount} placeholder="25" allowZero={false} onChange={set("userCount")}>
          <div className="d2-chips" aria-label="Quick size">
            {QUICK_USERS.map((count) => (
              <button key={count} type="button" className="d2-chip" onClick={() => onChange("userCount", count)}>
                {count}
              </button>
            ))}
          </div>
        </CountField>
        <CountField id="profile-computers" label="Computers" value={environment.workstationCount} placeholder="30" allowZero onChange={set("workstationCount")}>
          <div className="d2-chips">
            <button
              type="button"
              className="d2-chip"
              onClick={() => onChange("workstationCount", environment.userCount)}
              disabled={!/^\d{1,6}$/.test(environment.userCount.trim())}
            >
              Match users
            </button>
          </div>
        </CountField>
        <CountField id="profile-mobile" label="Mobile devices" value={environment.mobileDeviceCount} placeholder="15" allowZero onChange={set("mobileDeviceCount")} />
        <CountField id="profile-sites" label="Sites" value={environment.siteCount} placeholder="1" allowZero={false} onChange={set("siteCount")} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <ChoiceTiles
          name="profile-ownership"
          legend="Who owns the devices?"
          legendVisible
          value={environment.deviceOwnership}
          options={OWNERSHIP_OPTIONS}
          onChange={(value) => onChange("deviceOwnership", value)}
          columns={3}
          compact
        />
        <ChoiceTiles
          name="profile-internal-it"
          legend="Is anyone doing IT inside the company?"
          legendVisible
          value={environment.internalIt}
          options={INTERNAL_IT_OPTIONS}
          onChange={(value) => onChange("internalIt", value)}
          columns={3}
          compact
        />
      </div>

      <LiveLine status className="mt-5" testId="profile-live">
        {sizingLine(environment)}
      </LiveLine>
      {suggestionSlot}
    </div>
  );
}
