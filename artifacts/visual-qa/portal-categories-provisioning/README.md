# Portal: category card colours and live provisioning status

Requested by Joe on 2026-10-06. The captures come from the dev server on 2026-10-07, signed in as the local dev admin. Each capture checked that the host was `127.0.0.1` and the path was the expected one before the screenshot was taken.

## Category colours

Each dashboard card gets one vivid colour by category. The colour appears only on the card's top edge and in its icon well. Text and status colours are unchanged.

| Category | Cards | Dark | Light |
|---|---|---|---|
| tickets | Open tickets, Resolved tickets, Recent tickets | `#3D7BFF` | `#1F5BE0` |
| services | Active services, Your services | `#00D4A0` | `#00805F` |
| billing | Pending invoices | `#A974FF` | `#7C3AED` |
| requests | Do something | `#FF7A2F` | `#C2410C` |
| account | Your account team, Account provisioning | `#9BE22D` | `#4D7C0F` |

Every pairing clears 3:1, the contrast minimum for icons, on its card and in its well. Most clear 4.5:1.

## Provisioning status

- **Settings → Account provisioning.** Shows the signed-in user's latest JumpCloud and Blackpoint lifecycle run, plus any Store orders being set up. Each step reads Provisioned, In progress, Failed, Skipped or Not started, with the system's own message.
- **People & Org → Provisioning column.** Shows the same status for every person in the company.
- **How it stays live.** Both views refresh every 10 seconds while a step is in progress, and every 60 seconds otherwise.
- **About these captures.** The dev server has no JumpCloud or Blackpoint keys, so both steps read **Skipped** with "…_API_KEY not configured". Production shows the real result.

## Files

`{dark,light}-{dashboard,settings}-{390,768,1440}.png`, 12 captures.

## Checks

On all 12 views:
- axe-core (WCAG 2.0, 2.1 and 2.2 A and AA, reduced motion) found 0 violations of any impact.
- There is no horizontal overflow.
- The computed `--pt-cat` values match the hex values in the table.
