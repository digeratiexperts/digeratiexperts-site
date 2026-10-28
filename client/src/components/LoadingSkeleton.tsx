import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular" | "card";
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export function Skeleton({ 
  className, 
  variant = "rectangular",
  width,
  height,
  lines = 1 
}: SkeletonProps) {
  const baseStyles = "animate-pulse bg-gradient-to-r from-white/5 via-white/10 to-white/5 bg-[length:200%_100%]";
  
  const variantStyles = {
    text: "h-4 rounded",
    circular: "rounded-full",
    rectangular: "rounded-lg",
    card: "rounded-xl",
  };

  const style = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  };

  if (variant === "text" && lines > 1) {
    return (
      <div className="space-y-2" role="status" aria-label="Loading content">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              baseStyles,
              variantStyles.text,
              i === lines - 1 ? "w-3/4" : "w-full",
              className
            )}
            style={style}
          />
        ))}
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  return (
    <div
      className={cn(baseStyles, variantStyles[variant], className)}
      style={style}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export function PageLoadingSkeleton() {
  return (
    <div data-page-loading
      className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-8"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-de-hairline border-t-de-accent animate-spin" />
        <div className="absolute inset-0 w-12 h-12 rounded-full bg-de-raised blur-xl animate-pulse" />
      </div>
      <p className="mt-4 text-white/50 text-base animate-pulse">Loading...</p>
      <span className="sr-only">Page is loading, please wait</span>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" className="w-1/3 h-5" />
          <Skeleton variant="text" className="w-1/2 h-4" />
        </div>
      </div>
      <Skeleton variant="text" lines={3} />
      <div className="flex gap-2">
        <Skeleton variant="rectangular" className="w-20 h-8" />
        <Skeleton variant="rectangular" className="w-20 h-8" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      <div className="bg-white/[0.02] p-4 border-b border-white/10">
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="text" className="flex-1 h-4" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 border-b border-white/5 last:border-0">
          <div className="flex gap-4">
            {[1, 2, 3, 4].map((j) => (
              <Skeleton key={j} variant="text" className="flex-1 h-4" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
