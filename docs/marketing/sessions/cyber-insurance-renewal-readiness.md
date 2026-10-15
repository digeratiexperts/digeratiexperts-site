# Session kit — Before Your Cyber Insurance Renewal

**Thu 5 Nov 2026, 11:00 AM – 12:00 PM Arizona (America/Phoenix) · Live webinar, 60 min**
Page: https://digeratiexperts.com/events/cyber-insurance-renewal-readiness · Campaign: https://digeratiexperts.com/go/cyber-insurance
Session data: `client/src/data/deEvents.ts` (slug `cyber-insurance-renewal-readiness`) · Calendar: `docs/marketing/DE-EVENT-CALENDAR.md`

> **Status: PLANNED, date selected (5 Nov).** Nothing below is published or sent until the session is confirmed (step 0). Every draft is copy for review, not sent mail.
> Rules applied: no statistics, no client names, no guarantee of coverage, approval or claim outcome; framework and insurer names are the attendee's requirements, never DE certifications (`docs/CLAIMS-REGISTER.md`). Bracketed `[…]` items are filled at send time.

## 0. Decided and still open

**Decided (Joe, 15 Oct 2026):** the session runs **Thu 5 Nov**. **Thu 29 Oct is the internal preparation milestone.** Campaign assets are prepared now, but no unconfirmed event detail is published: the page answers 404 and nothing is sent until the session is confirmed.

| Still needed | By | Notes |
|---|---|---|
| Presenter | Thu 22 Oct | Named on the page only once confirmed |
| Meeting platform and join link | Thu 22 Oct | e.g. Zoho Webinar; the join link goes only in the T-1 email, never on the public page |
| Confirm | Thu 22 Oct | Two weeks of promotion is the minimum for a 5 Nov session |

**To publish:** set `status: "confirmed"` in `client/src/data/deEvents.ts`, add `/events/cyber-insurance-renewal-readiness` to `server/spaKnownPaths.ts` (the tests fail if one is done without the other), run `npx tsx scripts/de-events/build.ts`, merge, and verify the page live.

## 1. Promotion track (session Thu 5 Nov; milestone Thu 29 Oct)

Nothing in this table goes out before the session is confirmed.

| Date | Step | Owner |
|---|---|---|
| By Thu 22 Oct | Presenter and platform confirmed; session marked confirmed and the page verified live | Joe + lead integrator |
| Thu 22 Oct | Email A to clients, Email B to prospects, LinkedIn post 1 | Marketing |
| Mon 26 Oct | Call list: clients with a renewal in the next six months | Account management |
| **Thu 29 Oct** | **Prep milestone:** slides drafted and dry-run, all invites approved; Email C reminder to registrants; Email B resend to non-openers; LinkedIn post 2 | Presenter + Marketing |
| Wed 4 Nov | Email D (T-1) with the join link | Marketing |
| Thu 5 Nov | Run of show, section 4. The client newsletter goes out the same morning and carries a one-line reminder. | Presenter + host |
| Mon 9 Nov | Email E follow-up; log attendance in Zoho CRM | Marketing + Sales |

Registrations arrive as Zoho CRM leads with Service `Event registration: cyber-insurance-renewal-readiness`. The Tuesday pipeline review checks they all got a reply.

## 2. Emails

### A — Clients (Thu 22 Oct)

**Subject:** Before your cyber insurance renewal: a working hour on 5 November
**Preview:** The controls the questionnaire asks about, and how to show you have them.

Hi [First name],

Cyber insurance applications now ask how you operate: MFA, endpoint protection, email authentication, backups, awareness training. If your renewal is coming up, the time to find a gap is before the questionnaire, not during underwriting.

On **Thursday 5 November at 11:00 AM Arizona time** we're running a one-hour working session on exactly that:

- the control areas carrier questionnaires typically ask about, in plain language
- how to tell a missing control from missing evidence of one you already run
- what to do first when renewal is weeks away, not months

Bring the questionnaire you were sent if you have one.

One thing we'll be plain about: carriers decide coverage, and counsel interprets the policy. We can't promise either. We can help you implement and document the technical side.

**Save your seat:** https://digeratiexperts.com/events/cyber-insurance-renewal-readiness

[Sender name]
Digerati Experts

### B — Prospects (Thu 22 Oct; resend to non-openers Thu 29 Oct)

**Subject:** What will your cyber insurance questionnaire ask this year?
**Preview:** A free working hour on 5 November, Arizona time.

