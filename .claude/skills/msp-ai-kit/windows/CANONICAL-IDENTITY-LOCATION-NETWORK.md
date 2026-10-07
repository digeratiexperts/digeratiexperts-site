# DE Tech Tool projection: canonical identity, location, and network standard

**Projection version:** 1.0.0  
**Tech Tool release:** 1.11.0  
**Authority:** Digerati Experts Intelligence Hub, `docs/de-canonical/08_DE_IDENTITY_LOCATION_NETWORK_STANDARD.md`

This file documents the Windows/endpoint projection. It is not a second source of truth. When this file or DE Tech Tool disagrees with the Hub standard, the Hub standard wins and the projection must be repaired.

## Identity projection

- W-2 employees and owners: `firstname.lastname@clientdomain`.
- Contractors, vendors, and other external people: `firstname.lastname-ext@clientdomain`.
- Administrative identity: add `-admin` before the external marker.
- Privileged-provisioning identity: add `-priv` before the external marker.
- Tech Level 1/2/3 remains RBAC/eligibility, never part of a username.
- Name collisions use middle initial first when available, then deterministic numbers.
- `-ext` remains the final person-class suffix.

Examples:

```text
jane.smith@client.example
john.doe-ext@client.example
jane.smith-admin@client.example
john.doe-admin-ext@client.example
jane.smith-priv@client.example
john.doe-priv-ext@client.example
```

A Windows local username uses the same canonical stem when the platform permits it. Windows/platform length limits are validated rather than silently truncating an identity. Inherited takeover mappings may remain documented exceptions.

## Recovery and emergency access

These are different controls:

- Windows endpoint recovery: `DE-BreakGlass`.
- Tenant/cloud emergency access: `emergency-admin-01` and `emergency-admin-02`.

Do not replace one with the other and do not use a technician's daily/admin account as break glass.

## Device naming

Canonical new-device pattern:

```text
<CLIENT>-<ROLE>-<ASSET4>
```

Location is deliberately excluded. Tech Tool accepts a four-character asset token when supplied and uses a four-character serial-derived provisioning fallback when the Hub asset token is not yet available. A custom inherited pattern may remain, but it must fit Windows' 15-character limit without truncating a unique token.

## Location projection

Canonical physical path:

```text
<COUNTRY>-<REGION>-<CITY>-S##[-B##][-F##][-R####][-(D|C)###]
```

Example:

```text
US-AZ-CHD-S01-B01-F02-R0215-D007
```

Remote location is privacy-safe, for example:

```text
US-AZ-REM
```

Room, desk, and cube are location metadata. They do not become hostname or IP-address digits.

## Network projection

Two modes exist:

- `de-net-new`: the Hub has assigned a non-overlapping RFC1918 client block; Tech Tool may derive the site and functional subnet plan.
- `adopt-existing`: discover and document the inherited network; do not renumber it merely to make a diagram prettier.

The standard net-new projection is client `/16` → site `/20` → functional `/24` segments. Tech Tool never chooses a client's global block by hash, account number, or modulo. The Hub allocation registry owns that decision.

Functional defaults are management, infrastructure, corporate wired, corporate wireless, voice, printers/IoT, cameras/physical security, guest, OT/warehouse, POS/kiosk, security tooling, DMZ, and transit/VPN, with remaining site slots reserved.

Full host-level IPAM, DNS lifecycle, IPv6 inventory, controller synchronization, and collision allocation remain Intelligence Hub Client Environment responsibilities.

## Profile keys

DE Tech Tool client profiles carry the projection under:

```text
identity.primaryDomain
identity.usernameConvention
identity.naming.standardVersion
identity.naming.externalSuffix
identity.naming.adminSuffix
identity.naming.privilegedSuffix
identity.naming.tenantEmergencyAccounts
identity.naming.techLevelIsRbac

branding.hostnamePattern

network.addressPlan.standardVersion
network.addressPlan.mode
network.addressPlan.clientCidr
network.addressPlan.sitePrefix
network.addressPlan.segmentPrefix

sites[].code
sites[].ordinal
sites[].country
sites[].region
sites[].cityCode
```

The profile stores policy and non-secret metadata only. Credentials and recovery secrets remain runtime/vault material.
