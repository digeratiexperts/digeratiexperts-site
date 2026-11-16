import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from "react";
import { PRIMARY_PHONE, hasPublicPhone } from "@shared/companyContact";

type PhoneLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  /**
   * Rendered in place of the link while no public number is set. Leave it out
   * to show the children as plain, non-dialable text (they normally contain
   * PRIMARY_PHONE.display, which is the [DE_PUBLIC_PHONE] marker until a
   * dedicated line exists). Pass `null` to render nothing.
   */
  fallback?: ReactNode;
};

/**
 * Click-to-call link for the public number. Until a real number is set in
 * shared/companyContact.ts there is no tel: link: the children render as plain
 * text, so the page shows the [DE_PUBLIC_PHONE] marker (Joe, 2026-11-14:
 * "Use [DE_PUBLIC_PHONE] pending a dedicated local 480 business line"; see
 * docs/work-ledger/chatgpt-public-phone-static-20261114.md).
 */
export const PhoneLink = forwardRef<HTMLAnchorElement, PhoneLinkProps>(function PhoneLink(
  { fallback, children, className, id, style, title, ...rest },
  ref,
) {
  if (!hasPublicPhone()) {
    if (fallback !== undefined) return <>{fallback}</>;
    // No data-testid or ARIA from the link: tests and assistive tech must not
    // find a call control that does not exist.
    return (
      <span className={className} id={id} style={style} title={title} data-phone-pending="">
        {children}
      </span>
    );
  }
  return (
    <a ref={ref} href={PRIMARY_PHONE.telHref} className={className} id={id} style={style} title={title} {...rest}>
      {children}
    </a>
  );
});
