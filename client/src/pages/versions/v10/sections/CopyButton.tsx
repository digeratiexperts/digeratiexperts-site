import { useEffect, useRef, useState } from "react";

/**
 * Element kit: copy a contact value, confirming in place ("Copied"). If the
 * clipboard is refused, the value is selected so the visitor can copy it.
 * Styles: `.v10-copy` in v10-dashboard.css.
 */
export function CopyButton({ value, what, testId }: { value: string; what: string; testId?: string }) {
  const [done, setDone] = useState(false);
  const timer = useRef<number>();
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const selectValue = () => {
    const target = ref.current?.parentElement?.querySelector("a, span");
    if (!target) return;
    const range = document.createRange();
    range.selectNodeContents(target);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const copy = () => {
    const ok = () => {
      setDone(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setDone(false), 1800);
    };
    try {
      navigator.clipboard.writeText(value).then(ok, selectValue);
    } catch {
      selectValue();
    }
  };

  return (
    <button
      ref={ref}
      type="button"
      className={`v10-copy${done ? " is-done" : ""}`}
      onClick={copy}
      aria-label={done ? `${what} copied` : `Copy ${what}`}
      data-testid={testId}
    >
      <span className="v10-copy__no">Copy</span>
      <span className="v10-copy__yes" aria-hidden="true">
        Copied
      </span>
    </button>
  );
}
