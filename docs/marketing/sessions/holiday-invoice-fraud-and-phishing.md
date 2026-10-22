# Session kit — Holiday Invoice Fraud: How Payment-Change Emails Get Past Busy Teams

<!-- GENERATED from holiday-invoice-fraud-and-phishing.yaml by scripts/de-marketing/build.ts. Edit the YAML, then run: npx tsx scripts/de-marketing/build.ts -->

**Thursday 19 November 2026, 11:00 AM – 11:45 AM Arizona (America/Phoenix) · Live webinar, 45 min · Presenter: Joseph Petro · Zoho Webinar**
Page: https://digeratiexperts.com/events/holiday-invoice-fraud-and-phishing · Campaign: https://digeratiexperts.com/go/email-security
Session data: `client/src/data/deEvents.ts` · Copy source: `docs/marketing/sessions/holiday-invoice-fraud-and-phishing.yaml` · Voice: `docs/marketing/VOICE.md` · Preview: `docs/marketing/sessions/preview.html`
Slides: [Zoho Show deck, 7 slides with presenter notes](https://show.zoho.com/show/open/wkjyyd4be374b73bd4afab84ff7c0f49777ee), filed in WorkDrive `0. Digerati Experts / 4. Event & Strategic Planning / event`. Every example in it is constructed; no client email, form or data appears.

> **Status: CONFIRMED (Joe, 16 Oct 2026), page live.** Joseph Petro presents on Zoho Webinar. Every draft below is copy for DE to review and send from its own tools; nothing is sent automatically.
> Rules applied: no statistics, no client names, no "we stop all phishing" promise, no real fraud email from a client shown on screen.

## 0. Decided and still open

- Joe, 16 Oct 2026: **Joseph Petro** presents. Zoho Webinar for the session (registration, recording, Q&A); Zoho Meeting for the internal dry run.
- Joe, 22 Oct 2026: copy is serious underneath and dry on top (`docs/marketing/VOICE.md`); visuals are branded editorial, no generated imagery.

| Still needed | By | Notes |
| --- | --- | --- |
| Create the Zoho Webinar and its join link | Thu 22 Oct (T-28) | The join link goes only in Email D (T-1), never on the public page |
| Book the Zoho Meeting dry run | Fri 13 Nov | Internal, 30 min |

## 1. Promotion track

| Date | Step | Owner |
| --- | --- | --- |
| Thu 22 Oct | Zoho Webinar created; Email B to prospects; LinkedIn post 1 with the invite card | Joseph Petro + Marketing |
| Thu 5 Nov | Mention at the end of the 5 Nov insurance session (same audience); Email A in the client newsletter (first Thursday); Email B resend to non-openers; LinkedIn post 2 with the reminder card | Marketing |
| Mon 9 Nov | Call list: clients' accounts-payable and office managers | Account management |
| Thu 12 Nov | Email C reminder to registrants | Marketing |
| Fri 13 Nov | Dry run on Zoho Meeting (internal, 30 min) | Joseph Petro |
| Wed 18 Nov | Email D (T-1) with the join link | Marketing |
| Thu 19 Nov | Run of show, section 5 | Joseph Petro + host |
| Mon 23 Nov | Email E follow-up; log attendance in Zoho CRM. The 24 Nov holiday shopping-scam advisory follows the next day. | Marketing + Sales |

Registrations arrive as Zoho CRM leads with Service `Event registration: holiday-invoice-fraud-and-phishing`.

## 2. Emails

Each email is also rendered as branded HTML and plain text under `out/holiday-invoice-fraud-and-phishing/emails/`.

### A — Clients (newsletter block) (Thu 5 Nov)

```text
Subject: Newsletter block: holiday invoice fraud, Thu 19 Nov

Holiday invoice fraud: 45 minutes on Thursday 19 November

Late in the year, invoices pile up, people are out, and an email asking to "update our bank details before the holiday" can look like routine admin. It isn't.

On Thursday 19 November at 11:00 AM Arizona time we'll walk through what payment-change and gift-card requests look like, which email protections catch what, and a call-back rule your accounts-payable team can adopt the same week.

Forward this to whoever pays your bills. They'll thank you in January.

Register: https://digeratiexperts.com/events/holiday-invoice-fraud-and-phishing
```

### B — Prospects (Thu 22 Oct; resend to non-openers Thu 5 Nov)

```text
Subject: Please update our bank details before the holidays (please don't)
Preview: What payment-change fraud looks like, and the free rule that catches it.

Hi [First name],

Year-end is the season scammers pick. Invoices pile up, half the team is out, and an email asking you to "update our bank details before the holiday" looks, to a tired accounts-payable inbox, exactly like a Tuesday.

On Thursday 19 November at 11:00 AM Arizona time we're running a free 45-minute session for the people who approve payments: accounts-payable staff, office managers and the owners who sign off on changes.

- what a payment-change or gift-card request actually looks like
- SPF, DKIM and DMARC in plain language: what each one catches, and what none of them do
- a call-back rule your team can adopt this week, no new software required

One honest note: no filter catches everything. The call-back rule is the part that still works on a Friday afternoon, and we'll say so on the call.

Register: https://digeratiexperts.com/events/holiday-invoice-fraud-and-phishing

[Sender name]
Digerati Experts · Chandler, Arizona
```

### C — Registrants (Thu 12 Nov)

```text
Subject: One week: holiday invoice fraud, Thu 19 Nov 11:00 AM AZ
Preview: Bring the questions. Leave the suspicious email where it is.

Hi [First name],

You're registered for Holiday Invoice Fraud: How Payment-Change Emails Get Past Busy Teams next Thursday 19 November, 11:00 AM to 11:45 AM Arizona time.

If your team has had a suspicious payment-change request, bring the questions it raised. Please don't forward the email itself; describe it instead. Your inbox has had enough excitement.

The join link comes the day before.

See the session page: https://digeratiexperts.com/events/holiday-invoice-fraud-and-phishing

[Sender name]
Digerati Experts · Chandler, Arizona
```

### D — Registrants (Wed 18 Nov)

```text
Subject: Tomorrow 11:00 AM AZ: your join link
Preview: Thu 19 Nov. Bring whoever approves payments.

Hi [First name],

See you tomorrow, Thursday 19 November at 11:00 AM Arizona time (10:00 AM Pacific / 11:00 AM Mountain / 12:00 PM Central / 1:00 PM Eastern).

Join: [JOIN LINK]

Agenda (45 min): What a payment-change attempt looks like · Email authentication and filtering — what each layer catches · The process controls that matter more than any tool · Open questions.

Bring whoever approves payments. And whoever approves them when that person is on holiday.

[Sender name]
Digerati Experts · Chandler, Arizona
```

### E — Registrants and attendees (Mon 23 Nov)

```text
Subject: Recording, and the one rule worth printing
Preview: The call-back rule in one line, and an offer to check your email setup.

Hi [First name],

Thank you for [joining us / registering] for Holiday Invoice Fraud: How Payment-Change Emails Get Past Busy Teams.

- Recording and slides: [LINK]
- The call-back rule, in one line: any change to payment details is confirmed by phone, on a number you already had on file, never one from the email asking for the change.

Print it, tape it to the monitor. We won't judge.

If you want your own email setup checked (SPF, DKIM, DMARC, filtering), that's the next step below.

Check my email security: https://digeratiexperts.com/go/email-security

[Sender name]
Digerati Experts · Chandler, Arizona
```

## 3. LinkedIn

**Post 1 (Thu 22 Oct)**

```text
"Please update our bank details before the holidays."

Payment-change fraud doesn't need malware. It needs a believable email, a busy accounts-payable inbox, and nobody picking up the phone to check.

Free 45-minute session, Thu 19 Nov, 11:00 AM Arizona time: what these requests look like, what SPF, DKIM and DMARC actually catch, and a call-back rule your team can adopt this week. No software purchase required, which we realise is an odd thing for an IT company to say.
https://digeratiexperts.com/events/holiday-invoice-fraud-and-phishing
```

**Post 2 (Thu 5 Nov)**

```text
A fraud control that needs no install, no licence and no training budget: confirm every payment change by phone, on a number you already had.

Two weeks until our session on holiday payment-change and gift-card scams. Thu 19 Nov, 11:00 AM Arizona time. Bring whoever pays the bills.
https://digeratiexperts.com/events/holiday-invoice-fraud-and-phishing
```

## 4. Social cards

Rendered to `out/holiday-invoice-fraud-and-phishing/cards/` at 1200×627 (LinkedIn) and 1080×1080.

- **invite:** Free live session · "“Please update our bank details before the holidays.”" · Before you do, 45 minutes on how payment-change fraud works and the rule that catches it.
- **reminder:** Two weeks to go · "The fraud control that needs no install." · It's a phone call. We'll explain which number to dial.

## 5. Run of show (45 min)

| Time (AZ) | Min | Segment | Notes |
| --- | --- | --- | --- |
| 10:45 | — | Host and presenter join, check audio and screen share |  |
| 11:00 | 10 | What a payment-change attempt looks like | Use a constructed example, never a client's real email |
| 11:10 | 15 | Email authentication and filtering: what each layer catches | SPF, DKIM, DMARC, filtering, external-sender banners. Be plain that no filter catches everything |
| 11:25 | 10 | The process controls that matter more than any tool | The call-back rule; two-person approval for changes; gift-card requests always verified in person or by phone |
| 11:35 | 10 | Open questions | Client-specific setups move to a follow-up call |
| 11:45 | — | Close: the follow-up email has the recording and the /go/email-security next step |  |

## 6. Call list (Mon 9 Nov)

Clients' accounts-payable contacts and office managers.

> "Hi [name], it's [caller] at Digerati Experts. Year-end is when a fake 'update our bank details' email is easiest to miss in accounts payable. We're doing a 45-minute session on Thu 19 Nov on spotting them and a simple call-back rule. Want me to send the link to you, or to whoever pays the bills?"

Log every call in Zoho CRM against the contact.
