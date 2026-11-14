/** Footer control that reopens the cookie banner preferences. */

export function CookiePreferencesLink({ className }: { className?: string }): JSX.Element {
  return (
    <button
      type="button"
      className={className}
      data-testid="footer-cookie-preferences"
      onClick={() => {
        window.dispatchEvent(new CustomEvent("de-open-cookie-preferences"));
      }}
    >
      Cookie preferences
    </button>
  );
}
