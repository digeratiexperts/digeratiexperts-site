**Last updated: {{PUBLISH_DATE}}** · We give clients notice of a new subprocessor at least {{SUBPROCESSOR_NOTICE_DAYS}} (recommended 30) days before it processes their personal data, as described in our Data Processing Addendum. To get notices, email admin@digeratiexperts.com.

| Subprocessor | Purpose | Data | Location | PHI allowed? |
|---|---|---|---|---|
| Zoho Corporation | CRM, help desk, email, accounting and billing, payments (hosted checkout), e-signature, file storage, scheduling, chat widget | Contact, account, ticket, billing, contract and file data | United States data center **[VERIFY US DC]** | Only in Zoho apps covered by Zoho's BAA **[VERIFY]** |
| RackNerd LLC | Virtual private server hosting for the DE Intelligence Hub | All Hub data (tickets, assets, documentation, logs) | United States **[VERIFY facility]** | **[VERIFY — no BAA known; decide before PHI]** |
| Neon (Databricks, Inc.) **[VERIFY owner]** | Managed PostgreSQL for the website, portal and DE Desk | Contact, chat, order and portal data | AWS us-west-2 (Oregon) | No (HIPAA mode off) |
| Cloudflare, Inc. | DNS, content delivery, web application firewall | Traffic metadata, IP addresses | Global network | Transit only |
| OpenAI, L.L.C. | AI model for DE Desk, homepage matcher and Hub assistants | Chat and ticket text | United States | No |
| Anthropic, PBC | AI model for Hub assistants | Ticket and document text | United States | No |
| Telnyx LLC | Phone numbers, voice and messaging | Call metadata, recordings (if enabled), message content | United States | No |
| {{SPEECH_PROVIDER}} | Call transcription and analysis | Call audio and transcripts | United States | No |
| Functional Software, Inc. (Sentry) | Application error monitoring | Error data that may include user IDs | United States | No |
| GitHub, Inc. (Microsoft) | Source code and CI | Code only; no client data by policy | United States | No |
| Qualys, Inc. | Vulnerability scanning (where in the client's tier) | Asset and vulnerability data | United States **[VERIFY]** | Per client agreement |
| JumpCloud Inc. | Identity and device management (where in the client's tier) | User directory and device data | United States **[VERIFY]** | Per client agreement |
| Security stack vendors named in your Order Form (for example Guardz, Blackpoint Cyber, SentinelOne) | Endpoint protection, detection and response, SOC monitoring | Endpoint telemetry, alerts | United States **[VERIFY per vendor]** | Per client agreement and subcontractor BAA |
| {{PASSWORD_VAULT_VENDOR}} | Encrypted storage of client credentials | Credentials | **[VERIFY]** | With BAA if PHI systems |
