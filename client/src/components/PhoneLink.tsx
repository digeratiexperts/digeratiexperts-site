import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from "react";
import { PRIMARY_PHONE, hasPublicPhone } from "@shared/companyContact";

type PhoneLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  /** Rendered in place of the link while no public number is set. */
  fallback?: ReactNode;
};

/**
 * Click-to-call link for the public number. Until a real number is set in
 * shared/companyContact.ts it renders `fallback`, which is nothing by default,
 * so visitors never see a dead tel: link or the placeholder token.
 */
export const PhoneLink = forwardRef<HTMLAnchorElement, PhoneLinkProps>(function PhoneLink(
  { fallback = null, children, ...rest },
  ref,
) {
  if (!hasPublicPhone()) return <>{fallback}</>;
  return (
    <a ref={ref} href={PRIMARY_PHONE.telHref} {...rest}>
      {children}
    </a>
  );
});
