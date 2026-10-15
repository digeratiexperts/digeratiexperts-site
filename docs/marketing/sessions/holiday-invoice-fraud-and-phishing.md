# Session kit — Holiday Invoice Fraud

**Thu 19 Nov 2026, 11:00 – 11:45 AM Arizona (America/Phoenix) · Live webinar, 45 min**
Page: https://digeratiexperts.com/events/holiday-invoice-fraud-and-phishing · Campaign: https://digeratiexperts.com/go/email-security
Session data: `client/src/data/deEvents.ts` (slug `holiday-invoice-fraud-and-phishing`) · Calendar: `docs/marketing/DE-EVENT-CALENDAR.md`
Slides (draft, internal, 7 slides with presenter notes): [Zoho Show](https://show.zoho.com/show/open/wkjyyd4be374b73bd4afab84ff7c0f49777ee), filed in WorkDrive `0. Digerati Experts / 4. Event & Strategic Planning / event`. Every example in them is constructed; no client email, form or data appears.

> **Status: PLANNED.** Joe, 15 Oct 2026: prepare campaign assets but do not publish unconfirmed event details. The page answers 404 and nothing below is sent until the session is confirmed (step 0). Every draft is copy for review, not sent mail.
> Rules applied: no statistics, no client names, no "we stop all phishing" promise, no real fraud email from a client shown on screen (`docs/CLAIMS-REGISTER.md`). Bracketed `[…]` items are filled at send time.

## 0. Decide first (Joe)

| Item | Needed by | Notes |
|---|---|---|
| Presenter | Thu 22 Oct (T-28) | Normal track: this session is on schedule |
| Meeting platform and join link | Thu 22 Oct | Same platform as the 5 Nov session |
| Confirm | Thu 22 Oct | To publish: `status: "confirmed"` in `client/src/data/deEvents.ts` plus `/events/holiday-invoice-fraud-and-phishing` in `server/spaKnownPaths.ts` (tests fail if one is missing), then `npx tsx scripts/de-events/build.ts`, merge, verify live |

## 1. Promotion track (normal, five weeks)

| Date | Step | Owner |
|---|---|---|
| Thu 22 Oct | Confirm presenter and platform; mark confirmed | Joe |
| Thu 22 Oct | Email B to prospects; LinkedIn post 1 | Marketing |
| Thu 5 Nov | Mention at the end of the 5 Nov insurance session (same audience); Email A in the client newsletter (first Thursday); Email B resend to non-openers; LinkedIn post 2 | Marketing |
| Mon 9 Nov | Call list: clients' accounts-payable and office managers | Account management |
| Thu 12 Nov | Email C reminder to registrants | Marketing |
| Fri 13 Nov | Dry run (internal, 30 min) | Presenter |
| Wed 18 Nov | Email D (T-1) with the join link | Marketing |
| Thu 19 Nov | Run of show, section 4 | Presenter + host |
| Mon 23 Nov | Email E follow-up; log attendance in Zoho CRM. The 24 Nov holiday shopping-scam advisory follows the next day. | Marketing + Sales |

Registrations arrive as Zoho CRM leads with Service `Event registration: holiday-invoice-fraud-and-phishing`.

## 2. Emails

### A — Clients (newsletter block, Thu 5 Nov)

**Holiday invoice fraud: 45 minutes on 19 November**

Late in the year, invoices pile up, people are out, and an email asking to "update our bank details before the holiday" can look routine. On **Thursday 19 November at 11:00 AM Arizona time** we'll walk through what these payment-change and gift-card requests look like, which email protections catch what, and a call-back rule your accounts-payable team can adopt the same week.

Send it to whoever pays your bills. **Register:** https://digeratiexperts.com/events/holiday-invoice-fraud-and-phishing

### B — Prospects (Thu 22 Oct; resend to non-openers Thu 5 Nov)

**Subject:** "Please update our bank details before the holidays"
**Preview:** What payment-change fraud looks like, and a simple rule for catching it.

Hi [First name],

It usually arrives looking like a normal vendor email: a new account number, a polite note about year-end, sometimes from an address one letter off from the real one. And it lands when the people who approve payments are busiest.

On **Thursday 19 November at 11:00 AM Arizona time** we're running a free 45-minute session for accounts-payable staff, office managers and the owners who approve payments:

- what a payment-change and gift-card request email looks like
- SPF, DKIM and DMARC in plain language: what each one actually catches
- a call-back rule your team can adopt this week, no new software required

**Register:** https://digeratiexperts.com/events/holiday-invoice-fraud-and-phishing

[Sender name]
Digerati Experts · Chandler, Arizona

### C — Reminder to registrants (Thu 12 Nov)

**Subject:** One week: holiday invoice fraud, Thu 19 Nov 11:00 AM AZ

Hi [First name],

You're registered for *Holiday Invoice Fraud* next **Thursday, 19 November, 11:00 to 11:45 AM Arizona time**. If your team has received a suspicious payment-change request, bring the questions it raised (please don't forward the email itself). The join link comes the day before.