Hi [First name],

If you fill in your company's cyber insurance application, you've probably noticed it reads more like an IT audit every year. MFA, endpoint protection, email authentication, tested backups, staff training: these show up as questions now, not optional extras.

We're hosting a free one-hour session on **Thursday 5 November at 11:00 AM Arizona time** for owners, finance and operations leads, and IT leads who have to answer those questions:

- what the control areas mean and why carriers ask
- missing control or missing evidence? How to tell, with a sample questionnaire
- a sensible order for the work when renewal is close

No pitch for a policy. We don't sell insurance and we can't promise coverage; carriers decide that. This is about getting the technical answers right.

**Register:** https://digeratiexperts.com/events/cyber-insurance-renewal-readiness

[Sender name]
Digerati Experts · Chandler, Arizona

### C — Reminder to registrants (Thu 29 Oct)

**Subject:** One week: cyber insurance renewal session, Thu 5 Nov 11:00 AM AZ

Hi [First name],

A reminder that you're registered for *Before Your Cyber Insurance Renewal* next **Thursday, 5 November, 11:00 AM to 12:00 PM Arizona time**.

If you have your carrier's questionnaire, have it to hand; we'll leave the last 15 minutes for your questions. The join link comes the day before.

Add it to your calendar from the page: https://digeratiexperts.com/events/cyber-insurance-renewal-readiness

### D — Day before, with join link (Wed 4 Nov)

**Subject:** Tomorrow 11:00 AM AZ: your join link

Hi [First name],

See you tomorrow, **Thursday 5 November at 11:00 AM Arizona time** (that's [12:00 PM Mountain / 1:00 PM Central / 2:00 PM Eastern]).

**Join:** [JOIN LINK]

Agenda (60 min): why the application asks how you operate · the control areas one by one · missing control or missing evidence · your questions.

### E — Follow-up (Mon 9 Nov)

**Subject:** Recording and next step: cyber insurance renewal session

Hi [First name],

Thank you for [joining us / registering] for *Before Your Cyber Insurance Renewal*.

- **Recording and slides:** [LINK]
- **Your next step, if you want one:** we'll go through your questionnaire against your actual environment and separate what's missing from what just needs documenting: https://digeratiexperts.com/go/cyber-insurance

As we said on the call: carriers decide coverage, so treat anything we say as the technical side only.

## 3. LinkedIn

**Post 1 (Thu 22 Oct)**
Cyber insurance applications read more like IT audits every year. MFA, endpoint protection, email authentication, tested backups, awareness training: they're questions now, not extras.

On Thu 5 Nov (11:00 AM Arizona) we're running a free working hour on what those questions mean, and how to tell a missing control from missing evidence of one you already run.

We don't sell insurance and can't promise coverage. This is the technical side, in plain language.
https://digeratiexperts.com/events/cyber-insurance-renewal-readiness

**Post 2 (Thu 29 Oct)**
"Do you enforce MFA for all remote access?" is a yes/no box on a lot of renewal forms. The honest answer is often "mostly", and that gap is worth finding before the application goes in.

One week until our session on the controls underwriters ask about: Thu 5 Nov, 11:00 AM Arizona.
https://digeratiexperts.com/events/cyber-insurance-renewal-readiness

## 4. Run of show (60 min)

| Time (AZ) | Min | Segment | Notes |
|---|---|---|---|
| 10:45 | — | Host and presenter join, check audio and screen share | |
| 11:00 | 10 | Why the application now asks how you operate | Say the boundary early: carriers decide coverage, counsel reads the policy |
| 11:10 | 20 | The control areas, one by one: identity, endpoint, email, backup, awareness | One slide each: what it is, what the question usually looks like, what evidence looks like |
| 11:30 | 15 | Missing control or missing evidence? Working a sample questionnaire | Use a blank or anonymised sample, never a client's real form |
| 11:45 | 15 | Open questions | Host reads chat questions; anything client-specific moves to a follow-up call |
| 12:00 | — | Close: the follow-up email has the recording and the /go/cyber-insurance next step | |

## 5. Call list (Mon 26 Oct)

Clients whose cyber insurance renews in the next six months (from the QBR notes and the November license audit).

> "Hi [name], it's [caller] at Digerati Experts. Your cyber insurance renewal is coming up in [month]. We're running a working hour on 5 November on what the questionnaire asks and how to show the controls you already have. Want me to send the link? If you've already got the questionnaire, bring it."

Log every call in Zoho CRM against the contact.
