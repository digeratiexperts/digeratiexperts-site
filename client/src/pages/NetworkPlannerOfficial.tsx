import { useState, useMemo, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { 
  Shield, 
  Server, 
  Printer, 
  RotateCcw,
  Check,
  Info,
  Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { portalLoginWithReturn } from "@/lib/portalUrls";

type GateState = "checking" | "allowed" | "denied";

function InternalToolGate({ children }: { children: React.ReactNode }) {
  const [gate, setGate] = useState<GateState>("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/portal/me", { credentials: "include" });
        if (!cancelled) setGate(res.ok ? "allowed" : "denied");
      } catch {
        if (!cancelled) setGate("denied");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (gate === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-de-bg p-8 text-white">
        <Helmet>
          <title>Networking Planner | Digerati Experts</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <p className="text-slate-400">Checking authorization…</p>
      </div>
    );
  }

  if (gate === "denied") {
    const loginUrl = portalLoginWithReturn(
      typeof window !== "undefined" ? window.location.pathname : "/official-network-planner",
    );
    return (
      <div className="flex min-h-screen items-center justify-center bg-de-bg p-8 text-white">
        <Helmet>
          <title>Internal Tool | Digerati Experts</title>
          <meta name="robots" content="noindex, nofollow" />
          <meta name="description" content="Internal Digerati Experts tooling. Authentication required." />
        </Helmet>
        <div className="max-w-md space-y-4 rounded-2xl border border-de-hairline bg-de-raised p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-de-hairline bg-de-bg">
            <Lock className="h-6 w-6 text-de-accent-ink" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold">Internal tool — sign-in required</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            The Networking Planner is for authorized DE staff and partners. It is not a public
            marketing calculator. Sign in through the Client Portal to continue.
          </p>
          <a
            href={loginUrl}
            className="inline-flex items-center justify-center rounded-lg bg-de-accent hover:bg-de-accent px-5 py-2.5 font-semibold"
            data-testid="network-planner-login"
          >
            Sign in to continue
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

interface GatewayOption {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  price1Y: number;
  price3Y: number;
}

const gatewayOptions: GatewayOption[] = [
  { id: "basic", name: "Basic Gateway", description: "Up to 100 Mbps, 25 users", priceMonthly: 79, price1Y: 69, price3Y: 59 },
  { id: "standard", name: "Standard Gateway", description: "Up to 500 Mbps, 75 users", priceMonthly: 149, price1Y: 129, price3Y: 109 },
  { id: "advanced", name: "Advanced Gateway", description: "Up to 1 Gbps, 150 users", priceMonthly: 249, price1Y: 219, price3Y: 189 },
  { id: "enterprise", name: "Enterprise Gateway", description: "Up to 10 Gbps, unlimited", priceMonthly: 449, price1Y: 399, price3Y: 349 },
];

export default function NetworkPlannerOfficial() {
  return (
    <InternalToolGate>
      <NetworkPlannerOfficialApp />
    </InternalToolGate>
  );
}

function NetworkPlannerOfficialApp() {
  const [cloudShield, setCloudShield] = useState(true);
  const [coreStack, setCoreStack] = useState(true);
  const [sites, setSites] = useState(1);
  const [users, setUsers] = useState(20);
  
  const [csUplinksPerSite, setCsUplinksPerSite] = useState(0);
  const [csWarmSites, setCsWarmSites] = useState(0);
  const [csIpsec, setCsIpsec] = useState(0);
  const [csIPs, setCsIPs] = useState(0);
  
  const [gateway, setGateway] = useState("standard");
  const [billingTerm, setBillingTerm] = useState<"mo" | "1y" | "3y">("mo");
  const [tenG, setTenG] = useState(false);
  const [sw8, setSw8] = useState(0);
  const [sw24, setSw24] = useState(0);
  const [sw48, setSw48] = useState(0);
  const [aps, setAps] = useState(0);

  const selectedGateway = gatewayOptions.find(g => g.id === gateway) || gatewayOptions[1];
  
  const gatewayPrice = useMemo(() => {
    switch (billingTerm) {
      case "1y": return selectedGateway.price1Y;
      case "3y": return selectedGateway.price3Y;
      default: return selectedGateway.priceMonthly;
    }
  }, [selectedGateway, billingTerm]);

  const pricing = useMemo(() => {
    let cloudShieldMRC = 0;
    let cloudShieldNRC = 0;
    let coreStackMRC = 0;
    let coreStackNRC = 0;

    if (cloudShield) {
      const baseSASE = 29 * users;
      const uplinks = csUplinksPerSite * sites * 49;
      const warmSpare = csWarmSites * 59;
      const warmSpareSetup = csWarmSites * 199;
      const ipsec = csIpsec * 29;
      const cloudIps = csIPs * 19;
      
      cloudShieldMRC = baseSASE + uplinks + warmSpare + ipsec + cloudIps;
      cloudShieldNRC = warmSpareSetup + (sites * 299);
    }

    if (coreStack) {
      const gatewayTotal = gatewayPrice * sites;
      const switches8 = sw8 * sites * 19;
      const switches24 = sw24 * sites * 39;
      const switches48 = sw48 * sites * 69;
      const accessPoints = aps * sites * 15;
      const tenGUpgrade = tenG ? sites * 99 : 0;
      
      coreStackMRC = gatewayTotal + switches8 + switches24 + switches48 + accessPoints + tenGUpgrade;
      coreStackNRC = sites * 499;
    }

    const totalMRC = cloudShieldMRC + coreStackMRC;
    const totalNRC = cloudShieldNRC + coreStackNRC;
    const mergedDiscount = (cloudShield && coreStack) ? Math.round(totalMRC * 0.1) : 0;

    return {
      cloudShieldMRC,
      cloudShieldNRC,
      coreStackMRC,
      coreStackNRC,
      totalMRC: totalMRC - mergedDiscount,
      totalNRC,
      mergedDiscount,
      perUser: users > 0 ? Math.round((totalMRC - mergedDiscount) / users) : 0,
    };
  }, [cloudShield, coreStack, users, sites, csUplinksPerSite, csWarmSites, csIpsec, csIPs, gatewayPrice, sw8, sw24, sw48, aps, tenG]);

  const handleReset = () => {
    setCloudShield(true);
    setCoreStack(true);
    setSites(1);
    setUsers(20);
    setCsUplinksPerSite(0);
    setCsWarmSites(0);
    setCsIpsec(0);
    setCsIPs(0);
    setGateway("standard");
    setBillingTerm("mo");
    setTenG(false);
    setSw8(0);
    setSw24(0);
    setSw48(0);
    setAps(0);
  };

  return (
    <div className="min-h-screen bg-de-bg text-white">
      <Helmet>
        <title>Networking Planner | Digerati Experts</title>
        <meta name="description" content="Plan your CloudShield SASE and CoreStack network packages with our interactive pricing calculator. Configure sites, users, and hardware for accurate cost estimates." />
        <meta property="og:title" content="Networking Planner | Digerati Experts" />
        <meta property="og:description" content="Interactive network planning tool for CloudShield and CoreStack solutions." />
        <meta property="og:type" content="website" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="mx-auto max-w-[1120px] rounded-[18px] bg-[radial-gradient(900px_500px_at_8%_-10%,rgba(211,18,106,0.14)_0%,transparent_60%),#050312] p-7">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-4">
            <div className="rounded-xl border border-de-hairline bg-de-raised px-3 py-2 text-de-accent-ink font-bold text-sm">
              Networking
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white/80 mb-1">Plan Your Networking Package</h1>
              <p className="text-slate-400 text-sm">
                Choose needs first. Pricing shows at the end. Compare <strong className="text-white">CloudShield</strong>, <strong className="text-white">CoreStack</strong>, or a <strong className="text-white">Merged</strong> package.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-de-hairline text-white hover:bg-de-raised" onClick={handleReset} data-testid="button-reset">
              <RotateCcw className="w-4 h-4 mr-2" /> Reset
            </Button>
            <Button className="bg-[#D3126A] font-semibold text-white hover:bg-[#b80f5c]" onClick={() => window.print()} data-testid="button-print">
              <Printer className="w-4 h-4 mr-2" /> Print / Save
            </Button>
          </div>
        </header>

        {/* Solutions */}
        <section className="rounded-2xl border border-de-hairline bg-de-raised p-5 mb-4 shadow-xl">
          <h2 className="text-xl font-extrabold text-white/80 mb-4">Solutions</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="cursor-pointer group">
              <div className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${cloudShield ? 'border-[#D3126A] bg-de-bg' : 'border-de-hairline bg-de-bg hover:border-white/25'}`} onClick={() => setCloudShield(!cloudShield)} data-testid="toggle-cloudshield">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-de-hairline bg-de-bg">
                  <Shield className="w-5 h-5 text-de-accent-ink" />
                </div>
                <div className="flex-1">
                  <div className="font-extrabold text-white/80">CloudShield</div>
                  <div className="text-xs text-slate-400">(SASE)</div>
                </div>
                <div className={`flex h-6 w-6 items-center justify-center rounded-lg border border-[#D3126A] bg-[#D3126A] transition-all ${cloudShield ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
                  <Check className="w-4 h-4 text-white" strokeWidth={3} />
                </div>
              </div>
            </label>

            <label className="cursor-pointer group">
              <div className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${coreStack ? 'border-[#D3126A] bg-de-bg' : 'border-de-hairline bg-de-bg hover:border-white/25'}`} onClick={() => setCoreStack(!coreStack)} data-testid="toggle-corestack">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-de-hairline bg-de-bg">
                  <Server className="w-5 h-5 text-de-accent-ink" />
                </div>
                <div className="flex-1">
                  <div className="font-extrabold text-white/80">CoreStack</div>
                  <div className="text-xs text-slate-400">(Network)</div>
                </div>
                <div className={`flex h-6 w-6 items-center justify-center rounded-lg border border-[#D3126A] bg-[#D3126A] transition-all ${coreStack ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
                  <Check className="w-4 h-4 text-white" strokeWidth={3} />
                </div>
              </div>
            </label>
          </div>
          <p className="text-slate-500 text-sm mt-3">Pick either solo, or both to preview a merged package.</p>
        </section>

        {/* Environment */}
        <section className="rounded-2xl border border-de-hairline bg-de-raised p-5 mb-4 shadow-xl">
          <h2 className="text-xl font-extrabold text-white/80 mb-4">Your Environment</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-400">Number of sites</Label>
              <Input 
                type="number" 
                min={1} 
                value={sites} 
                onChange={(e) => setSites(Math.max(1, parseInt(e.target.value) || 1))}
                className="border-de-hairline bg-de-bg focus:border-de-hairline"
                data-testid="input-sites"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-400">Number of users</Label>
              <Input 
                type="number" 
                min={0} 
                value={users} 
                onChange={(e) => setUsers(Math.max(0, parseInt(e.target.value) || 0))}
                className="border-de-hairline bg-de-bg focus:border-de-hairline"
                data-testid="input-users"
              />
            </div>
          </div>
        </section>

        {/* CloudShield Needs */}
        {cloudShield && (
          <section className="rounded-2xl border border-de-hairline bg-de-raised p-5 mb-4 shadow-xl">
            <h2 className="text-xl font-extrabold text-white/80 mb-4">CloudShield (SASE) — Networking Needs</h2>
            <div className="grid md:grid-cols-4 gap-4">
              <TooltipProvider>
                <div className="space-y-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label className="text-slate-400 flex items-center gap-1 cursor-help">
                        Extra SD-WAN uplinks per site <Info className="w-3 h-3" />
                      </Label>
                    </TooltipTrigger>
                    <TooltipContent><p>Recurring add-on ($49 each)</p></TooltipContent>
                  </Tooltip>
                  <Input type="number" min={0} value={csUplinksPerSite} onChange={(e) => setCsUplinksPerSite(Math.max(0, parseInt(e.target.value) || 0))} className="border-de-hairline bg-de-bg" data-testid="input-uplinks" />
                </div>

                <div className="space-y-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label className="text-slate-400 flex items-center gap-1 cursor-help">
                        Sites needing warm spare <Info className="w-3 h-3" />
                      </Label>
                    </TooltipTrigger>
                    <TooltipContent><p>Recurring ($59/site) + setup $199</p></TooltipContent>
                  </Tooltip>
                  <Input type="number" min={0} value={csWarmSites} onChange={(e) => setCsWarmSites(Math.max(0, parseInt(e.target.value) || 0))} className="border-de-hairline bg-de-bg" data-testid="input-warm-spare" />
                </div>

                <div className="space-y-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label className="text-slate-400 flex items-center gap-1 cursor-help">
                        External IPSec connectors <Info className="w-3 h-3" />
                      </Label>
                    </TooltipTrigger>
                    <TooltipContent><p>Recurring add-on ($29 each)</p></TooltipContent>
                  </Tooltip>
                  <Input type="number" min={0} value={csIpsec} onChange={(e) => setCsIpsec(Math.max(0, parseInt(e.target.value) || 0))} className="border-de-hairline bg-de-bg" data-testid="input-ipsec" />
                </div>

                <div className="space-y-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label className="text-slate-400 flex items-center gap-1 cursor-help">
                        Additional cloud IPs <Info className="w-3 h-3" />
                      </Label>
                    </TooltipTrigger>
                    <TooltipContent><p>Recurring add-on ($19 each)</p></TooltipContent>
                  </Tooltip>
                  <Input type="number" min={0} value={csIPs} onChange={(e) => setCsIPs(Math.max(0, parseInt(e.target.value) || 0))} className="border-de-hairline bg-de-bg" data-testid="input-cloud-ips" />
                </div>
              </TooltipProvider>
            </div>
          </section>
        )}

        {/* CoreStack Needs */}
        {coreStack && (
          <section className="rounded-2xl border border-de-hairline bg-de-raised p-5 mb-4 shadow-xl">
            <h2 className="text-xl font-extrabold text-white/80 mb-4">CoreStack (Network) — Needs</h2>
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <Label className="text-slate-400">Gateway model (per site)</Label>
                <Select value={gateway} onValueChange={setGateway}>
                  <SelectTrigger className="border-de-hairline bg-de-bg" data-testid="select-gateway">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-de-hairline bg-de-raised">
                    {gatewayOptions.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400">Billing term</Label>
                <Select value={billingTerm} onValueChange={(v) => setBillingTerm(v as "mo" | "1y" | "3y")}>
                  <SelectTrigger className="border-de-hairline bg-de-bg" data-testid="select-billing-term">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-de-hairline bg-de-raised">
                    <SelectItem value="mo">Monthly</SelectItem>
                    <SelectItem value="1y">1 Year</SelectItem>
                    <SelectItem value="3y">3 Years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400">Info</Label>
                <div className="flex min-h-[42px] items-center rounded-xl border border-de-hairline bg-de-bg px-3 py-2.5 text-sm text-white/75">
                  {selectedGateway.description} — ${gatewayPrice}/mo
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <Checkbox id="tenG" checked={tenG} onCheckedChange={(c) => setTenG(!!c)} className="border-white/15 data-[state=checked]:bg-[#D3126A] data-[state=checked]:border-[#D3126A]" />
              <Label htmlFor="tenG" className="text-slate-300 cursor-pointer">High performance / 10G uplinks required (+$99/site)</Label>
            </div>

            <fieldset className="border border-dashed border-white/10 rounded-xl p-4">
              <legend className="px-2 text-white/80 font-semibold">Network hardware subscriptions (per site)</legend>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-400">8-port PoE switches</Label>
                  <Input type="number" min={0} value={sw8} onChange={(e) => setSw8(Math.max(0, parseInt(e.target.value) || 0))} className="border-de-hairline bg-de-bg" data-testid="input-sw8" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-400">24-port PoE switches</Label>
                  <Input type="number" min={0} value={sw24} onChange={(e) => setSw24(Math.max(0, parseInt(e.target.value) || 0))} className="border-de-hairline bg-de-bg" data-testid="input-sw24" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-400">48-port PoE switches</Label>
                  <Input type="number" min={0} value={sw48} onChange={(e) => setSw48(Math.max(0, parseInt(e.target.value) || 0))} className="border-de-hairline bg-de-bg" data-testid="input-sw48" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-400">WiFi access points</Label>
                  <Input type="number" min={0} value={aps} onChange={(e) => setAps(Math.max(0, parseInt(e.target.value) || 0))} className="border-de-hairline bg-de-bg" data-testid="input-aps" />
                </div>
              </div>
            </fieldset>
          </section>
        )}

        {/* Summary */}
        <section className="rounded-2xl border border-de-hairline bg-de-raised p-5 shadow-xl">
          <h2 className="text-xl font-extrabold text-white/80 mb-4">Summary</h2>
          <div className="grid md:grid-cols-4 gap-3 mb-6">
            <div className="rounded-xl border border-de-hairline bg-de-bg p-4">
              <div className="text-xs text-de-accent-ink mb-1">Monthly Recurring</div>
              <div className="text-2xl font-black text-white" data-testid="text-total-mrc">${pricing.totalMRC.toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-de-hairline bg-de-bg p-4">
              <div className="text-xs text-de-accent-ink mb-1">One-Time Setup</div>
              <div className="text-2xl font-black text-white" data-testid="text-total-nrc">${pricing.totalNRC.toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-de-hairline bg-de-bg p-4">
              <div className="text-xs text-de-accent-ink mb-1">Per User Cost</div>
              <div className="text-2xl font-black text-white" data-testid="text-per-user">${pricing.perUser}</div>
            </div>
            {pricing.mergedDiscount > 0 && (
              <div className="rounded-xl border border-[#D3126A]/40 bg-de-bg p-4">
                <div className="text-xs text-de-accent-ink mb-1">Bundle Savings</div>
                <div className="text-2xl font-black text-white" data-testid="text-bundle-savings">-${pricing.mergedDiscount}</div>
              </div>
            )}
          </div>

          {/* Breakdown */}
          <div className="grid md:grid-cols-2 gap-4">
            {cloudShield && (
              <div className="rounded-xl border border-de-hairline bg-de-bg p-4">
                <h3 className="font-bold text-de-accent-ink mb-3">CloudShield (SASE)</h3>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-white/5">
                    <tr><td className="py-2 text-slate-400">Base SASE ({users} users × $29)</td><td className="py-2 text-right font-semibold">${(users * 29).toLocaleString()}</td></tr>
                    {csUplinksPerSite > 0 && <tr><td className="py-2 text-slate-400">SD-WAN Uplinks ({csUplinksPerSite} × {sites} sites × $49)</td><td className="py-2 text-right font-semibold">${(csUplinksPerSite * sites * 49).toLocaleString()}</td></tr>}
                    {csWarmSites > 0 && <tr><td className="py-2 text-slate-400">Warm Spare ({csWarmSites} sites × $59)</td><td className="py-2 text-right font-semibold">${(csWarmSites * 59).toLocaleString()}</td></tr>}
                    {csIpsec > 0 && <tr><td className="py-2 text-slate-400">IPSec Connectors ({csIpsec} × $29)</td><td className="py-2 text-right font-semibold">${(csIpsec * 29).toLocaleString()}</td></tr>}
                    {csIPs > 0 && <tr><td className="py-2 text-slate-400">Cloud IPs ({csIPs} × $19)</td><td className="py-2 text-right font-semibold">${(csIPs * 19).toLocaleString()}</td></tr>}
                    <tr className="border-t border-white/10"><td className="py-2 font-bold text-white">Subtotal MRC</td><td className="py-2 text-right font-bold text-white">${pricing.cloudShieldMRC.toLocaleString()}</td></tr>
                    <tr><td className="py-2 text-slate-400">Setup (one-time)</td><td className="py-2 text-right font-semibold">${pricing.cloudShieldNRC.toLocaleString()}</td></tr>
                  </tbody>
                </table>
              </div>
            )}

            {coreStack && (
              <div className="rounded-xl border border-de-hairline bg-de-bg p-4">
                <h3 className="mb-3 font-bold text-de-accent-ink">CoreStack (Network)</h3>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-white/5">
                    <tr><td className="py-2 text-slate-400">Gateway ({selectedGateway.name} × {sites} sites)</td><td className="py-2 text-right font-semibold">${(gatewayPrice * sites).toLocaleString()}</td></tr>
                    {sw8 > 0 && <tr><td className="py-2 text-slate-400">8-port PoE ({sw8} × {sites} × $19)</td><td className="py-2 text-right font-semibold">${(sw8 * sites * 19).toLocaleString()}</td></tr>}
                    {sw24 > 0 && <tr><td className="py-2 text-slate-400">24-port PoE ({sw24} × {sites} × $39)</td><td className="py-2 text-right font-semibold">${(sw24 * sites * 39).toLocaleString()}</td></tr>}
                    {sw48 > 0 && <tr><td className="py-2 text-slate-400">48-port PoE ({sw48} × {sites} × $69)</td><td className="py-2 text-right font-semibold">${(sw48 * sites * 69).toLocaleString()}</td></tr>}
                    {aps > 0 && <tr><td className="py-2 text-slate-400">WiFi APs ({aps} × {sites} × $15)</td><td className="py-2 text-right font-semibold">${(aps * sites * 15).toLocaleString()}</td></tr>}
                    {tenG && <tr><td className="py-2 text-slate-400">10G Upgrade ({sites} sites × $99)</td><td className="py-2 text-right font-semibold">${(sites * 99).toLocaleString()}</td></tr>}
                    <tr className="border-t border-white/10"><td className="py-2 font-bold text-white">Subtotal MRC</td><td className="py-2 text-right font-bold text-white">${pricing.coreStackMRC.toLocaleString()}</td></tr>
                    <tr><td className="py-2 text-slate-400">Setup (one-time)</td><td className="py-2 text-right font-semibold">${pricing.coreStackNRC.toLocaleString()}</td></tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* CTA */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Button className="bg-[#D3126A] px-8 py-6 text-lg font-semibold text-white hover:bg-[#b80f5c]" data-testid="button-request-quote">
              Request Custom Quote
            </Button>
            <Button variant="outline" className="border-de-hairline px-8 py-6 text-white" data-testid="button-schedule-call">
              Schedule Discovery Call
            </Button>
          </div>
        </section>
      </div>

      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .bg-gradient-to-b { background: white !important; }
          .border-white\\/10 { border-color: #ddd !important; }
          .text-slate-400 { color: #666 !important; }
          .text-white, .text-white/80 { color: black !important; }
        }
      `}</style>
    </div>
  );
}
