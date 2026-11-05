# Zoho Desk help center theme

Source for the custom theme on `help.digerati-experts.com`. Zoho Desk keeps the only live copy; these files are the record.
Zoho does not read this folder: a change goes live only when it is pasted into Zoho and published.

| File | Paste into (Zoho Desk → Setup → Channels → Help Center → Customize) |
|---|---|
| `header.html` | Header |
| `footer.html` | Footer |
| `stylesheet.css` | CSS |

Copy the current content out of Zoho before pasting, then **Save** and **Publish**. Saving alone does not change the live site.

These files are byte-for-byte what Zoho serves (synced 2026-11-02), except the KB docs layout block at the end of `stylesheet.css`, which is not published yet (see "KB docs layout" below). The CSS is stored minified, as published: Zoho's editor dropped leading characters when a long, indented file was pasted, so paste compact CSS.

## Limits of the Zoho editor

- No scripts run, so nothing can be filled in at load time (for example the copyright year).
- `${CompanyName}`, `${PortalLogo}` and the other placeholders are filled in the header only. The footer shows them as blank.
- Inline `<svg>` is stripped from the footer, and Font Awesome is not loaded. Icons are empty `<span class="icon icon-*">` drawn by `stylesheet.css` as text characters in `::before`.
- Zoho strips `aria-*` attributes from the header and footer HTML on save.
- Use absolute links (`/portal/en/kb`). Relative links break on deeper pages such as `/portal/en/myarea/profile`.
- Wildcard selectors such as `[class*="Container__"]` match Zoho's own nested wrappers. Scope new rules to a specific class.
- The CSS editor's preview fails ("Oops, something went wrong while creating a preview") on newer CSS. Keep to what the original theme used: no `<` anywhere (even in comments), no `data:` URLs, no `:where()`/`:is()`, no `mask`.

## Testing a change before publishing

Fetch the live page in Playwright, route the `hccustomize/.../stylesheet.css`, `header.html` and `footer.html` requests to these local files, then screenshot at 1440 px and 390 px. The profile page (`/portal/en/myarea/profile`) needs a signed-in contact, so check it in a browser after publishing.

## KB docs layout (2026-11-05, site issue #960) — not yet published

The last three lines of `stylesheet.css`, starting at the comment `/* KB docs layout (2026-11-05, site issue 960) ... */`, give KB articles the same docs layout as the site's portal knowledge base. They only touch pages with the `.articleDetail` body class. Layout only; colours stay as they are.

- **996px and wider:** the Follow / category / Related Articles card moves to a 280px left column and stays in view while reading (sticky).
- **1200px and wider:** "On this page" moves out of the article into a 220px right rail that stays in view; the article body is capped at 780px.
- **All widths:** article text 16px / 1.7, images no wider than the column, headings land 16px below the top bar when picked from "On this page".
- **Under 996px:** Zoho's own stacked layout, with "On this page" above the article, is unchanged.

What Zoho cannot do here: no script runs, so "On this page" has no scroll-spy highlight, and the left card lists Zoho's own category and related articles (not a full category tree). Zoho scrolls an inner container that already starts below the fixed bar, so the sticky offsets are 16px, not the bar height.

### To publish

1. Zoho Desk → Setup → Channels → Help Center → Customize → **CSS**. Copy the current CSS out into a text file as a backup.
2. Confirm the current CSS is still the first three lines of `stylesheet.css` (synced 2026-11-02). If Zoho's copy has changed, reconcile first rather than overwriting.
3. Paste the **whole** `stylesheet.css` (seven lines) over it. Do not paste an indented or reformatted version.
4. **Save**, then **Publish**.
5. Open a long article (for example `/portal/en/kb/articles/how-to-enroll-your-mobile-device`) at desktop width and on a phone. Check the left card and "On this page" stay put while scrolling, and the phone layout looks as before.

To roll back, delete those last three lines in Zoho's CSS editor, then Save and Publish.

Preview without publishing: `node artifacts/visual-qa/kb-jumpcloud-layout/zoho-preview.mjs` (routes the theme stylesheet to this file on the live page; screenshots in `artifacts/visual-qa/kb-jumpcloud-layout/zoho/`).
