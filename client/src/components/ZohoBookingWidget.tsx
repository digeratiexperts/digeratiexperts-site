import { useState } from "react";
import { Loader2, Calendar, ExternalLink, Phone } from "lucide-react";
import { PRIMARY_PHONE, PUBLIC_PHONE_CTA } from "@/data/companyContact";

const BOOKING_URL = "https://meet.digerati-experts.com/portal-embed#/digeratexperts";
const FALLBACK_URL = "https://meet.digerati-experts.com/";

interface ZohoBookingWidgetProps {
  instanceId?: string;
  className?: string;
  height?: string;
}

/**
 * Direct iframe to the already-allowed meet.digerati-experts.com embed.
 * Do not inject bookings.nimbuspop.com — that host is not on script-src.
 */
export function ZohoBookingWidget({
  instanceId = "default",
  className = "",
  height = "600px",
}: ZohoBookingWidgetProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const title = "Schedule a Cyber Risk Assessment";
  const frameId = `zoho-booking-widget-${instanceId}`;

  if (status === "error") {
    return <BookingFallback className={className} />;
  }

  return (
    <div className={`relative flex h-full min-h-[22rem] flex-col ${className}`}>
      {status === "loading" && (
        <div className="absolute inset-x-0 top-0 bottom-16 z-10 flex flex-col items-center justify-center gap-3 bg-[#050312]">
          <Loader2 className="h-7 w-7 animate-spin text-[#D3126A]" />
          <p className="text-sm font-medium text-white/70">Loading the calendar…</p>
        </div>
      )}
      <iframe
        id={frameId}
        title={title}
        src={BOOKING_URL}
        className="w-full min-h-0 flex-1 rounded-lg border-0 bg-[#050312]"
        style={{ minHeight: height, height }}
        loading="eager"
        referrerPolicy="strict-origin-when-cross-origin"
        data-testid="zoho-booking-widget"
        onLoad={() => setStatus("ready")}
        onError={() => setStatus("error")}
      />
      <a
        href={FALLBACK_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="sticky bottom-0 z-20 mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#D3126A] px-5 text-base font-semibold text-white shadow-[0_-12px_24px_rgba(5,3,18,0.9)] transition-colors hover:bg-[#f0187a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050312]"
        data-testid="link-open-booking"
      >
        <Calendar className="h-4 w-4" aria-hidden="true" />
        Open scheduling calendar
        <ExternalLink className="h-4 w-4 opacity-80" aria-hidden="true" />
      </a>
    </div>
  );
}

function BookingFallback({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex h-full min-h-[22rem] flex-col justify-center rounded-xl border border-de-hairline bg-de-raised p-6 md:p-8 ${className}`}
      data-testid="booking-fallback"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D3126A]">
        Next step
      </p>
      <h3 className="mt-2 font-heading text-xl font-semibold tracking-[-0.02em] text-white md:text-2xl">
        Open the calendar
      </h3>
      <p className="mt-3 text-base font-medium leading-relaxed text-white/80">
        Pick a time on our scheduling page. Thirty minutes, no obligation — we look at the
        environment before recommending a package.
      </p>
      <a
        href={FALLBACK_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#D3126A] px-5 text-base font-semibold text-white transition-colors hover:bg-[#f0187a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151217]"
        data-testid="link-open-booking"
      >
        <Calendar className="h-4 w-4" aria-hidden="true" />
        Open scheduling calendar
        <ExternalLink className="h-4 w-4 opacity-80" aria-hidden="true" />
      </a>
      <a
        href={PUBLIC_PHONE_CTA.href}
        className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 text-base font-semibold text-white hover:text-[#D3126A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]"
      >
        <Phone className="h-4 w-4 text-[#D3126A]" aria-hidden="true" />
        {PUBLIC_PHONE_CTA.numberLabel}
      </a>
    </div>
  );
}
