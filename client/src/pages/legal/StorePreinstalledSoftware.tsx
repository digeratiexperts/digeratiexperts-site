import { LegalDocumentLayout } from "@/components/LegalDocumentLayout";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { PREINSTALLED_SOFTWARE_NOTICE, SANITIZATION_PUBLIC_STATEMENT } from "@shared/deStoreLegalCopy";

function Blocks({ text }: { text: string }) {
  return (
    <div className="space-y-4 text-[#3A3448] leading-relaxed whitespace-pre-line">
      {text}
    </div>
  );
}

export default function StorePreinstalledSoftware() {
  return (
    <LegalDocumentLayout
      title="Preinstalled Software Notice"
      subtitle="Draft v2026.10-store. Not published until Joseph approves it."
      description="Notice of Digerati Experts software preinstalled on refurbished kits, and how self-managed buyers may remove it."
      canonical="/legal/preinstalled-software"
    >
      <h2 className="text-2xl font-bold text-[#1A1228] mb-4">Digerati Experts software on this device</h2>
      <Blocks text={PREINSTALLED_SOFTWARE_NOTICE} />
      <h2 className="text-2xl font-bold text-[#1A1228] mb-4 mt-12">How Digerati Experts sanitizes refurbished equipment</h2>
      <Blocks text={SANITIZATION_PUBLIC_STATEMENT} />
      <h2 className="text-2xl font-bold text-[#1A1228] mb-4 mt-12">How to remove Digerati Experts software (Self-Managed buyers)</h2>
      <div className="space-y-4 text-[#3A3448] leading-relaxed">
        <p>You may remove Digerati Experts software at any time. Removing it does not cancel your subscription; cancel in your DE store account (one click). Support for removed software ends when you remove it.</p>
        <p>Option 1 — Ask us. Email admin@digeratiexperts.com or call {PRIMARY_PHONE.display} with the device serial number. We remove the software remotely within two (2) Business Days and confirm by email.</p>
        <p>Option 2 — Do it yourself (Windows): Settings &gt; Apps &gt; Installed apps &gt; select the Digerati Experts program &gt; Uninstall. Repeat for each listed program. If a program asks for an uninstall password, find it in your DE dashboard under Devices &gt; [device] &gt; Removal codes.</p>
        <p>Option 3 — Do it yourself (macOS / Linux): follow the steps for each program at [removal guide URL].</p>
        <p>We do not reinstall removed software unless you ask us to.</p>
        <p>When a subscription ends, we send removal instructions, and tools licensed to Digerati Experts for managed use stop working or are removed as listed on your product page.</p>
      </div>
    </LegalDocumentLayout>
  );
}
