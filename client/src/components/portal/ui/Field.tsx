import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FieldProps {
  label: ReactNode;
  htmlFor?: string;
  /** Use when the control is labelled by aria-labelledby (Radix Select). */
  labelId?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Label, control, hint and error in a consistent stack. */
export function Field({ label, htmlFor, labelId, required, hint, error, children, className }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} id={labelId} className="block text-sm font-medium">
        {label}
        {required && (
          <span className="pt-link ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p className="pt-ink pt-tone-bad text-xs" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
