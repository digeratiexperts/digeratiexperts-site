/**
 * Notification Service
 * Email notifications via ZeptoMail transactional email service
 */

import { logger } from "../logger";
import { shouldBlockMutation } from "../stagingReviewGuard";
import { COMPANY } from "@shared/companyContact";

const ZEPTOMAIL_API_URL = "https://api.zeptomail.com/v1.1/email";
const FROM_EMAIL = "noreply@digeratiexperts.com";
const FROM_NAME = "Digerati Experts";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "info@digeratiexperts.com";

/** Visitor-supplied text goes into these emails escaped. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

/** Lead address and sales (#243 owner decision: both), without duplicates. */
export function solutionFallbackRecipients(): string[] {
  const sales = process.env.SALES_LEAD_EMAIL || COMPANY.salesEmail;
  return Array.from(new Set([ADMIN_EMAIL, sales].map((address) => address.trim().toLowerCase()).filter(Boolean)));
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  /** When true, add List-Unsubscribe headers (marketing/newsletter). */
  listUnsubscribe?: boolean;
}

interface ZeptoMailResponse {
  request_id?: string;
  message?: string;
  error?: any;
}

async function sendEmail(options: EmailOptions): Promise<boolean> {
  // Review instances must never mail real leads/clients.
  if (shouldBlockMutation(`outbound email: ${options.subject}`)) {
    return false;
  }

  const apiToken = process.env.ZEPTOMAIL_API_TOKEN;

  if (!apiToken) {
    logger.warn("ZEPTOMAIL_API_TOKEN not configured - email not sent", {
      subject: options.subject,
      to: Array.isArray(options.to) ? options.to : [options.to],
    });
    return false;
  }

  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  
  const unsubMailto = `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent("Unsubscribe")}`;
  const unsubUrl = `${process.env.APP_URL || "https://digeratiexperts.com"}/legal/privacy-policy#email-preferences`;

  const payload: Record<string, unknown> = {
    from: {
      address: FROM_EMAIL,
      name: FROM_NAME,
    },
    to: recipients.map(email => ({
      email_address: {
        address: email,
      },
    })),
    subject: options.subject,
    htmlbody: options.htmlBody,
    textbody: options.textBody || options.htmlBody.replace(/<[^>]*>/g, ''),
    track_clicks: false,
    track_opens: false,
  };

  // Deliverability: List-Unsubscribe for marketing/newsletter only (not transactional auth mail)
  if (options.listUnsubscribe) {
    payload.additional_headers = [
      { header_name: "List-Unsubscribe", header_value: `<${unsubMailto}>, <${unsubUrl}>` },
      { header_name: "List-Unsubscribe-Post", header_value: "List-Unsubscribe=One-Click" },
    ];
  }

  try {
    const response = await fetch(ZEPTOMAIL_API_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": apiToken.startsWith("Zoho-enczapikey") ? apiToken : `Zoho-enczapikey ${apiToken}`,
      },
      body: JSON.stringify(payload),
    });

    const result: ZeptoMailResponse = await response.json();

    if (response.ok) {
      logger.email("sent", recipients.join(", "), true, {
        subject: options.subject,
        requestId: result.request_id,
      });
      return true;
    } else {
      logger.email("failed", recipients.join(", "), false, {
        subject: options.subject,
        error: result.error || result.message,
        statusCode: response.status,
      });
      return false;
    }
  } catch (error) {
    logger.error("Email send error", error, {
      subject: options.subject,
      recipients,
    });
    return false;
  }
}

