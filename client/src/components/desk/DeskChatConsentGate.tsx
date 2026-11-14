import { Link } from "wouter";
import { PRIMARY_PHONE } from "@shared/companyContact";
import {
  DESK_CHAT_CONSENT_AGREE_LABEL,
  DESK_CHAT_CONSENT_DECLINE_LABEL,
  DESK_CHAT_CONSENT_HEADING,
  DESK_CHAT_CONSENT_PRIVACY_HREF,
  DESK_CHAT_PRIOR_DESCRIPTION_NOTE,
  splitDeskChatConsentNotice,
} from "@/lib/deskChatConsent";

export type DeskChatConsentGateProps = {
  onAgree: () => void;
  onDecline: () => void;
  declined?: boolean;
  descriptionAttached?: boolean;
  onOpenTicket?: () => void;
  ticketHref?: string;
  ticketLabel?: string;
  contactHref?: string;
  contactLabel?: string;
  testId?: string;
};

/**
 * Pre-chat recording notice. The visitor must click Agree before the
 * composer is shown or any message is sent. Closing the window or
 * scrolling is not consent. The other-way button never starts a chat.
 */
export function DeskChatConsentGate({
  onAgree,
  onDecline,
  declined = false,
  descriptionAttached = false,
  onOpenTicket,
  ticketHref,
  ticketLabel = "Open a support ticket",
  contactHref = "/contact",
  contactLabel = "Use our contact form",
  testId = "desk-chat-consent",
}: DeskChatConsentGateProps) {
  if (declined) {
    return (
      <div className="de-desk-consent de-desk-consent--other" data-testid="desk-other-contact-ways">
        <h3 className="de-desk-consent-heading">Contact DE another way</h3>
        <p className="de-desk-consent-copy">
          You can reach Digerati Experts (DE) through our contact form, by opening a support ticket, or by phone.
        </p>
        <div className="de-desk-other-list">
          <a href={contactHref} className="de-desk-other-card" data-testid="desk-other-contact-form">
            <span className="de-desk-other-card-label">{contactLabel}</span>
          </a>
          {ticketHref ? (
            <a href={ticketHref} className="de-desk-other-card" data-testid="desk-other-ticket">
              <span className="de-desk-other-card-label">{ticketLabel}</span>
            </a>
          ) : (
            <button type="button" className="de-desk-other-card" data-testid="desk-other-ticket" onClick={onOpenTicket}>
              <span className="de-desk-other-card-label">{ticketLabel}</span>
            </button>
          )}
          <a href={PRIMARY_PHONE.telHref} className="de-desk-other-card" data-testid="desk-chat-consent-phone">
            <span className="de-desk-other-card-label">Call {PRIMARY_PHONE.display}</span>
          </a>
        </div>
      </div>
    );
  }

  const parts = splitDeskChatConsentNotice();
  return (
    <div className="de-desk-consent" data-testid={testId} data-clarity-mask="true">
      <h3 className="de-desk-consent-heading">{DESK_CHAT_CONSENT_HEADING}</h3>
      {descriptionAttached ? (
        <p className="de-desk-consent-attached" data-testid="desk-chat-prior-description">
          {DESK_CHAT_PRIOR_DESCRIPTION_NOTE}
        </p>
      ) : null}
      <p className="de-desk-consent-copy">
        {parts.before}
        <Link href={DESK_CHAT_CONSENT_PRIVACY_HREF} className="de-desk-consent-policy">
          Privacy Policy
        </Link>
        {parts.after}
      </p>
      <div className="de-desk-consent-actions">
        <button type="button" className="de-desk-consent-btn" data-testid="desk-chat-consent-agree" onClick={onAgree}>
          {DESK_CHAT_CONSENT_AGREE_LABEL}
        </button>
        <button type="button" className="de-desk-consent-btn" data-testid="desk-chat-consent-decline" onClick={onDecline}>
          {DESK_CHAT_CONSENT_DECLINE_LABEL}
        </button>
      </div>
    </div>
  );
}