https://digeratiexperts.com/events/holiday-invoice-fraud-and-phishing

### D — Day before, with join link (Wed 18 Nov)

**Subject:** Tomorrow 11:00 AM AZ: your join link

Hi [First name],

See you tomorrow, **Thursday 19 November at 11:00 AM Arizona time** ([12:00 PM Mountain / 1:00 PM Central / 2:00 PM Eastern]).

**Join:** [JOIN LINK]

Agenda (45 min): what a payment-change attempt looks like · what each email protection layer catches · the process controls that matter more than any tool · your questions.

### E — Follow-up (Mon 23 Nov)

**Subject:** Recording, and the call-back rule

Hi [First name],

Thank you for [joining us / registering] for *Holiday Invoice Fraud*.

- **Recording and slides:** [LINK]
- **The call-back rule, in one line:** any change to payment details is confirmed by phone, using a number you already had on file, never one from the email asking for the change.
- **If you want your own email setup checked** (SPF, DKIM, DMARC, filtering): https://digeratiexperts.com/go/email-security

## 3. LinkedIn

**Post 1 (Thu 22 Oct)**
"Please update our bank details before the holidays."

Payment-change fraud doesn't need malware. It needs a believable email, a busy accounts-payable inbox, and nobody picking up the phone to check.

Free 45-minute session, Thu 19 Nov, 11:00 AM Arizona: what these requests look like, what SPF, DKIM and DMARC actually catch, and a call-back rule your team can adopt this week.
https://digeratiexperts.com/events/holiday-invoice-fraud-and-phishing

**Post 2 (Thu 5 Nov)**
One of the strongest controls against invoice fraud isn't software. It's a rule: payment changes get confirmed by phone, on a number you already had.

Two weeks until our session on holiday payment-change and gift-card scams. Thu 19 Nov, 11:00 AM Arizona.
https://digeratiexperts.com/events/holiday-invoice-fraud-and-phishing

## 4. Run of show (45 min)

| Time (AZ) | Min | Segment | Notes |
|---|---|---|---|
| 10:45 | — | Host and presenter join, check audio and screen share | |
| 11:00 | 10 | What a payment-change attempt looks like | Use a constructed example, never a client's real email |
| 11:10 | 15 | Email authentication and filtering: what each layer catches | SPF, DKIM, DMARC, filtering, external-sender banners. Be plain that no filter catches everything |
| 11:25 | 10 | The process controls that matter more than any tool | The call-back rule; two-person approval for changes; gift-card requests always verified in person or by phone |
| 11:35 | 10 | Open questions | Client-specific setups move to a follow-up call |
| 11:45 | — | Close: the follow-up email has the recording and the /go/email-security next step | |

## 5. Call list (Mon 9 Nov)

Clients' accounts-payable contacts and office managers.

> "Hi [name], it's [caller] at Digerati Experts. Year-end is when a fake 'update our bank details' email is easiest to miss in accounts payable. We're doing a 45-minute session on the 19th on spotting them and a simple call-back rule. Want me to send the link to you, or to whoever pays the bills?"

Log every call in Zoho CRM against the contact.
