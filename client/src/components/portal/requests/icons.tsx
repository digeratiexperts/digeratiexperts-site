/**
 * Catalog item glyphs for service requests, drawn in currentColor so they
 * follow the portal theme. Monitor + tag + plus (loaner) and monitor + return
 * arrows (return), after the reference catalog layout.
 */

type IconProps = { className?: string };

export function LoanerComputerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 120 100" className={className} aria-hidden="true" fill="none" stroke="currentColor">
      <rect x="10" y="8" width="84" height="60" rx="2" strokeWidth="7" />
      <path d="M38 80h28M28 92h48" strokeWidth="5" strokeLinecap="round" />
      <path d="M38 30l12-12h16l-1 15-17 17z" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="58" cy="25" r="2.6" fill="currentColor" stroke="none" />
      <circle cx="94" cy="72" r="18" strokeWidth="4" className="fill-card" />
      <path d="M94 63v18M85 72h18" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function ReturnComputerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 120 100" className={className} aria-hidden="true" fill="none" stroke="currentColor">
      <rect x="40" y="8" width="70" height="52" rx="2" strokeWidth="7" />
      <path d="M62 74h26M52 88h46" strokeWidth="5" strokeLinecap="round" />
      <path d="M12 52a24 24 0 0 1 40-17" strokeWidth="6" strokeLinecap="round" />
      <path d="M52 22v14H38" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M56 70a24 24 0 0 1-40 9" strokeWidth="6" strokeLinecap="round" />
      <path d="M8 66l6 13 13-5" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