// Email Templates
function baseEmailTemplate(content: string, title: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background-color: #1a1a2e; color: #e0e0e0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 50%, #d946ef 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { background: #262640; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
    .highlight { color: #a855f7; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Digerati Experts</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>Digerati Experts - Enterprise-Grade IT Security for Arizona Businesses</p>
      <p>&copy; ${new Date().getFullYear()} Digerati Experts. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// Notification Functions
export const notificationService = {
  /**
   * A solution request the database could not take (#243). Sent straight to the
   * lead address and sales, not through the event bus, whose listener also
   * needs the database. Carries the full request so nothing depends on recovery.
   */
  async sendSolutionRequestFallback(request: {
    reference: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    organizationName: string;
    description: string;
  }): Promise<boolean> {
    const row = (label: string, value: string) =>
      value ? `<tr><td style="padding: 8px 0; color: #888;">${label}:</td><td>${escapeHtml(value)}</td></tr>` : "";
    const content = `
      <h2>Solution request ${escapeHtml(request.reference)} (saved outside the database)</h2>
      <p>The website database was unavailable when this request was submitted. It is held on the server and will be written to the database automatically when it recovers. Act on it from this email.</p>
      <table style="width: 100%; margin: 20px 0;">
        ${row("Reference", request.reference)}
        ${row("Name", request.contactName)}
        ${row("Email", request.contactEmail)}
        ${row("Phone", request.contactPhone)}
        ${row("Company", request.organizationName)}
      </table>
      <p style="background: #1a1a2e; padding: 15px; border-radius: 6px; white-space: pre-wrap;">${escapeHtml(request.description)}</p>
    `;
    return sendEmail({
      to: solutionFallbackRecipients(),
      subject: `Solution request ${request.reference}: ${request.organizationName || request.contactName}`,
      htmlBody: baseEmailTemplate(content, "Solution request"),
      textBody: [
        `Solution request ${request.reference} (saved outside the database)`,
        `Name: ${request.contactName}`,
        `Email: ${request.contactEmail}`,
        `Phone: ${request.contactPhone}`,
        `Company: ${request.organizationName}`,
        "",
        request.description,
      ].join("\n"),
    });
  },

  /** The visitor's own confirmation with their reference (#243 owner decision: always). */
  async sendSolutionRequestAcknowledgement(request: {
    reference: string;
    contactName: string;
    contactEmail: string;
  }): Promise<boolean> {
    const firstName = request.contactName.trim().split(/\s+/)[0] || "there";
    const content = `
      <h2>We received your solution request</h2>
      <p>Hi ${escapeHtml(firstName)},</p>
      <p>Thank you. Your reference is <span class="highlight">${escapeHtml(request.reference)}</span>. Quote it if you contact us.</p>
      <p>Digerati Experts will confirm package fit, scope, fulfillment and pricing with you before you commit to anything.</p>
    `;
    return sendEmail({
      to: request.contactEmail,
      subject: `Your Digerati Experts solution request ${request.reference}`,
      htmlBody: baseEmailTemplate(content, "Solution request received"),
      textBody: [
        `Hi ${firstName},`,
        "",
        `Thank you. Your reference is ${request.reference}. Quote it if you contact us.`,
        "Digerati Experts will confirm package fit, scope, fulfillment and pricing with you before you commit to anything.",
      ].join("\n"),
    });
  },

  async sendNewLeadNotification(lead: {
    name: string;
    email: string;
    company?: string;
    phone?: string;
    message?: string;
    source?: string;
  }): Promise<boolean> {
    const content = `
      <h2>New Lead Received</h2>
      <p>A new lead has been submitted through the website:</p>
      <table style="width: 100%; margin: 20px 0;">
        <tr><td style="padding: 8px 0; color: #888;">Name:</td><td class="highlight">${lead.name}</td></tr>
        <tr><td style="padding: 8px 0; color: #888;">Email:</td><td class="highlight">${lead.email}</td></tr>
        ${lead.company ? `<tr><td style="padding: 8px 0; color: #888;">Company:</td><td>${lead.company}</td></tr>` : ''}
        ${lead.phone ? `<tr><td style="padding: 8px 0; color: #888;">Phone:</td><td>${lead.phone}</td></tr>` : ''}
        ${lead.source ? `<tr><td style="padding: 8px 0; color: #888;">Source:</td><td>${lead.source}</td></tr>` : ''}
      </table>
      ${lead.message ? `<p><strong>Message:</strong></p><p style="background: #1a1a2e; padding: 15px; border-radius: 6px;">${lead.message}</p>` : ''}
    `;

    return sendEmail({
      to: ADMIN_EMAIL,
      subject: `New Lead: ${lead.name} from ${lead.company || 'Direct Contact'}`,
      htmlBody: baseEmailTemplate(content, "New Lead"),
    });
  },

  async sendQuoteConfirmation(data: {
    email: string;
    name: string;
    quoteId: string;
    items: { name: string; price: number }[];
    total: number;
  }): Promise<boolean> {
    const itemsHtml = data.items
      .map(item => `<tr><td style="padding: 8px;">${item.name}</td><td style="padding: 8px; text-align: right;">$${item.price.toFixed(2)}</td></tr>`)
      .join('');

    const content = `
      <h2>Quote Request Received</h2>
      <p>Hi ${data.name},</p>
      <p>Thank you for your quote request. We've received it and will get back to you within 24 hours.</p>
      <p><strong>Quote ID:</strong> <span class="highlight">${data.quoteId}</span></p>
      <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
        <tr style="background: #1a1a2e;"><th style="padding: 12px; text-align: left;">Item</th><th style="padding: 12px; text-align: right;">Price</th></tr>
        ${itemsHtml}
        <tr style="border-top: 2px solid #8b5cf6;"><td style="padding: 12px;"><strong>Total</strong></td><td style="padding: 12px; text-align: right;"><strong class="highlight">$${data.total.toFixed(2)}</strong></td></tr>
      </table>
      <a href="https://portal.digeratiexperts.com/portal/orders" class="button">View Order in Portal</a>
    `;

    return sendEmail({
      to: data.email,
      subject: `Quote Request Received - ${data.quoteId}`,
      htmlBody: baseEmailTemplate(content, "Quote Confirmation"),
    });
  },

  async sendOrderConfirmation(data: {
    email: string;
    name: string;
    orderId: string;
    items: { name: string; price: number; quantity: number }[];
    total: number;
  }): Promise<boolean> {
    const itemsHtml = data.items
      .map(item => `<tr><td style="padding: 8px;">${item.name}</td><td style="padding: 8px; text-align: center;">${item.quantity}</td><td style="padding: 8px; text-align: right;">$${(item.price * item.quantity).toFixed(2)}</td></tr>`)
      .join('');

    const content = `
      <h2>Order Confirmed</h2>
      <p>Hi ${data.name},</p>
      <p>Thank you for your order! We're processing it now.</p>
      <p><strong>Order ID:</strong> <span class="highlight">${data.orderId}</span></p>
      <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
        <tr style="background: #1a1a2e;"><th style="padding: 12px; text-align: left;">Item</th><th style="padding: 12px; text-align: center;">Qty</th><th style="padding: 12px; text-align: right;">Price</th></tr>
        ${itemsHtml}
        <tr style="border-top: 2px solid #8b5cf6;"><td colspan="2" style="padding: 12px;"><strong>Total</strong></td><td style="padding: 12px; text-align: right;"><strong class="highlight">$${data.total.toFixed(2)}</strong></td></tr>
      </table>
      <a href="https://portal.digeratiexperts.com/portal/orders" class="button">Track Order</a>
    `;

    return sendEmail({
      to: data.email,
      subject: `Order Confirmed - ${data.orderId}`,
      htmlBody: baseEmailTemplate(content, "Order Confirmation"),
    });
  },

  async sendTicketUpdate(data: {
    email: string;
    name: string;
    ticketId: string;
    status: string;
    subject: string;
    message?: string;
  }): Promise<boolean> {
    const content = `
      <h2>Support Ticket Update</h2>
      <p>Hi ${data.name},</p>
      <p>Your support ticket has been updated:</p>
      <table style="width: 100%; margin: 20px 0;">
        <tr><td style="padding: 8px 0; color: #888;">Ticket ID:</td><td class="highlight">${data.ticketId}</td></tr>
        <tr><td style="padding: 8px 0; color: #888;">Subject:</td><td>${data.subject}</td></tr>
        <tr><td style="padding: 8px 0; color: #888;">Status:</td><td class="highlight">${data.status}</td></tr>
      </table>
      ${data.message ? `<p><strong>Latest Update:</strong></p><p style="background: #1a1a2e; padding: 15px; border-radius: 6px;">${data.message}</p>` : ''}
      <a href="https://portal.digeratiexperts.com/portal/tickets/${data.ticketId}" class="button">View Ticket</a>
    `;

    return sendEmail({
      to: data.email,
      subject: `Ticket Update: ${data.subject} [#${data.ticketId}]`,
      htmlBody: baseEmailTemplate(content, "Ticket Update"),
    });
  },

  async sendSystemAlert(data: {
    type: 'error' | 'warning' | 'info';
    title: string;
    message: string;
    details?: Record<string, any>;
  }): Promise<boolean> {
    const typeColors = {
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6',
    };

    const detailsHtml = data.details
      ? Object.entries(data.details)
          .map(([key, value]) => `<tr><td style="padding: 4px 8px; color: #888;">${key}:</td><td>${JSON.stringify(value)}</td></tr>`)
          .join('')
      : '';

    const content = `
      <h2 style="color: ${typeColors[data.type]};">[${data.type.toUpperCase()}] ${data.title}</h2>
      <p>${data.message}</p>
      ${detailsHtml ? `<table style="width: 100%; margin: 20px 0; background: #1a1a2e; border-radius: 6px;">${detailsHtml}</table>` : ''}
      <p style="color: #888; font-size: 12px;">Timestamp: ${new Date().toISOString()}</p>
    `;

    return sendEmail({
      to: ADMIN_EMAIL,
      subject: `[${data.type.toUpperCase()}] ${data.title}`,
      htmlBody: baseEmailTemplate(content, "System Alert"),
    });
  },

  async sendPasswordReset(data: {
    email: string;
    name: string;
    resetLink: string;
  }): Promise<boolean> {
    const content = `
      <h2>Password Reset Request</h2>
      <p>Hi ${data.name},</p>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      <a href="${data.resetLink}" class="button">Reset Password</a>
      <p style="color: #888; font-size: 12px; margin-top: 20px;">This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
    `;

    return sendEmail({
      to: data.email,
      subject: "Password Reset Request - Digerati Experts",
      htmlBody: baseEmailTemplate(content, "Password Reset"),
    });
  },

  async sendWelcomeEmail(data: {
    email: string;
    name: string;
  }): Promise<boolean> {
    const content = `
      <h2>Welcome to Digerati Experts!</h2>
      <p>Hi ${data.name},</p>
      <p>Thank you for creating an account with Digerati Experts. We're excited to have you on board!</p>
      <p>With your account, you can:</p>
      <ul style="margin: 20px 0; padding-left: 20px;">
        <li style="margin: 8px 0;">Access your client portal</li>
        <li style="margin: 8px 0;">View and manage support tickets</li>
        <li style="margin: 8px 0;">Track orders and invoices</li>
        <li style="margin: 8px 0;">Download documentation and resources</li>
      </ul>
      <a href="https://portal.digeratiexperts.com/portal" class="button">Access Your Portal</a>
    `;

    return sendEmail({
      to: data.email,
      subject: "Welcome to Digerati Experts!",
      htmlBody: baseEmailTemplate(content, "Welcome"),
    });
  },

  async sendMfaCode(data: {
    email: string;
    name: string;
    code: string;
  }): Promise<boolean> {
    const content = `
      <h2>Your Login Verification Code</h2>
      <p>Hi ${data.name},</p>
      <p>Your one-time verification code is:</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #8b5cf6; background: #1a1a2e; padding: 16px 32px; border-radius: 8px; display: inline-block;">${data.code}</span>
      </div>
      <p style="color: #888; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, please secure your account immediately.</p>
    `;

    return sendEmail({
      to: data.email,
      subject: `${data.code} — Digerati Experts Verification Code`,
      htmlBody: baseEmailTemplate(content, "Login Verification"),
    });
  },

  async sendEmailVerification(data: {
    email: string;
    name: string;
    verificationLink: string;
  }): Promise<boolean> {
    const content = `
      <h2>Verify Your Email Address</h2>
      <p>Hi ${data.name},</p>
      <p>Thanks for signing up for the Digerati Experts client portal. Please verify your email address to activate your account:</p>
      <a href="${data.verificationLink}" class="button">Verify My Email</a>
      <p style="color: #888; font-size: 12px; margin-top: 20px;">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
    `;

    return sendEmail({
      to: data.email,
      subject: "Verify your email — Digerati Experts Portal",
      htmlBody: baseEmailTemplate(content, "Email Verification"),
    });
  },

  async sendNewsletterWelcome(data: { email: string }): Promise<boolean> {
    const content = `
      <h2>You're on the list</h2>
      <p>Thanks for subscribing to Digerati Experts updates — practical IT and cybersecurity notes for Arizona businesses.</p>
      <p>We'll only send useful content. Prefer a free risk assessment instead?</p>
      <a href="https://digeratiexperts.com/book" class="button">Schedule My Assessment</a>
      <p style="color: #888; font-size: 12px; margin-top: 24px;">
        To stop receiving these emails, reply with Unsubscribe or email
        <a href="mailto:${ADMIN_EMAIL}?subject=Unsubscribe" style="color:#a855f7;">${ADMIN_EMAIL}</a>.
      </p>
    `;
    return sendEmail({
      to: data.email,
      subject: "Welcome — Digerati Experts insights",
      htmlBody: baseEmailTemplate(content, "Newsletter Welcome"),
      listUnsubscribe: true,
    });
  },

  async testEmailConnection(): Promise<{ success: boolean; message: string }> {
    const apiToken = process.env.ZEPTOMAIL_API_TOKEN;
    
    if (!apiToken) {
      return { success: false, message: "ZEPTOMAIL_API_TOKEN not configured" };
    }

    const success = await sendEmail({
      to: ADMIN_EMAIL,
      subject: "ZeptoMail Connection Test",
      htmlBody: baseEmailTemplate(
        `<h2>Email Configuration Test</h2><p>This is a test email to verify the ZeptoMail integration is working correctly.</p><p>Timestamp: ${new Date().toISOString()}</p>`,
        "Connection Test"
      ),
    });

    return {
      success,
      message: success ? "Test email sent successfully" : "Failed to send test email",
    };
  },
};

export default notificationService;
