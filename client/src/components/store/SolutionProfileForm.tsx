import { Check, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isProfileComplete,
  type DeviceOwnership,
  type InternalItStatus,
  type SolutionEnvironment,
} from "@/lib/solutionDraft";

const OWNERSHIP_OPTIONS: Array<[Exclude<DeviceOwnership, "">, string]> = [
  ["company", "Company-owned"],
  ["byod", "BYOD"],
  ["hybrid", "Hybrid"],
];

const INTERNAL_IT_OPTIONS: Array<[Exclude<InternalItStatus, "">, string]> = [
  ["yes", "Yes"],
  ["no", "No"],
  ["unsure", "Not sure"],
];

export function SolutionProfileForm({
  environment,
  onChange,
  heading = "Start with your business profile",
  description = "Set these once. DE uses the same counts to size every package you browse.",
}: {
  environment: SolutionEnvironment;
  onChange: <K extends keyof SolutionEnvironment>(key: K, value: SolutionEnvironment[K]) => void;
  heading?: string;
  description?: string;
}) {
  const complete = isProfileComplete(environment);

  return (
    <section className="rounded-2xl border border-white/10 bg-[#111111] p-5 sm:p-7" aria-labelledby="solution-profile-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-de-accent/30 bg-de-accent/10">
              <Users className="h-5 w-5 text-de-accent-ink" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-de-accent-ink">Step 0 · Profile</p>
              <h2 id="solution-profile-heading" className="mt-1 text-xl font-semibold text-white sm:text-2xl">{heading}</h2>
            </div>
          </div>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/55">{description}</p>
        </div>
        <div className={`inline-flex h-9 items-center gap-2 self-start rounded-full border px-3 text-xs font-medium ${complete ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/5 text-white/60"}`}>
          {complete ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
          {complete ? "Profile saved" : "Autosaves on this device"}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="profile-users" className="text-white/80">Users</Label>
          <Input
            id="profile-users"
            inputMode="numeric"
            value={environment.userCount}
            onChange={(event) => onChange("userCount", event.target.value)}
            placeholder="25"
            className="h-11 border-white/15 bg-black/20 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-computers" className="text-white/80">Computers</Label>
          <Input
            id="profile-computers"
            inputMode="numeric"
            value={environment.workstationCount}
            onChange={(event) => onChange("workstationCount", event.target.value)}
            placeholder="30"
            className="h-11 border-white/15 bg-black/20 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-mobile" className="text-white/80">Mobile devices</Label>
          <Input
            id="profile-mobile"
            inputMode="numeric"
            value={environment.mobileDeviceCount}
            onChange={(event) => onChange("mobileDeviceCount", event.target.value)}
            placeholder="15"
            className="h-11 border-white/15 bg-black/20 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-sites" className="text-white/80">Sites / locations</Label>
          <Input
            id="profile-sites"
            inputMode="numeric"
            value={environment.siteCount}
            onChange={(event) => onChange("siteCount", event.target.value)}
            placeholder="1"
            className="h-11 border-white/15 bg-black/20 text-white"
          />
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <fieldset>
          <legend className="text-sm font-medium text-white/80">Device ownership</legend>
          <div className="mt-2 grid grid-cols-3 gap-2 rounded-xl border border-white/10 p-2">
            {OWNERSHIP_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={environment.deviceOwnership === value}
                className={`min-h-11 rounded-lg px-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] ${environment.deviceOwnership === value ? "bg-de-accent text-white" : "bg-white/5 text-white/65 hover:bg-white/10"}`}
                onClick={() => onChange("deviceOwnership", value)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium text-white/80">Internal IT team?</legend>
          <div className="mt-2 grid grid-cols-3 gap-2 rounded-xl border border-white/10 p-2">
            {INTERNAL_IT_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={environment.internalIt === value}
                className={`min-h-11 rounded-lg px-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] ${environment.internalIt === value ? "bg-de-accent text-white" : "bg-white/5 text-white/65 hover:bg-white/10"}`}
                onClick={() => onChange("internalIt", value)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </section>
  );
}
