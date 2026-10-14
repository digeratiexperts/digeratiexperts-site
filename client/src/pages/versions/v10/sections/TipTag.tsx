import { useId, type CSSProperties, type ReactNode } from "react";

/**
 * Element kit: a classification tag (ILLUSTRATIVE, EXAMPLE FORMAT) that
 * explains itself on hover or keyboard focus. The tip states what the
 * artifact is, so the truth label reads as a label rather than decoration.
 * Styles: `.v10-tip` in v10-dashboard.css.
 */
export function TipTag({
  tip,
  className = "",
  style,
  children,
}: {
  tip: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <span className="v10-tip" style={style}>
      <span className={`v10-tag ${className}`.trim()} tabIndex={0} aria-describedby={id}>
        {children}
      </span>
      <span className="v10-tip__bubble" role="tooltip" id={id}>
        {tip}
      </span>
    </span>
  );
}
