import { PRIMARY_PHONE } from "@/data/companyContact";
export const DigeratiFooterSection = (): JSX.Element => {
  return (
    <footer className="bg-de-bg text-white py-12">
      <div className="max-w-[var(--de-canvas)] mx-auto px-3 sm:px-4 lg:px-6">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <h3 className="mb-4 text-2xl font-bold text-white">
              Digerati Experts
            </h3>
            <p className="text-gray-400 mb-4">
              Elite IT & Cybersecurity Services
            </p>
            <p className="text-gray-400 text-sm">
              Arizona's Trusted Managed Security Service Provider
            </p>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-4">Services</h4>
            <ul className="space-y-2">
              <li><a href="/solutions/security-operations" className="text-gray-400 hover:text-white transition-colors duration-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-bg)] rounded px-1">Managed Security</a></li>
              <li><a href="/solutions/managed-it-support" className="text-gray-400 hover:text-white transition-colors duration-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-bg)] rounded px-1">Managed IT</a></li>
              <li><a href="/solutions/compliance-reports" className="text-gray-400 hover:text-white transition-colors duration-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-bg)] rounded px-1">Compliance Services</a></li>
              <li><a href="/solutions/threat-detection" className="text-gray-400 hover:text-white transition-colors duration-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-bg)] rounded px-1">Incident Response</a></li>
              <li><a href="/solutions/security-awareness" className="text-gray-400 hover:text-white transition-colors duration-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-bg)] rounded px-1">Security Training</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-4">Industries</h4>
            <ul className="space-y-2">
              <li><a href="/industries/healthcare" className="text-gray-400 hover:text-white transition-colors">Healthcare</a></li>
              <li><a href="/industries/accounting-finance" className="text-gray-400 hover:text-white transition-colors">Financial Services</a></li>
              <li><a href="/industries/law-firms" className="text-gray-400 hover:text-white transition-colors">Legal</a></li>
              <li><a href="/industries/nonprofits" className="text-gray-400 hover:text-white transition-colors">Nonprofits</a></li>
              <li><a href="/industries/real-estate" className="text-gray-400 hover:text-white transition-colors">Real Estate</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-4">Resources</h4>
            <ul className="space-y-2">
              <li><a href="/resources/blog" className="text-gray-400 hover:text-white transition-colors">DE Journal</a></li>
              <li><a href="/resources/security-updates" className="text-gray-400 hover:text-white transition-colors">Threat Intelligence</a></li>
              <li><a href="/resources/case-studies" className="text-gray-400 hover:text-white transition-colors">Case Studies</a></li>
              <li><a href="/legal/privacy-policy" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="/legal/terms-of-use" className="text-gray-400 hover:text-white transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-center md:text-left">
              © {new Date().getFullYear()} Digerati Experts. All rights reserved. | Security & Compliance Support | Cybersecurity-First MSP
            </p>
            <div className="mt-4 md:mt-0 flex items-center space-x-4">
              <span className="text-gray-400">24/7 Emergency:</span>
              <a href={PRIMARY_PHONE.telHref} className="text-de-accent-ink font-semibold hover:text-white">
                {PRIMARY_PHONE.display}
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};