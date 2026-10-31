# Zoho Desk help center theme

Source for the custom theme on `help.digerati-experts.com`. Zoho Desk keeps the only live copy; these files are the record.
Zoho does not read this folder: a change goes live only when it is pasted into Zoho and published.

| File | Paste into (Zoho Desk → Setup → Channels → Help Center → Customize) |
|---|---|
| `header.html` | Header |
| `footer.html` | Footer |
| `stylesheet.css` | CSS |

Copy the current content out of Zoho before pasting, then **Save** and **Publish**. Saving alone does not change the live site.

## Limits of the Zoho editor

- No scripts run, so nothing can be filled in at load time (for example the copyright year).
- `${CompanyName}`, `${PortalLogo}` and the other placeholders are filled in the header only. The footer shows them as blank.
- Inline `<svg>` is stripped from the footer, and Font Awesome is not loaded. Icons are empty `<span class="icon icon-*">` drawn by `stylesheet.css` as CSS masks.
- Use absolute links (`/portal/en/kb`). Relative links break on deeper pages such as `/portal/en/myarea/profile`.
- Wildcard selectors such as `[class*="Container__"]` match Zoho's own nested wrappers. Scope new rules to a specific class.
- The CSS editor's preview fails ("Oops, something went wrong while creating a preview") on newer CSS. Keep to what the original theme used: no `<` anywhere (even in comments), no `data:` URLs, no `:where()`/`:is()`, no `mask`.

## Testing a change before publishing

Fetch the live page in Playwright, route the `hccustomize/.../stylesheet.css`, `header.html` and `footer.html` requests to these local files, then screenshot at 1440 px and 390 px. The profile page (`/portal/en/myarea/profile`) needs a signed-in contact, so check it in a browser after publishing.
