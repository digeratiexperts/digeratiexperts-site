import { LegalDocumentLayout } from "@/components/LegalDocumentLayout";
import { Shield, Lock, Database, FileText, AlertTriangle } from "lucide-react";
import { PRIMARY_PHONE, formatAddressOneLine } from "@/data/companyContact";

export default function PrivacyPolicy() {
  const lastUpdated = "November 13, 2026";

  return (
    <LegalDocumentLayout
      title="Privacy Policy"
      subtitle={`Last Updated: ${lastUpdated}`}
      description="Digerati Experts privacy policy. How we collect, use, and protect personal information in accordance with Arizona and federal laws."
      canonical="/legal/privacy-policy"
      icon={<Shield className="h-5 w-5" />}
    >
            <p className="mb-8 text-lg leading-relaxed text-[#3A3448]">
              Digerati Experts is committed to protecting your privacy and the security of your data.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information
              in accordance with Arizona and federal laws.
            </p>

            {/* Introduction */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1A1228] mb-4">1. Introduction</h2>
              <p className="text-[#3A3448] leading-relaxed">
                Digerati Experts ("we," "our," or "us") is a Managed Security Service Provider (MSP/MSSP) 
                based in Chandler, Arizona. We provide managed IT services, cybersecurity solutions, 
                compliance support, and related technology services to businesses throughout Arizona and beyond.
              </p>
              <p className="text-[#3A3448] leading-relaxed mt-4">
                This Privacy Policy applies to information collected through our website at digeratiexperts.com, 
                our client portal, and in the course of providing our managed services to clients.
              </p>
            </div>

            {/* Information We Collect */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1A1228] mb-4 flex items-center gap-3">
                <Database className="h-5 w-5 text-de-magenta-paper-ink" />
                2. Information We Collect
              </h2>
              
              <h3 className="text-xl font-semibold text-[#1A1228] mb-3 mt-6">2.1 Personal Information</h3>
              <p className="text-[#3A3448] mb-4">We collect personal information that you voluntarily provide when you:</p>
              <ul className="list-disc pl-6 text-[#3A3448] space-y-2 mb-4">
                <li>Request a security assessment or consultation</li>
                <li>Subscribe to our newsletter or security alerts</li>
                <li>Contact us for support or inquiries</li>
                <li>Engage our services as a client</li>
                <li>Access our client portal</li>
                <li>Submit a support ticket</li>
              </ul>

              <p className="text-[#3A3448] mb-4">This may include:</p>
              <ul className="list-disc pl-6 text-[#3A3448] space-y-2 mb-4">
                <li>Name, email address, phone number</li>
                <li>Company name, job title, business address</li>
                <li>Payment and billing information</li>
                <li>Technical information about your IT environment (for service delivery)</li>
                <li>Communications with our support team</li>
              </ul>

              <h3 className="text-xl font-semibold text-[#1A1228] mb-3 mt-6">2.2 Client Data</h3>
              <p className="text-[#3A3448] mb-4">
                When providing managed services, we may have access to and process certain data on behalf of our clients, including:
              </p>
              <ul className="list-disc pl-6 text-[#3A3448] space-y-2 mb-4">
                <li><strong className="text-[#1A1228]">Protected Health Information (PHI)</strong>: For healthcare clients, governed by HIPAA Business Associate Agreements</li>
                <li><strong className="text-[#1A1228]">Cardholder Data</strong>: For clients subject to PCI DSS requirements</li>
                <li><strong className="text-[#1A1228]">System logs and security event data</strong>: Collected through monitoring and security tools</li>
                <li><strong className="text-[#1A1228]">Network traffic metadata</strong>: For security monitoring purposes</li>
                <li><strong className="text-[#1A1228]">Employee account information</strong>: For user management and access control</li>
              </ul>

              <h3 className="text-xl font-semibold text-[#1A1228] mb-3 mt-6">2.3 Automatically Collected Information</h3>
              <p className="text-[#3A3448] mb-4">When you visit our website, we automatically collect:</p>
              <ul className="list-disc pl-6 text-[#3A3448] space-y-2">
                <li>IP address and browser type</li>
                <li>Pages viewed and time spent on pages</li>
                <li>Referring website addresses</li>
                <li>Operating system and device information</li>
                <li>Cookies and similar tracking technologies (see Section 8)</li>
              </ul>
            </div>

            {/* How We Use Information */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1A1228] mb-4">3. How We Use Your Information</h2>
              
              <h3 className="text-xl font-semibold text-[#1A1228] mb-3 mt-6">3.1 Service Delivery</h3>
              <ul className="list-disc pl-6 text-[#3A3448] space-y-2 mb-4">
                <li>Provide 24/7 security monitoring and incident response</li>
                <li>Manage and maintain IT infrastructure and systems</li>
                <li>Detect, prevent, and respond to security threats</li>
                <li>Perform vulnerability assessments and penetration testing</li>
                <li>Backup and disaster recovery services</li>
                <li>Compliance monitoring and reporting (HIPAA, PCI DSS, etc.)</li>
              </ul>

              <h3 className="text-xl font-semibold text-[#1A1228] mb-3 mt-6">3.2 Business Operations</h3>
              <ul className="list-disc pl-6 text-[#3A3448] space-y-2 mb-4">
                <li>Respond to inquiries and provide customer support</li>
                <li>Process payments and manage billing</li>
                <li>Send service notifications and security alerts</li>
                <li>Improve our services and develop new offerings</li>
                <li>Conduct internal analytics and research</li>
                <li>Comply with legal and regulatory obligations</li>
              </ul>

              <h3 className="text-xl font-semibold text-[#1A1228] mb-3 mt-6">3.3 Marketing Communications</h3>
              <p className="text-[#3A3448]">
                With your consent, we may send marketing emails about our services, security advisories, 
                webinars, and industry insights. You may opt out at any time using the unsubscribe link in our emails.
              </p>
            </div>

            {/* Data Security */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1A1228] mb-4 flex items-center gap-3">
                <Lock className="h-5 w-5 text-de-magenta-paper-ink" />
                4. Data Security Measures
              </h2>
              <p className="text-[#3A3448] mb-4">
                As a cybersecurity provider, we implement industry-leading security measures to protect your information:
              </p>
              
              <h3 className="text-xl font-semibold text-[#1A1228] mb-3 mt-6">4.1 Technical Safeguards</h3>
              <ul className="list-disc pl-6 text-[#3A3448] space-y-2 mb-4">
                <li><strong className="text-[#1A1228]">Encryption</strong>: AES-256 encryption for data at rest; TLS 1.3 for data in transit</li>
                <li><strong className="text-[#1A1228]">Access Controls</strong>: Role-based access control (RBAC) and multi-factor authentication (MFA)</li>
                <li><strong className="text-[#1A1228]">Network Security</strong>: Next-generation firewalls, intrusion detection/prevention systems</li>
                <li><strong className="text-[#1A1228]">Endpoint Protection</strong>: Advanced endpoint detection and response (EDR) on all systems</li>
                <li><strong className="text-[#1A1228]">Security Monitoring</strong>: 24/7 Security Operations Center (SOC) monitoring</li>
                <li><strong className="text-[#1A1228]">Vulnerability Management</strong>: Regular security scans and patch management</li>
              </ul>

              <h3 className="text-xl font-semibold text-[#1A1228] mb-3 mt-6">4.2 Administrative Safeguards</h3>
              <ul className="list-disc pl-6 text-[#3A3448] space-y-2 mb-4">
                <li>Security policies and procedures aligned with NIST Cybersecurity Framework</li>
                <li>Regular security awareness training for all employees</li>
                <li>Background checks for employees with access to sensitive data</li>
                <li>Incident response and business continuity plans</li>
                <li>Annual security audits and penetration testing</li>
              </ul>

              <h3 className="text-xl font-semibold text-[#1A1228] mb-3 mt-6">4.3 Security & Compliance Support</h3>
              <ul className="list-disc pl-6 text-[#3A3448] space-y-2">
                <li>HIPAA-aligned security and compliance support, including Business Associate Agreements for healthcare clients</li>
                <li>SOC 2 readiness and control alignment for customer programs (Digerati Experts is not SOC 2 Type II certified)</li>
                <li>Cyber insurance readiness and security/compliance reporting support</li>
                <li>Staff credentials are published on our <a href="/about/team" className="underline underline-offset-2">Team page</a>, each with a link to the issuer's verification record</li>
              </ul>
            </div>

            {/* Arizona Data Breach Notification */}
            <div className="mb-12 border border-[var(--de-paper-hairline)] border-l-4 border-l-[#D3126A] bg-white p-6 rounded">
              <h2 className="text-2xl font-bold text-[#1A1228] mb-4 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-700" />
                5. Arizona Data Breach Notification
              </h2>
              <p className="text-[#3A3448] mb-4">
                In compliance with Arizona Revised Statutes § 18-545, we will notify affected individuals 
                and the Arizona Attorney General in the event of a data breach involving unencrypted personal information.
              </p>
              
              <h3 className="text-xl font-semibold text-[#1A1228] mb-3 mt-6">5.1 Personal Information Covered</h3>
              <p className="text-[#3A3448] mb-4">
                Arizona law defines personal information as your first name or initial and last name combined with:
              </p>
              <ul className="list-disc pl-6 text-[#3A3448] space-y-2 mb-4">
                <li>Social Security number</li>
                <li>Driver's license or Arizona identification card number</li>
                <li>Financial account numbers, credit/debit card numbers with security codes</li>
                <li>Medical or health insurance information</li>
                <li>Biometric data (fingerprints, voiceprints, retina scans)</li>
                <li>Username/email with password or security question answers</li>
              </ul>

              <h3 className="text-xl font-semibold text-[#1A1228] mb-3 mt-6">5.2 Notification Timeline</h3>
              <p className="text-[#3A3448] mb-4">
                We will provide notice of any breach affecting personal information <strong className="text-[#1A1228]">within 45 days</strong> of discovery, 
                unless a law enforcement agency determines that notification would impede a criminal investigation.
              </p>

              <h3 className="text-xl font-semibold text-[#1A1228] mb-3 mt-6">5.3 Notification Method</h3>
              <p className="text-[#3A3448]">
                Notification will be provided by email, written notice, or telephone. If 1,000 or more Arizona 
                residents are affected, we will also notify the three major credit bureaus (TransUnion, Equifax, Experian).
              </p>
            </div>

            {/* Information Sharing */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1A1228] mb-4">6. Information Sharing and Disclosure</h2>
              
              <h3 className="text-xl font-semibold text-[#1A1228] mb-3 mt-6">6.1 We Do NOT Sell Your Data</h3>
              <p className="text-[#3A3448] mb-4">
                <strong className="text-[#1A1228]">We do not sell, rent, or trade your personal information to third parties.</strong> Your data 
                is used solely for providing our services and protecting your security.
              </p>

              <h3 className="text-xl font-semibold text-[#1A1228] mb-3 mt-6">6.2 Service Providers</h3>
              <p className="text-[#3A3448] mb-4">We may share information with trusted service providers who assist us:</p>
              <ul className="list-disc pl-6 text-[#3A3448] space-y-2 mb-4">
                <li>Cloud infrastructure providers (with Business Associate Agreements for HIPAA compliance)</li>
                <li>Security tool vendors (SIEM, EDR, vulnerability scanning platforms)</li>
                <li>Payment processors for billing services</li>
                <li>Professional service providers (legal, accounting, insurance)</li>
              </ul>
              <p className="text-[#3A3448] mb-4">
                All service providers are contractually required to maintain the confidentiality and security of your information.
              </p>

              <h3 className="text-xl font-semibold text-[#1A1228] mb-3 mt-6">6.3 Legal Obligations</h3>
              <p className="text-[#3A3448] mb-4">We may disclose information when required by law:</p>
              <ul className="list-disc pl-6 text-[#3A3448] space-y-2">
                <li>In response to valid legal process (subpoenas, court orders)</li>
                <li>To comply with data breach notification laws</li>
                <li>To protect our rights, property, or safety</li>
                <li>To prevent fraud or criminal activity</li>
                <li>With your explicit consent</li>
              </ul>
            </div>

            <div className="mb-12" id="chat-recording">
              <h2 className="text-2xl font-bold text-[#1A1228] mb-4">7. Chat and call recording and AI processing</h2>

              <h3 className="text-xl font-semibold text-[#1A1228] mb-3 mt-6">Website and Portal Chat (DE Desk)</h3>
              <p className="text-[#3A3448] leading-relaxed mb-4">
                <strong className="text-[#1A1228]">What we collect.</strong> When you use the chat window on our website or client portal ("DE Desk"), we collect the messages you type and receive, the time of each message, the page you were on, your browser and device type, IP address and approximate location derived from it, and any name, email, phone number, company, or ticket details you provide. If you describe your situation in the box on our homepage, that description is handled the same way: it is sent to our AI service provider to suggest services and kept with your chat session. It is saved to an IT &amp; Security Profile only if you later choose to save a draft.
              </p>
              <p className="text-[#3A3448] leading-relaxed mb-4">
                <strong className="text-[#1A1228]">Recording and storage.</strong> We record and store chat transcripts. You will see a notice before the chat starts, and by continuing you agree to this recording. If you do not agree, do not use chat — you can email or call us instead.
              </p>
              <p className="text-[#3A3448] leading-relaxed mb-4">
                <strong className="text-[#1A1228]">Automated (AI) responses.</strong> DE Desk uses an artificial-intelligence model provided by a third-party AI service provider to read your messages and draft or send replies. Your chat messages are sent to that provider in real time to generate a response. A DE staff member may review the conversation and take over. Replies generated by AI may be inaccurate; a DE staff member confirms anything that affects your services, billing, or security before we act on it.
              </p>
              <p className="text-[#3A3448] leading-relaxed mb-4">
                <strong className="text-[#1A1228]">Our service providers for chat.</strong> We use (a) an AI model provider to process chat content and generate replies, and (b) a cloud database hosting provider to store transcripts. We require each provider by contract to use chat content only to provide its service to us (and, where its terms allow, to detect abuse and comply with law), to protect it with reasonable security, and <strong className="text-[#1A1228]">not to use it to train or improve its own AI models</strong>. A current list of these providers is available on request.
              </p>
              <p className="text-[#3A3448] leading-relaxed mb-4">
                <strong className="text-[#1A1228]">Why we use it.</strong> To answer your questions, open and route support tickets, verify that you are an authorized contact before discussing an account, improve our own support processes, keep records of what was requested, and protect our systems.
              </p>
              <p className="text-[#3A3448] leading-relaxed mb-4">
                <strong className="text-[#1A1228]">Retention.</strong> We keep chat transcripts for {"{{CHAT_RETENTION}}"} after the conversation, or longer if they become part of a support ticket, a contract record, or a legal hold. Our AI model provider may keep chat content for up to 30 days for abuse monitoring unless a shorter period applies.
              </p>
              <p className="text-[#3A3448] leading-relaxed mb-4">
                <strong className="text-[#1A1228]">Sensitive information.</strong> Please do not type passwords, payment card numbers, health information, or Social Security numbers into chat. If you do, we will delete them from the transcript when we notice.
              </p>
              <p className="text-[#3A3448] leading-relaxed mb-4">
                <strong className="text-[#1A1228]">Children.</strong> DE Desk and our services are for businesses and are not directed to children under 13 [or 18]. We do not knowingly collect information from children.
              </p>

              <h3 className="text-xl font-semibold text-[#1A1228] mb-3 mt-6">Phone Calls: Recording and AI Analysis</h3>
              <p className="text-[#3A3448] leading-relaxed mb-4">
                <strong className="text-[#1A1228]">Announcement first.</strong> Calls to and from DE may be recorded. On inbound calls, an announcement plays <strong className="text-[#1A1228]">before</strong> any recording starts. On outbound calls, our staff tell you at the start of the call. Recording does not begin until the announcement has finished.
              </p>
              <p className="text-[#3A3448] leading-relaxed mb-4">
                <strong className="text-[#1A1228]">What we do with recordings.</strong> We record calls and create transcripts to document support requests, verify instructions, train our own staff, and review quality. We use AI speech-to-text and analysis tools to transcribe calls, summarize them, and grade call quality. These tools may be provided by third-party service providers, which are contractually barred from using our call recordings or transcripts to train or improve their own models or for any purpose other than providing the service to DE. Where a provider will not agree to those terms, we run the analysis on our own systems.
              </p>
              <p className="text-[#3A3448] leading-relaxed mb-4">
                <strong className="text-[#1A1228]">How to opt out.</strong> At the start of any call, say "do not record." Recording and AI analysis stop for that call, and we log your choice. You can also ask us at any time to stop recording your calls by emailing{" "}
                <a href="mailto:admin@digeratiexperts.com">admin@digeratiexperts.com</a>. Opting out does not affect the service we provide; some requests (for example, changes to account authority) may need written confirmation instead.
              </p>
              <p className="text-[#3A3448] leading-relaxed mb-4">
                <strong className="text-[#1A1228]">Retention.</strong> Recordings: {"{{CHAT_RETENTION}}"}. Transcripts and summaries: {"{{CHAT_RETENTION}}"} or as part of the related ticket. Longer if required for a legal hold or dispute.
              </p>
              <p className="text-[#3A3448] leading-relaxed mb-4">
                <strong className="text-[#1A1228]">Voice service customers.</strong> If you buy voice (phone) service from DE, information about your calls (customer proprietary network information, or CPNI) is protected under federal law and our CPNI policy. We do not record your calls with third parties on our voice service unless you configure recording yourself; if you do, you are responsible for giving any notice and getting any consent the law requires.
              </p>

              <h3 className="text-xl font-semibold text-[#1A1228] mb-3 mt-6">Laws About Recording and Chat in Some States</h3>
              <p className="text-[#3A3448] leading-relaxed">
                Some states — including California — require the consent of everyone in a conversation before it is recorded or before its contents are read by someone outside the conversation while it is in transit. To respect those laws everywhere, DE announces recording to every caller and shows a chat notice to every visitor, regardless of where they are, and offers an opt-out (calls) or an alternative channel (chat).
              </p>
            </div>

            {/* Data Retention */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1A1228] mb-4">8. Data Retention and Deletion</h2>
              <p className="text-[#3A3448] mb-4">
                We retain your information only as long as necessary to provide services and comply with legal obligations:
              </p>
              <ul className="list-disc pl-6 text-[#3A3448] space-y-2 mb-4">
                <li><strong className="text-[#1A1228]">Client Data</strong>: Retained per your Master Service Agreement, typically through contract term + 7 years</li>
                <li><strong className="text-[#1A1228]">Security Logs</strong>: Retained for 1 year minimum (compliance requirements may extend this)</li>
                <li><strong className="text-[#1A1228]">Backups</strong>: Retained per backup retention policy (typically 30-90 days)</li>
                <li><strong className="text-[#1A1228]">Marketing Data</strong>: Until you opt out or request deletion</li>
                <li><strong className="text-[#1A1228]">Billing Records</strong>: 7 years per tax and accounting requirements</li>
              </ul>

              <h3 className="text-xl font-semibold text-[#1A1228] mb-3 mt-6">8.1 Secure Deletion</h3>
              <p className="text-[#3A3448]">
                When data is deleted, we use secure deletion methods including cryptographic erasure, overwriting, 
                and physical destruction of storage media per NIST SP 800-88 guidelines.
              </p>
            </div>

            {/* Cookies */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1A1228] mb-4">9. Cookies and Tracking Technologies</h2>
              <p className="text-[#3A3448] mb-4">
                Our website uses cookies and similar technologies to improve your experience:
              </p>
              <ul className="list-disc pl-6 text-[#3A3448] space-y-2 mb-4">
                <li><strong className="text-[#1A1228]">Essential Cookies</strong>: Required for website functionality and security</li>
                <li><strong className="text-[#1A1228]">Analytics Cookies</strong>: Help us understand how visitors use our site</li>
                <li><strong className="text-[#1A1228]">Preference Cookies</strong>: Remember your settings and preferences</li>
              </ul>
              <p className="text-[#3A3448]">
                You can control cookies through your browser settings. Note that disabling cookies may affect 
                website functionality.
              </p>
            </div>

            {/* Your Rights */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1A1228] mb-4">10. Your Privacy Rights</h2>
              <p className="text-[#3A3448] mb-4">You have the following rights regarding your personal information:</p>
              <ul className="list-disc pl-6 text-[#3A3448] space-y-2 mb-4">
                <li><strong className="text-[#1A1228]">Access</strong>: Request a copy of the personal information we hold about you</li>
                <li><strong className="text-[#1A1228]">Correction</strong>: Request correction of inaccurate or incomplete information</li>
                <li><strong className="text-[#1A1228]">Deletion</strong>: Request deletion of your personal information (subject to legal retention requirements)</li>
                <li><strong className="text-[#1A1228]">Opt-Out</strong>: Unsubscribe from marketing communications at any time</li>
                <li><strong className="text-[#1A1228]">Data Portability</strong>: Request your data in a portable format</li>
                <li><strong className="text-[#1A1228]">Restriction</strong>: Request restriction of processing in certain circumstances</li>
              </ul>

              <p className="text-[#3A3448] mb-4">
                To exercise these rights, contact us at <strong className="text-[#1A1228]">privacy@digeratiexperts.com</strong> or call <strong className="text-[#1A1228]">{PRIMARY_PHONE.display}</strong>.
              </p>

              <p className="text-[#3A3448]">
                We will respond to your request within 30 days. Please note that some requests may require identity verification.
              </p>
            </div>

            {/* HIPAA Clients */}
            <div className="mb-12 border border-[var(--de-paper-hairline)] border-l-4 border-l-[#D3126A] bg-white p-6 rounded">
              <h2 className="text-2xl font-bold text-[#1A1228] mb-4">11. HIPAA-Covered Clients</h2>
              <p className="text-[#3A3448] mb-4">
                For healthcare clients handling Protected Health Information (PHI), we act as a Business Associate 
                under HIPAA regulations:
              </p>
              <ul className="list-disc pl-6 text-[#3A3448] space-y-2 mb-4">
                <li>All PHI access is governed by executed Business Associate Agreements (BAAs)</li>
                <li>We implement HIPAA-compliant security controls per 45 CFR § 164.308-164.316</li>
                <li>Breach notification follows HIPAA Breach Notification Rule timelines</li>
                <li>PHI is never used for marketing without authorization</li>
                <li>Subcontractors handling PHI also sign BAAs</li>
              </ul>
              <p className="text-[#3A3448]">
                For HIPAA-specific privacy practices, please refer to your Business Associate Agreement.
              </p>
            </div>

            {/* Third-Party Links */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1A1228] mb-4">12. Third-Party Links</h2>
              <p className="text-[#3A3448]">
                Our website may contain links to third-party websites. We are not responsible for the privacy 
                practices of these external sites. We encourage you to review their privacy policies before 
                providing any personal information.
              </p>
            </div>

            {/* Children's Privacy */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1A1228] mb-4">13. Children's Privacy</h2>
              <p className="text-[#3A3448]">
                Our services are not directed to individuals under 18 years of age. We do not knowingly collect 
                personal information from children. If you believe we have collected information from a child, 
                please contact us immediately.
              </p>
            </div>

            {/* International Data Transfers */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1A1228] mb-4">14. International Data Transfers</h2>
              <p className="text-[#3A3448]">
                Our services are primarily provided within the United States. We do not routinely transfer data 
                internationally. If international transfers are necessary, we implement appropriate safeguards 
                such as Standard Contractual Clauses.
              </p>
            </div>

            {/* Changes to Privacy Policy */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1A1228] mb-4">15. Changes to This Privacy Policy</h2>
              <p className="text-[#3A3448]">
                We may update this Privacy Policy periodically to reflect changes in our practices or applicable laws. 
                We will notify clients of material changes via email or prominent website notice. The "Last Updated" 
                date at the top of this policy indicates when it was last revised.
              </p>
            </div>

            {/* Contact Information */}
            <div className="mb-12 border border-[var(--de-paper-hairline)] bg-white border-l-4 border-l-[#D3126A] p-6 rounded">
              <h2 className="text-2xl font-bold text-[#1A1228] mb-4 flex items-center gap-3">
                <FileText className="h-5 w-5 text-de-magenta-paper-ink" />
                16. Contact Us
              </h2>
              <p className="text-[#3A3448] mb-4">
                If you have questions about this Privacy Policy or wish to exercise your privacy rights, please contact:
              </p>
              
              <div className="border border-[var(--de-paper-hairline)] bg-white p-4 rounded-lg">
                <p className="text-[#1A1228] font-semibold mb-2">Digerati Experts - Privacy Team</p>
                <p className="text-[#3A3448]"><strong className="text-[#1A1228]">Email:</strong> privacy@digeratiexperts.com</p>
                <p className="text-[#3A3448]"><strong className="text-[#1A1228]">Phone:</strong> {PRIMARY_PHONE.display}</p>
                <p className="text-[#3A3448]"><strong className="text-[#1A1228]">Address:</strong> {formatAddressOneLine()}</p>
                <p className="text-[#3A3448] mt-3"><strong className="text-[#1A1228]">Office Hours:</strong> Monday-Friday 7:00 AM - 6:00 PM MST</p>
                <p className="text-[#3A3448]"><strong className="text-[#1A1228]">Emergency Contact:</strong> Available 24/7 for active clients</p>
              </div>
            </div>

            {/* Effective Date */}
            <div className="mt-12 pt-8 border-t border-[var(--de-paper-hairline)]">
              <p className="text-[#4A4458] text-sm">
                This Privacy Policy is effective as of {lastUpdated} and governs our privacy practices.
              </p>
              <p className="text-[#4A4458] text-sm mt-2">
                © {new Date().getFullYear()} Digerati Experts. All rights reserved.
              </p>
            </div>
    </LegalDocumentLayout>
  );
}
