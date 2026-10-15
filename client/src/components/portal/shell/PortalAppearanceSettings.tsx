import { Check } from "lucide-react";
import { Panel } from "@/components/portal/ui";
import { usePortalContrast, usePortalTheme, type PortalContrast, type PortalThemePreference } from "./portalTheme";

const THEMES: { value: PortalThemePreference; label: string }[] = [
  { value: "system", label: "Match device" },
  { value: "dark", label: "Dark" },
  { value: "black", label: "Black" },
  { value: "light", label: "Light" },
  { value: "console", label: "Admin console" },
];
const CONTRASTS: { value: PortalContrast; label: string }[] = [
  { value: "none", label: "Standard" },
  { value: "boost", label: "Boost" },
  { value: "max", label: "Maximum" },
];

export function PortalAppearanceSettings() {
  const [, preference, setPreference] = usePortalTheme();
  const [contrast, setContrast] = usePortalContrast();
  return (
    <Panel id="settings-appearance" title="Appearance" description="Saved on this device and applied immediately.">
      <fieldset>
        <legend className="mb-3 text-sm font-medium">Theme</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {THEMES.map(({ value, label }) => (
            <label key={value} className="pt-theme-option flex cursor-pointer flex-col items-center gap-2 text-center text-xs">
              <input type="radio" name="portal-theme" value={value} checked={preference === value} onChange={() => setPreference(value)} className="sr-only" data-testid={`settings-theme-${value}`} />
              <span className="pt-theme-swatch grid place-items-center" data-theme-opt={value} aria-hidden="true">
                {preference === value && <Check className="h-5 w-5" />}
              </span>
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-6">
        <legend className="mb-2 text-sm font-medium">Contrast</legend>
        <div className="pt-segmented">
          {CONTRASTS.map(({ value, label }) => (
            <label key={value} className="min-w-0 flex-1 cursor-pointer text-center text-sm">
              <input type="radio" name="portal-contrast" value={value} checked={contrast === value} onChange={() => setContrast(value)} className="sr-only" data-testid={`settings-contrast-${value}`} />
              <span className="pt-contrast-label flex min-h-11 items-center justify-center px-2 font-semibold">{label}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Boost brightens text and borders. Maximum uses stronger outlines and a high contrast accent.</p>
      </fieldset>
    </Panel>
  );
}
