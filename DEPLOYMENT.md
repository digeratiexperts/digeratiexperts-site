# Digerati Experts — Deployment Guide

> **Canonical production deploy:** [`deploy/vps/README.md`](deploy/vps/README.md)
> and [`deploy/vps/deploy.sh`](deploy/vps/deploy.sh).
>
> Production is **systemd** (`digeratiexperts-site`), user **`diger7051`**,
> code at **`/home/digeratiexperts.com/current`**. Not PM2. Not `/root/Replit-Site`.

## Production (authoritative)

| Item | Value |
|------|-------|
| Public site | https://digeratiexperts.com |
| Health | https://digeratiexperts.com/healthz |
| Deploy user | `diger7051` |
| Active release | `/home/digeratiexperts.com/current` |
| Secrets | `/home/digeratiexperts.com/shared/.env` |
| Service | `digeratiexperts-site` (systemd) |
| Private port | `127.0.0.1:3300` (OLS proxies HTTPS here) |

### Deploy an update

```bash
sudo -u diger7051 bash -lc \
  'DEPLOY_BRANCH=main bash /home/digeratiexperts.com/current/deploy/vps/deploy.sh production'
```

The script builds a new release, flips `current`, then:

```bash
sudo -n /usr/bin/systemctl restart digeratiexperts-site
sudo -n /usr/bin/systemctl is-active digeratiexperts-site
curl -fsS https://digeratiexperts.com/healthz
```

Failed restart, inactive service, or failed health check **fails the deployment**
(non-zero exit) and attempts automatic rollback. No manual root SSH restart
is required when sudoers is configured (see `deploy/vps/README.md`).

### Post-deploy verify

```bash
deploy/vps/verify.sh digeratiexperts.com
```

## Environment variables

Production secrets live only in `/home/digeratiexperts.com/shared/.env`
(never commit). Template: `deploy/vps/env.production.example`.

Key groups: `DATABASE_URL`, JWT/SESSION secrets, Zoho (Desk/CRM/Payments +
Portal OIDC), OpenAI, Turnstile, TechSales sync URL/token, `PORT=3300`.

## Public phone number

The site has no public phone number yet. `PUBLIC_PHONE_NUMBER` in
`shared/companyContact.ts` holds the placeholder `[DE_PUBLIC_PHONE]`, and while
it does every call link, phone button, `tel:` desk action and schema.org
`telephone` stays hidden. Visitors are pointed to DE Desk, the contact page or
info@digeratiexperts.com instead.

To publish a number:

1. Set `PUBLIC_PHONE_NUMBER` to the line in `480-555-0100` form. The display,
   `tel:` link, E.164 and schema forms are all derived from it.
2. Find and replace `[DE_PUBLIC_PHONE]` across the repo. That fills plain-text
   spots such as the Word templates in `document_templates/` and the datasheet
   content sources.
3. Add the number back to the static pages that cannot read the constant:
   `client/index.html` (JSON-LD `telephone`), `public/llms.txt`,
   `zoho/help-center/footer.html`, and the pages under `public/v2/` and
   `public/scrollcraft/`.
4. Run `npm run documents:build -- --publish` to rebuild the PDFs under
   `client/public/assets/`, then `npm test`.

`shared/publicPhone.test.ts` fails if a retired number shows up in any served
source or document template.

## OpenLiteSpeed

OLS terminates TLS and reverse-proxies to Node on `:3300`. Do **not** serve
the SPA from `public_html` static files. See `deploy/vps/openlitespeed-proxy.md`.

## Health endpoints

- `/healthz` — simple OK (deploy + load balancer)
- `/api/health` — detailed service status
- `/ready` — readiness

## Monitoring

```bash
sudo -n /usr/bin/systemctl status digeratiexperts-site
journalctl -u digeratiexperts-site -f
tail -f /home/digeratiexperts.com/logs/app.log
curl -fsS https://digeratiexperts.com/healthz
```

## Obsolete (do not use)

| Path / method | Why |
|---------------|-----|
| PM2 / `ecosystem.config.js` / `.cjs` | Superseded by systemd; stubs removed 2026-11-04 |
| `/root/Replit-Site` | Not production code path |
| `scripts/deploy.sh` | Obsolete; stub removed 2026-11-04. Use `deploy/vps/deploy.sh` |
| Manual root restart after every git pull | `deploy.sh` restarts + verifies |

## Staging

Same release model under `/home/staging.digeratiexperts.com` with
`deploy.sh staging` (port 3200, unit `digeratiexperts-staging`). Details in
`deploy/vps/README.md`.

## Support

For deployment assistance, contact the development team.
