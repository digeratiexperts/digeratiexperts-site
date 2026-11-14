import { CSP_REPORT_PATH } from "../cspReport";

const PAYMENT_SCRIPT_HOSTS = [
  "https://challenges.cloudflare.com",
  "https://payments.zoho.com",
  "https://*.zoho.com",
];

const MARKETING_SCRIPT_HOSTS = [
  "https://challenges.cloudflare.com",
  "https://static.cloudflareinsights.com",
  "https://salesiq.zoho.com",
  "https://*.clarity.ms",
  "https://www.googletagmanager.com",
  "https://www.google-analytics.com",
  "https://connect.facebook.net",
  "https://snap.licdn.com",
  "https://bat.bing.com",
];

const MARKETING_CONNECT_HOSTS = [
  "https://*.zoho.com",
  "https://payments.zoho.com",
  "https://cloudflareinsights.com",
  "https://*.cloudflareinsights.com",
  "https://*.clarity.ms",
  "https://www.google-analytics.com",
  "https://analytics.google.com",
  "https://region1.google-analytics.com",
  "https://www.google.com",
  "https://www.googletagmanager.com",
  "https://connect.facebook.net",
  "https://www.facebook.com",
  "https://bat.bing.com",
  "https://px.ads.linkedin.com",
  "https://www.linkedin.com",
];

const PAYMENT_CONNECT_HOSTS = [
  "https://*.zoho.com",
  "https://payments.zoho.com",
  "https://challenges.cloudflare.com",
];

const MARKETING_FRAME_HOSTS =
  "https://challenges.cloudflare.com https://meet.digerati-experts.com https://*.zoho.com https://payments.zoho.com https://www.facebook.com https://td.doubleclick.net https://www.youtube-nocookie.com https://player.vimeo.com https://www.loom.com";

const PAYMENT_FRAME_HOSTS =
  "https://challenges.cloudflare.com https://*.zoho.com https://payments.zoho.com";

export const PAYMENT_CSP_REPORT_TO = "csp-endpoint";

export function paymentCspMarketingHosts(): string[] {
  return [
    "clarity.ms",
    "googletagmanager.com",
    "google-analytics.com",
    "connect.facebook.net",
    "facebook.com",
    "snap.licdn.com",
    "bat.bing.com",
    "linkedin.com",
    "doubleclick.net",
    "salesiq.zoho.com",
    "cloudflareinsights.com",
  ];
}

export function buildContentSecurityPolicy(options: {
  isProduction: boolean;
  isPaymentPage: boolean;
  nonce?: string | null;
}): string {
  const { isProduction, isPaymentPage, nonce } = options;
  const scriptHosts = (isPaymentPage ? PAYMENT_SCRIPT_HOSTS : MARKETING_SCRIPT_HOSTS).join(" ");
  const scriptBits = ["'self'"];
  if (isPaymentPage && isProduction && nonce) {
    scriptBits.push(`'nonce-${nonce}'`);
  } else {
    scriptBits.push("'unsafe-inline'");
    if (!isProduction) scriptBits.push("'unsafe-eval'");
  }
  const connect = (isPaymentPage ? PAYMENT_CONNECT_HOSTS : MARKETING_CONNECT_HOSTS).join(" ");
  const connectDev = isProduction ? "" : " wss://*.replit.dev ws://localhost:*";
  const frame = isPaymentPage ? PAYMENT_FRAME_HOSTS : MARKETING_FRAME_HOSTS;
  const directives = [
    "default-src 'self'",
    `script-src ${scriptBits.join(" ")} ${scriptHosts}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    `frame-src ${frame}`,
    `connect-src 'self' ${connect}${connectDev}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://payments.zoho.com",
    "frame-ancestors 'self'",
    "upgrade-insecure-requests",
    `report-uri ${CSP_REPORT_PATH}`,
    `report-to ${PAYMENT_CSP_REPORT_TO}`,
  ];
  return directives.join("; ");
}

export function reportingEndpointsHeader(): string {
  return `${PAYMENT_CSP_REPORT_TO}="${CSP_REPORT_PATH}"`;
}
