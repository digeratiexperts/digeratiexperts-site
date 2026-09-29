1. Normalized table:
   - CVE-2024-3400 | FW-EDGE-01 | CVSS 10 | KEV yes | EPSS 0.94 | internet-facing | critical asset | confirmed version | rank 5: exploited in the wild on the site edge.
   - Outdated Chrome (one KEV CVE) | 22 workstations | CVSS 8.8 | KEV yes | EPSS 0.31 | user-driven exposure | standard | RMM inventory | rank 4.
   - CVE-2023-48795 (SSH Terrapin) | 14 internal build hosts | CVSS 5.9 | KEV no | EPSS 0.02 | internal only | medium | banner evidence | rank 2.
2. Top remediations: 1) firewall hotfix tonight in an emergency window, owner Tier 3, verify by version check, retest tomorrow; 2) force the Chrome update through the RMM today, owner Tier 2, verify by inventory report, retest in 48 hours; 3) SSH cipher hardening after the Friday freeze, owner Tier 2, retest the following week.
3. Compensating controls: if the hotfix must wait, disable the affected portal feature; residual risk for that vector is removed; expiry 72 hours.
4. Effort and impact: about 2 hours, 1 hour and 4 hours; the rank-5 count drops to zero after item 1.
5. Client summary: One critical fix on your firewall tonight, a browser update on every computer today, and a low-risk hardening task after the change freeze. We need a 30-minute window after hours tonight.
6. Data quality notes: two duplicate Chrome findings merged; one build host appears under two names.
