import { useEffect, useId, useState } from "react";

export type ChoiceOption<V extends string> = {
  value: V;
  label: string;
  detail?: string;
  /** A short electric caption under the detail: "DE's first choice", "Suggested". */
  tag?: string;
  disabled?: boolean;
  testId?: string;
};

/**
 * Every exclusive choice in the Store is a native radio group inside labels:
 * one tab stop, arrow keys, no ARIA invention. The jelly settle plays on a
 * transient data attribute set on change, never on first paint.
 */
export function ChoiceTiles<V extends string>({
  name,
  legend,
  legendVisible = false,
  value,
  options,
  onChange,
  columns = 1,
  compact = false,
  describedBy,
  className = "",
}: {
  name: string;
  legend: string;
  legendVisible?: boolean;
  value: V | "";
  options: ReadonlyArray<ChoiceOption<V>>;
  onChange: (value: V) => void;
  columns?: 1 | 2 | 3 | 4;
  compact?: boolean;
  describedBy?: string;
  className?: string;
}) {
  const groupId = useId();
  const [justSelected, setJustSelected] = useState<V | null>(null);
  useEffect(() => {
    if (justSelected === null) return;
    const timer = window.setTimeout(() => setJustSelected(null), 340);
    return () => window.clearTimeout(timer);
  }, [justSelected]);

  return (
    <fieldset className={`min-w-0 ${className}`} aria-describedby={describedBy}>
      <legend className={legendVisible ? "d2-small d2-ink mb-2 block font-semibold" : "sr-only"}>{legend}</legend>
      <div className={`d2-tiles d2-tiles--${columns}`}>
        {options.map((option) => {
          const id = `${groupId}-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={id}
              className={`d2-tile${compact ? " d2-tile--compact" : ""}`}
              data-de-jelly-choice=""
              data-de-just-selected={justSelected === option.value ? "true" : undefined}
              data-testid={option.testId}
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                disabled={option.disabled}
                onChange={() => {
                  setJustSelected(option.value);
                  onChange(option.value);
                }}
              />
              <span className="d2-tile__mark" aria-hidden="true" />
              <span className="d2-tile__body">
                <span className="d2-tile__label">{option.label}</span>
                {option.detail ? <span className="d2-tile__detail d2-small">{option.detail}</span> : null}
                {option.tag ? <span className="d2-tile__tag d2-micro">{option.tag}</span> : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
