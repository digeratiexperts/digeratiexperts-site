# Desktop security and compliance boundary

This document defines control intent; it is not a claim of SOC 2, HIPAA, PCI DSS, ISO 27001, or government certification.

## Trust boundaries

1. The Portal is server-authoritative for identity, tenant, roles, entitlements, and commands.
2. Electron is an unprivileged user interface. Remote Portal content runs with `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, and an allowlisted preload API.
3. Privileged MSP operations belong in a separately installed, signed native service. Electron must never expose a general shell, arbitrary process launcher, raw registry access, or unrestricted filesystem API.
4. The native service may accept only versioned command identifiers from a signed catalog. Every command needs tenant/device binding, authorization, expiry, replay protection, input validation, audit evidence, and a defined rollback.

## Authentication and tenancy

- Use HttpOnly, Secure, SameSite Portal cookies or an OAuth 2.1 device/PKCE flow; do not store bearer tokens in renderer `localStorage`.
- Resolve roles, tenant assignment, and impersonation from live server records on every protected request.
- Bind enrollment to a specific tenant, user, and device key. Rotate credentials and support immediate revocation.
- Store long-lived device secrets only in DPAPI/Windows Credential Manager, macOS Keychain, or a Linux Secret Service backend. Fail closed when an OS-backed secret store is unavailable.

## Privileged broker requirements

- Separate per-user UI from the least-privilege service account.
- Authenticate local IPC with OS ACLs plus a mutually authenticated, short-lived session.
- Maintain an allowlist such as `inventory.collect`, `software.install.catalogItem`, or `support.bundle.create`; never accept command strings.
- Require visible user consent for interactive support, file selection, screenshots, and remote-control sessions unless a signed customer policy explicitly authorizes unattended action.
- Verify package publisher signatures and SHA-256 hashes before installation. Record requester, approver, device, version, result, and rollback status.
- Block path traversal, symlink escapes, network paths, and access outside user-selected files or policy-approved directories.

## Notifications, files, and native UX

- Notification content must be minimal and must not expose sensitive ticket or security details on a locked screen.
- Native file dialogs should return only user-selected handles. File content must be scanned, size-limited, and uploaded directly to an approved endpoint.
- External links, deep links, and IPC messages must use explicit allowlists. Unknown destinations fail closed.
- Native process launches are limited to signed catalog actions or well-known OS settings pages; no renderer-provided executable paths or arguments.

## Release and operations

- Produce signed, reproducible artifacts for each OS. Notarize macOS builds and sign Windows installers and update manifests.
- Use signed differential updates with staged rollout, health checks, rollback, and a kill switch.
- Generate an SBOM, scan dependencies and artifacts, retain build provenance, and document exceptions before release.
- Redact credentials, tokens, file paths, usernames, and ticket content from telemetry. Define retention and deletion policies.
- Validate against the applicable NIST CSF 2.0, CIS Controls v8, SOC 2 criteria, privacy obligations, and customer contractual requirements before enabling privileged features.
