import React from "react";

interface HUDFrameProps {
  children: React.ReactNode;
  technicalId?: string;
  className?: string;
  cornerMarks?: boolean;
  gridMatrix?: boolean;
  accentBorder?: boolean;
}

/** Precision framing for evidence, diagrams, and operational UI only. */
export const HUDFrame: React.FC<HUDFrameProps> = ({
  children,
  technicalId,
  className = "",
  cornerMarks = true,
  gridMatrix = false,
  accentBorder = false,
}) => {
  return (
    <div className={`relative rounded-xl border bg-de-raised/95 ${accentBorder ? "border-[#D3126A]/35" : "border-de-hairline"} ${gridMatrix ? "de-grid-matrix" : ""} ${className}`}>
      {cornerMarks && (
        <>
          <span className="pointer-events-none absolute -left-px -top-px h-3 w-3 rounded-tl-xl border-l-2 border-t-2 border-[#D3126A]" aria-hidden="true" />
          <span className="pointer-events-none absolute -bottom-px -right-px h-3 w-3 rounded-br-xl border-b-2 border-r-2 border-[#D3126A]" aria-hidden="true" />
        </>
      )}
      {technicalId && (
        <div className="flex items-center justify-between border-b border-de-hairline px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-white/55">
          <span>{technicalId}</span>
          <span className="h-1 w-1 rounded-full bg-[#D3126A]" aria-hidden="true" />
        </div>
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
};
