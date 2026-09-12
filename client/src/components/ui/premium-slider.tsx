import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"

interface PremiumSliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  showValue?: boolean;
  valuePrefix?: string;
  valueSuffix?: string;
}

const PremiumSlider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  PremiumSliderProps
>(({ className, showValue, valuePrefix = "", valueSuffix = "", "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy, ...props }, ref) => {
  const value = props.value?.[0] ?? props.defaultValue?.[0] ?? 0;
  const max = props.max ?? 100;
  const min = props.min ?? 0;
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="relative pt-2 pb-1">
      <SliderPrimitive.Root
        ref={ref}
        className={cn(
          "relative flex w-full touch-none select-none items-center group",
          className
        )}
        {...props}
      >
        {/* Track background with subtle styling */}
        <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-white/10">
          {/* Gradient range fill */}
          <SliderPrimitive.Range 
            className="absolute h-full rounded-full bg-de-accent"
          />
        </SliderPrimitive.Track>
        
        {/* Premium thumb with glow effect. The thumb is the focusable role="slider"
            element, so the accessible name is forwarded here (a11y sweep 2026-09-12). */}
        <SliderPrimitive.Thumb 
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className="block h-5 w-5 rounded-full bg-white shadow-[0_0_0_3px_rgb(var(--de-accent-rgb)/0.3),0_4px_12px_rgba(0,0,0,0.3)] 
                     ring-offset-background transition-all duration-200 
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-de-accent focus-visible:ring-offset-2 
                     hover:scale-110 hover:shadow-[0_0_0_4px_rgb(var(--de-accent-rgb)/0.4),0_6px_16px_rgba(0,0,0,0.4)]
                     disabled:pointer-events-none disabled:opacity-50
                     cursor-grab active:cursor-grabbing"
        />
      </SliderPrimitive.Root>
      
      {/* Optional floating value indicator */}
      {showValue && (
        <div 
          className="absolute -top-6 text-xs font-medium text-de-accent-ink transition-all duration-200"
          style={{ left: `calc(${percentage}% - 12px)` }}
        >
          {valuePrefix}{value}{valueSuffix}
        </div>
      )}
    </div>
  );
});

PremiumSlider.displayName = "PremiumSlider";

export { PremiumSlider }
