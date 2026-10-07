import { ACCOUNT_TYPES } from "./licensing";
import { PRIMARY_PHONE } from "./companyContact";

/**
 * Built-in knowledge articles, inserted once (by number) when the knowledge
 * base is first read. They describe how the Client Portal itself works, or
 * keep the six articles the portal showed before, word for word. Nothing here
 * states a client's own policy: the licensing article shows the reader's
 * company policy live through {{license-policy}}.
 */

export type KbSeed = { number: string; title: string; summary: string; category: string; tags: string[]; body: string };

const accountTypeRows = ACCOUNT_TYPES.map((a) => `| ${a.label} | ${a.hint} |`).join("\n");

export const KB_SEED: KbSeed[] = [
  {
    number: "KB0000001",
    title: "Request a Microsoft 365, Google Workspace or Zoho licence",
    summary: "How to request a base or add-on licence for yourself, a colleague, or an admin, service or shared account.",
    category: "Licensing",
    tags: ["licence", "license", "microsoft 365", "e5", "e3", "f3", "g5", "google workspace", "zoho", "visio", "project"],
    body: `# Introduction
Learn how to request a software licence for your company's Microsoft 365, Google Workspace or Zoho Workplace tenant, including add-ons such as Visio or Project.

# Instructions
## Overview
You do not request a licence directly. Instead, DE adds you (or the account) to the right **licence group**. Once added, the licence is applied automatically.

Some accounts are licensed without asking:
- Accounts your company licenses **automatically** (often standard, "birthright" users) get their base licence when the account is created.
- Everyone else, and every add-on, needs a request.

> Not sure which account type you are? Open [Licenses & Account Types](/portal/licensing). Your company IT contact sets account types.

## How to request a licence
1. Go to [Request a Software License](/portal/requests/license).
2. Fill in the form:
  - **Requested for**: the person the licence is for, or the owner of the account.
  - **Who is the licence for?**: a person, or an admin, service or shared account. For an account, enter its name.
  - **Operation**: add to, or remove from, the licence group.
  - **Platform** and **Licence**: only licences your company's policy offers that account are shown.
  - **Business justification**: why the licence is needed.
3. Click **Order Now**, or **Add to Cart** to send several requests together.

The form shows the group DE will use and who approves the request. You can follow it in [My Requests](/portal/requests).

## Your company's licence groups
Use the tables below to see which licence each account type gets and how.

{{license-policy}}

> ! Do not share one licensed account between people. Ask for a shared account instead.`,
  },
  {
    number: "KB0000002",
    title: "Account types and how licensing works",
    summary: "The account types DE uses (standard, frontline, contractor, admin, service, shared) and what each means for licences.",
    category: "Licensing",
    tags: ["account type", "birthright", "frontline", "contractor", "admin account", "service account", "shared mailbox"],
    body: `# Introduction
Every account in your company has an **account type**. Your company's licence policy uses it, with an optional tier, to decide which licence the account gets and whether it is assigned automatically.

# Account types
| Account type | Who it is for |
|---|---|
${accountTypeRows}

# Tiers
Some companies split account types further, for example by job level. Tiers are your company's own labels, set by DE in your licence policy.

# Who sets account types
Your **company IT contact** sets each person's account type and tier on [Licenses & Account Types](/portal/licensing). Anyone without one set is treated as a standard user.

# Admin, service and shared accounts
These are not people, so they are not in your people list. Request a licence for them on [Request a Software License](/portal/requests/license) by choosing the account kind and naming the account. The person in **Requested for** owns it.`,
  },
  {
    number: "KB0000003",
    title: "Spot and report a phishing message",
    summary: "Signs that an email, text or call is a phishing attempt, and what to do if you clicked.",
    category: "Security",
    tags: ["phishing", "scam", "suspicious email", "security awareness"],
    body: `# Introduction
Phishing messages try to get you to click a link, open an attachment, share a password or code, or send money. They often look like they come from someone you know.

# Warning signs
- Urgency or threats: "your account will be closed today".
- A sender address or link that doesn't quite match the company it claims to be.
- Requests for passwords, MFA codes, gift cards or a change of bank details.
- Attachments or links you weren't expecting, even from a colleague.
- A login page you reached from an email instead of typing the address yourself.

# What to do
1. Don't click, reply or open attachments.
2. Check with the sender another way, such as a phone number you already have.
3. Report it: [open a support ticket](/portal/tickets/create) and include the sender and subject line.

> ! If you clicked a link, entered a password or approved an MFA prompt you didn't start, call the DE service desk now on ${PRIMARY_PHONE.display}. Acting quickly limits the damage.`,
  },
  {
    number: "KB0000004",
    title: "Request a loaner computer",
    summary: "Borrow a laptop or desktop for a set period while yours is away or for a short assignment.",
    category: "Devices",
    tags: ["loaner", "laptop", "desktop", "repair", "temporary"],
    body: `# Introduction
A loaner computer covers a limited period, for example while your computer is being repaired. It is provided if a suitable device is available for the dates you need.

# How to request one
1. Go to [Request Loaner Computer](/portal/requests/loaner-computer).
2. Choose **Laptop** or **Desktop**, and the **Needed from** and **Loan until** dates.
3. Pick your **Site Location Code (LID)**, or tick "Address is not a company location" and enter the address.
4. Explain the reason, add any accessories you need, and click **Order Now**.

# After you submit
You get a request number (LNR-…) and can follow it in [My Requests](/portal/requests): under review, device assigned, delivered, then return due and returned. You can cancel until a device is assigned.`,
  },
  {
    number: "KB0000005",
    title: "Return a computer",
    summary: "Send a computer back to the IT stockroom or for disposal, for example when someone leaves.",
    category: "Devices",
    tags: ["return", "offboarding", "leaving", "dispose", "pickup"],
    body: `# Introduction
Use a return request when a computer should go back to the IT stockroom or be disposed of, for example when someone leaves the company or gets a replacement.

# How to return a computer
1. Go to [Return Computer](/portal/requests/return-computer).
2. Choose the reason and pick the computer from the person's assigned assets. If it isn't listed, tick "I don't see the computer in my assigned assets" and enter its asset tag, serial number or a description.
3. List the accessories going back with it, confirm where the computer is now, and choose a preferred return date if you have one.
4. Click **Order Now**.

You can follow it in [My Requests](/portal/requests): pickup scheduled, received, then restocked or disposed.`,
  },
  {
    number: "KB0000006",
    title: "Use the Self-Service portal",
    summary: "Find requests, report issues, follow your tickets and get help from Ask DE.",
    category: "Getting started",
    tags: ["portal", "self-service", "help", "ask de"],
    body: `# Introduction
[Self-Service](/portal/self-service) is the place to start anything with DE.

# What you can do
| To | Go to |
|---|---|
| Request a device, licence or access | [Service Requests](/portal/requests) |
| Report a problem | [Report an Issue](/portal/tickets/create) |
| Follow your tickets | [Support Tickets](/portal/tickets) |
| Find an answer yourself | [Knowledge Base](/portal/kb) |
| Check whether a service is down | [Service Status](/portal/status) |

# Ask DE
Click **Need help? Chat with me…** at the bottom right. Ask DE can help you fill in a form, show your requests, or pass the conversation to the DE team. It never submits anything for you.`,
  },
  // The six articles the portal listed before, kept as they were.
  { number: "KB0000007", title: "Getting Started with VPN Access", summary: "Complete guide to setting up VPN access for remote work.", category: "Network & VPN", tags: ["vpn"], body: "Learn how to configure and connect to our VPN for secure remote access." },
  { number: "KB0000008", title: "Cytracom ControlOne Setup Guide", summary: "Set up your cloud phone system with Cytracom ControlOne.", category: "Phones", tags: ["cytracom", "phone"], body: "Step-by-step instructions for configuring Cytracom ControlOne softphone." },
  { number: "KB0000009", title: "Password Reset Procedures", summary: "Self-service password reset instructions for all platforms.", category: "Security", tags: ["password"], body: "How to reset your password for various company systems." },
  { number: "KB0000010", title: "Microsoft 365 Email Configuration", summary: "Email setup guide for Outlook, mobile apps, and web access.", category: "Email & Microsoft 365", tags: ["outlook", "email"], body: "Configure Microsoft 365 email on desktop and mobile devices." },
  { number: "KB0000011", title: "Multi-Factor Authentication (MFA) Setup", summary: "Protect your accounts with two-factor authentication.", category: "Security", tags: ["mfa", "2fa"], body: "Enable and configure MFA for enhanced account security." },
  { number: "KB0000012", title: "Remote Desktop Connection Guide", summary: "Access your work desktop from anywhere securely.", category: "Remote access", tags: ["rdp", "remote desktop"], body: "Connect to office computers remotely using RDP." },
  {
    number: "KB0000013",
    title: "How to enroll your mobile device",
    summary: "Enroll an iPhone, iPad or Android device for secure access to company email, apps and other work resources.",
    category: "Devices",
    tags: ["mobile device", "mdm", "intune", "company portal", "ios", "ipados", "android", "byod", "enrollment"],
    body: `# Introduction
Use this guide when Digerati Experts or your company asks you to enroll an iPhone, iPad or Android device for work.

Enrollment registers the device with your company's mobile device management system so company email, apps and other work resources can be protected. The exact screens can vary based on your company's policy and whether the device is company-owned or personal.

# Before you start
- Connect the device to reliable Wi-Fi or cellular data.
- Install any pending iOS, iPadOS or Android updates.
- Make sure you know your normal work username and password and can complete MFA.
- Make sure the device has a screen lock or passcode.
- Use your normal day-to-day work account. Do **not** enroll with an admin, shared, service or emergency/break-glass account.

> If this is a personal device, review the management and privacy information shown during enrollment before you continue. What your company can see or manage depends on the enrollment method and company policy.

# Company-owned phones and tablets
If the device is new or has been reset and setup shows **Remote Management**, **Set up for work**, or another company enrollment screen, follow that setup flow.

Sign in with your normal work account when asked. Do not skip company enrollment or manually add a second management profile unless Digerati Experts tells you to.

# iPhone or iPad
1. Start from the enrollment link provided by your company or Digerati Experts. If you were instructed to use the app, install **Intune Company Portal** from the App Store and open it.
2. Sign in with your work account and complete MFA.
3. Follow the enrollment prompts. Depending on your company's configuration, enrollment may continue in Safari or in the Settings app.
4. If iOS/iPadOS asks you to download a management profile, allow the download. Then open **Settings > General > VPN & Device Management**, select the downloaded management profile, and choose **Install**.
5. Return to Company Portal or the browser and finish registration and any device-compliance checks.
6. If you are asked to set a stronger passcode, enable a security setting, or update iOS/iPadOS, complete that requirement and check the device again.

> Some companies use web-based Apple enrollment, so Company Portal may not be required. Follow the enrollment path presented to you rather than installing extra profiles on your own.

# Android
1. Start from the enrollment link provided by your company or Digerati Experts. If you were instructed to use the app, install **Intune Company Portal** from Google Play and open it.
2. Sign in with your work account and complete MFA.
3. Accept your company's terms if they are shown, then follow the prompts to register the device.
4. On a personal Android device, you may be asked to create a **Work profile**. Allow Android to create and activate it. Work apps in that profile normally show a small briefcase badge.
5. Complete any required device settings. If Company Portal shows **Resolve**, **Check status**, or a similar action, open it and follow the listed steps.
6. Recheck the device until enrollment shows complete and work access is allowed.

# Verify enrollment
After setup:
1. Open Company Portal or your company's enrollment page and confirm the device is registered and does not show an unresolved setup requirement.
2. Open a company app such as Outlook or Teams and sign in.
3. Confirm you can reach the company resource you were enrolling the device to use.

# If enrollment does not work
Do **not** remove the management profile, factory-reset the device, or repeatedly enroll it unless Digerati Experts tells you to.

> ! If enrollment unexpectedly asks you to erase or factory-reset a device that already contains data, stop and contact Digerati Experts before continuing.

[Open a support ticket](/portal/tickets/create) and include:
- iPhone/iPad or Android.
- Device manufacturer and model.
- Whether the device is company-owned or personal.
- The exact error message or a screenshot.
- The step where enrollment stopped.

# Removing management
Removing management can immediately remove work data or block access to company resources. If the device is being replaced, returned, transferred, or is no longer used for work, [open a support ticket](/portal/tickets/create) so it can be retired correctly.

# Last verified
October 7, 2026 by Digerati Experts.`,
  },
];
