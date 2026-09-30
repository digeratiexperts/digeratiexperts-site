import React from "react";
import type { LucideIcon } from "lucide-react";
import { StatusToken, type StatusTokenType } from "./StatusToken";

export interface SecurityBoundaryProps {
  label: string;
  sublabel?: string;
  status?: StatusTokenType;
  children: React.ReactNode;
  variant?: "perimeter" | "enclave" | "cloud" | "dmz";
  className?: string;
}

/**
 * Architectural boundary for explanatory diagrams. Variants change hierarchy,
 * not brand hue. A status token is shown only when a caller deliberately passes one.
 */
export const SecurityBoundary: React.FC<SecurityBoundaryProps> = ({
  label,
  sublabel,
  status,
  children,
  variant = "perimeter",
  className = "",
}) => {
  const borderStyles = {
    perimeter: "border-[#D3126A]/35 bg-de-raised",
    enclave: "border-de-hairline bg-de-bg/75",
    cloud: "border-white/15 bg-de-raised/75",
    dmz: "border-amber-500/25 bg-de-bg/75",
  }[variant];

  return (
    <div className={`relative rounded-xl border p-4 md:p-5 ${borderStyles} ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-de-hairline pb-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">{label}</span>
          {sublabel && <span className="font-mono text-[10px] text-white/50">({sublabel})</span>}
        </div>
        {status && <StatusToken status={status} />}
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export interface DiagramNodeProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  status?: "healthy" | "monitored" | "alert" | "isolated";
  metrics?: string;
  tone?: "dark" | "paper";
  className?: string;
}

/** Diagram node. Status is illustrative unless the surrounding EvidenceFrame says otherwise. */
export const DiagramNode: React.FC<DiagramNodeProps> = ({
  title,
  subtitle,
  icon: Icon,
  status = "monitored",
  metrics,
  tone = "dark",
  className = "",
}) => {
  const isPaper = tone === "paper";
  const statusStyles = {
    healthy: "border-emerald-500/30",
    monitored: isPaper ? "border-[var(--de-paper-hairline)]" : "border-de-hairline",
    alert: "border-amber-500/35",
    isolated: "border-[#D3126A]/45",
  }[status];

  return (
    <div className={`rounded-lg border p-3 ${isPaper ? "bg-white" : "bg-de-bg"} ${statusStyles} ${className}`}>
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
              isPaper ? "border-[var(--de-paper-hairline)] bg-de-paper" : "border-de-hairline bg-de-raised"
            }`}
          >
            <Icon className={`h-4 w-4 ${isPaper ? "text-[#A30E52]" : "text-[#F04C97]"}`} aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className={`font-heading text-xs font-bold ${isPaper ? "text-[#1A1228]" : "text-white"}`}>{title}</p>
          {subtitle && (
            <p className={`mt-0.5 text-[11px] leading-relaxed ${isPaper ? "text-[#5A5368]" : "text-white/60"}`}>{subtitle}</p>
          )}
        </div>
      </div>
      {metrics && (
        <div
          className={`mt-2 flex items-center justify-between gap-2 border-t pt-1.5 font-mono text-[10px] ${
            isPaper ? "border-[var(--de-paper-hairline)] text-[#5A5368]" : "border-de-hairline text-white/50"
          }`}
        >
          <span>Detail:</span>
          <span className={`text-right font-semibold ${isPaper ? "text-[#3A3448]" : "text-white/75"}`}>{metrics}</span>
        </div>
      )}
    </div>
  );
};

export interface ControlGateProps {
  label: string;
  policy: string;
  enforced?: boolean;
  tone?: "dark" | "paper";
}

/**
 * Explanatory control point. `enforced` changes the diagram state only; callers
 * must not use it as evidence that a client has a real control unless the frame is LIVE/SANITIZED_REAL.
 */
export const ControlGate: React.FC<ControlGateProps> = ({
  label,
  policy,
  enforced = false,
  tone = "dark",
}) => {
  const isPaper = tone === "paper";
  return (
    <div
      className={`flex items-start gap-2 rounded border px-3 py-2 font-mono text-[11px] ${
        isPaper ? "border-[var(--de-paper-hairline)] bg-white" : "border-de-hairline bg-de-bg"
      }`}
    >
      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${enforced ? "bg-emerald-400" : "bg-[#D3126A]"}`} aria-hidden="true" />
      <span className={`font-bold ${isPaper ? "text-[#1A1228]" : "text-white"}`}>{label}:</span>
      <span className={isPaper ? "text-[#3A3448]" : "text-white/70"}>{policy}</span>
    </div>
  );
};
