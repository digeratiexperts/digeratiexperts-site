# mTLS on the agent connection

**Move 63** of the 104-move plan ([issue #781](https://github.com/digeratiexperts/digeratiexperts-site/issues/781)).
**Design only.** Nothing here is built, enabled or sent anywhere. It specifies how the DE Tech Agent and the Hub
authenticate each other on every connection, so that the service (68), heartbeat (69), evidence upload (70) and the job
queue build against one transport. The proxy and Hub work lives in `digeratiexperts/Intelligence-Hub` and the server's
deployment, and needs its own pull request and Joe's explicit merge approval there.

It answers **S2** (something impersonates the Hub) and **I3** (the channel is eavesdropped) of
[AGENT-THREAT-MODEL.md](AGENT-THREAT-MODEL.md). The certificate this relies on is the move 62 design (the per-device certificate profile); renewal is move 64.

## 1. The shape of it

- **Outbound only.** The agent opens every connection; no client device listens on anything (a hard rule of the threat model).
- **Both ends prove themselves.** The agent proves it is an active, enrolled device with its client certificate. The Hub
  proves it is the Hub with a server key the agent **pinned at install time**, not one any response told it to trust (S2).
- **A dedicated hostname.** Agent traffic uses its own hostname (name to be chosen by Joe) on the Hub's server, with client
  certificates **required** at the TLS layer. Staff and portal traffic stay on the ordinary hostname with no client
  certificate. A request can therefore not reach the agent routes without a certificate that verified.
- **TLS 1.2 or higher, nothing weaker.** TLS 1.3 where the device has it.
- **Authentication is not authorisation.** A verified certificate gets a request to the application, which then checks the
  Hub's own device table (move 62) before it does anything.

## 2. The server side

TLS terminates at the reverse proxy. It requires and verifies the client certificate against the device intermediate, and
passes the verified identity to the application over a loopback or unix socket, in headers it **sets itself** (a
`proxy_set_header` replaces any value the client sent, so there is nothing to strip separately):

<!-- snippet:nginx -->
```nginx
server {
    listen 443 ssl;
    server_name agent.example.invalid;            # the dedicated agent hostname

    ssl_protocols             TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_tickets       off;
    ssl_verify_client         on;                 # never optional on this hostname
    ssl_verify_depth          2;
    ssl_client_certificate    /etc/intelligence-hub/techagent/device-ca-bundle.pem;

    client_max_body_size      1m;

    location /api/techagent/ {
        proxy_set_header X-DE-Client-Cert-Verify      $ssl_client_verify;
        proxy_set_header X-DE-Client-Cert-Fingerprint $ssl_client_fingerprint;
        proxy_set_header X-DE-Client-Cert-Serial      $ssl_client_serial;
        proxy_pass http://unix:/run/intelligence-hub/api.sock;
    }
}
```

- The application accepts a request only when `X-DE-Client-Cert-Verify` is `SUCCESS` **and** the serial is `active` in its table.
  It listens on the socket only, so those headers cannot arrive from the network.
- **No CRL.** Revocation is the Hub's table, checked on every request (move 62); the proxy only proves the certificate chains
  to the device intermediate and has not expired.
- The trust bundle holds the current intermediate and, during a replacement, the old one as well (move 64).
- Session tickets are off so a resumed session cannot outlive the certificate that opened it.
- The body cap is a backstop; the application enforces its own, smaller limits per route.

## 3. The agent side

The agent connects with its client certificate and **verifies the server by pinned public key**. The pins are written at
install from the installer, never taken from a response:

<!-- example:connection-profile -->
```json
{
  "hubHost": "agent.example.invalid",
  "hubPort": 443,
  "minTlsVersion": "1.2",
  "serverPublicKeySha256Pins": [
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB="
  ],
  "clientCertificateSubject": "3c9b1f28-5d4e-4a7b-8f60-2e1d9a7c5b34",
  "requireTimeSync": true
}
```

- **Two pins, always:** the Hub's current server public key and a **backup key generated and stored offline**. Pinning the
  key rather than the certificate lets the certificate renew without breaking agents; replacing the key means pinning the
  backup into builds first (move 64 and the installer).
- **The pin check is in addition to normal chain validation, not instead of it.** A connection that fails either is refused.
- **No bypass, ever.** The agent never sets a certificate-validation callback that accepts everything, never skips the
  check, and never narrows the allowed TLS versions. A test holds the whole shipped tree to that today (below).
- **This file is part of what `integrity.json` covers** and is writable only by SYSTEM and Administrators (TB4). A tampered
  profile reports itself tampered, as every other trust file does.
- **The private key is the TPM-backed, non-exportable key from move 62.** The agent asks the platform to sign; it never reads key bytes.
- **Runtime:** Windows PowerShell 5.1 on .NET Framework 4.7.2 or later: an HTTP client with the client certificate attached
  and a server-certificate callback that compares the public-key hash to the pins and otherwise returns the platform's own verdict.

## 4. What happens when it fails

| What fails | The agent | The Hub | Why |
|---|---|---|---|
| Server key matches no pin (including a TLS-inspecting middlebox) | Refuses the connection. Logs locally and shows the state on the device. Backs off. **Sends nothing**: it has no trusted party to tell | Sees no request | A pin mismatch is a possible impersonation (S2), and a client network that inspects TLS must exempt the agent hostname |
| Client certificate expired or revoked | Handshake fails or `403`. Stops requesting work, keeps local functions and its queue (D3, move 76), and reports the state locally | Refuses; audits | Revocation and expiry must stop the agent, and be seen (move 75) |
| Device clock wrong | Does not attempt TLS until the time check passes (`net.time` gate). Never sets the clock itself | n/a | Certificate validity and the job window depend on time (D4) |
| Proxy or Hub unreachable | Backs off (60 s to 5 min with jitter). Local functions keep working; evidence queues, bounded | n/a | Hub down is not an outage of the tool (D3) |
| `X-DE-Client-Cert-Verify` is not `SUCCESS`, or the headers are missing | n/a | `401 no_client_certificate`; audits | Nothing reaches an agent route unverified |

## 5. Rules the repository holds itself to now

The design leans on one thing the existing code can already prove: **no shipped script weakens TLS.** The suite for this
document scans the whole shipped tree (scripts, modules and launchers, not the tests) and fails if any file installs a
certificate-validation callback, skips the check, or sets the allowed protocols to anything other than the current set plus TLS 1.2.
Today there are none. The agent, when it is built, is held to the same scan.

## 6. Out of scope

Issuing certificates and revoking them (62), renewal and CA replacement (64), the Windows service and its state store (68),
the Hub's TLS certificate management and the proxy's deployment, and the client networks' own TLS policy.

## 7. Decisions this design asks for

1. **A dedicated agent hostname** with client certificates required, rather than client certificates optional on the Hub's main hostname.
2. **Pin the Hub's server public key, two pins**, current and an offline backup, in addition to normal chain validation.
3. **TLS 1.2 floor**, and a documented requirement that client networks which inspect TLS exempt the agent hostname.
4. **No CRL or OCSP**: the Hub's own table is the revocation authority (as in move 62).
