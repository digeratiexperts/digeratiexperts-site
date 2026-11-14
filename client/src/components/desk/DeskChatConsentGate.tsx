import { Link } from "wouter";
import { PRIMARY_PHONE } from "@shared/companyContact";
import {
  DESK_CHAT_CONSENT_AGREE_LABEL,
  DESK_CHAT_CONSENT_DECLINE_LABEL,
  DESK_CHAT_CONSENT_HEADING,
  DESK_CHAT_CONSENT_PRIVACY_HREF,
  splitDeskChatConsentNotice,
} from "@/lib/deskChatConsent";

type DeskChatConsentGateProps = {
  onAgree: () => void;
  onDecline: () => void;
  testId?: string;
};

/**
 * Pre-chat recording notice. The visitor must click Agree before the
 * composer is shown or any message is sent. Closing the window or
 * scrolling is not consent. The other-way button never starts a chat.
 */
export function DeskChatConsentGate({ onAgree, onDecline, testId = "desk-chat-consent" }: DeskChatConsentGateProps) {
  const parts = splitDeskChatConsentNotice();
  return (
    <div className="de-desk-consent" data-testid={testId} data-clarity-mask="true">
      <h3 className="de-desk-consent-heading">{DESK_CHAT_CONSENT_HEADING}</h3>
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
      <p className="de-desk-consent-phone">
        Or call{" "}
        <a href={PRIMARY_PHONE.telHref} data-testid="desk-chat-consent-phone">
          {PRIMARY_PHONE.display}
        </a>
        .
      </p>
    </div>
  );
}
