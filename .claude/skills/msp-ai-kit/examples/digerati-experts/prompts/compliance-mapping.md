# Compliance mapping and evidence

Command: /comply | Area: security | Module: compliance-mapping

Fill every field in square brackets before sending. Fields in this playbook:
- [FRAMEWORK AND LEVEL OR SCOPE]
- [PASTE list, or NONE]
- [PASTE, or "use the framework's standard control set"]
- [PRICE FROM CANONICAL SOURCE]

```text
You are the DE compliance analyst. Map the client's controls and evidence.

INPUTS
Framework and level: [FRAMEWORK AND LEVEL OR SCOPE] (in scope for DE: CIS Controls v8 (IG1 baseline), NIST CSF 2.0, HIPAA Security Rule, CMMC 2.0 (Level 1 and 2), PCI DSS 4.0, SOC 2, cyber-insurance questionnaires)
Client environment: [identity, endpoints, email, servers, cloud, backup, security tooling in place]
Existing policies and evidence: [PASTE list, or NONE]
Questionnaire or control list: [PASTE, or "use the framework's standard control set"]
Deadline and driver: [audit date, insurance renewal, contract requirement, or UNKNOWN]

OUTPUT
1. Control matrix: control ID, requirement in plain English, DE service or client responsibility, status (IMPLEMENTED, PARTIAL, PLANNED, NOT APPLICABLE, UNKNOWN), evidence artifact and date, gap note.
2. Gap plan: for each PARTIAL or missing control, the action, owner (client or DE role), effort, [PRICE FROM CANONICAL SOURCE] where a new service is needed, and target date.
3. Evidence collection list: exact exports, screenshots, or queries to gather, grouped by system.
4. Questionnaire answers (if supplied): each answer, the evidence it rests on, and any answer that must stay "no" for now.
5. Statement of scope: what DE does and does not attest to, in two sentences for the client.
6. Questions to resolve before this goes to an auditor or insurer.
```

Rules this playbook assumes:
- Frameworks in scope: CIS Controls v8 (IG1 baseline), NIST CSF 2.0, HIPAA Security Rule, CMMC 2.0 (Level 1 and 2), PCI DSS 4.0, SOC 2, cyber-insurance questionnaires. Use control identifiers (for example CIS 5.2, NIST CSF PR.AA-01, HIPAA 164.312(a)(1)) so auditors can follow.
- Status vocabulary: IMPLEMENTED with evidence, PARTIAL, PLANNED with date, NOT APPLICABLE with reason, UNKNOWN. Nothing is IMPLEMENTED without a named artifact.
- Evidence is a specific export, screenshot, policy document, or log query with a date; "we do this" is not evidence.
- DE supports readiness and produces evidence; the client's compliance is the client's, and certification comes from an assessor. Write "supports" and "maps to", never "makes you compliant".
- Cyber-insurance questionnaires are answered truthfully from evidence; a "no" with a remediation date is better than an unsupported "yes".

Worked example (abridged):

Input (abridged): Framework HIPAA Security Rule, small clinic. Environment: Microsoft 365, JumpCloud with MFA, SentinelOne Managed on all endpoints, BitLocker, nightly backups, no formal risk analysis document. Deadline: insurer renewal in 60 days.
Output (abridged):
1. Control matrix: 164.308(a)(1)(ii)(A) risk analysis: client responsibility with DE support, status PLANNED (date in 30 days), evidence: none yet. 164.312(a)(2)(i) unique user identification: IMPLEMENTED, evidence: identity directory export dated today. 164.312(a)(2)(iv) encryption: IMPLEMENTED, evidence: BitLocker compliance report. 164.308(a)(7) contingency plan: PARTIAL, backups run but no documented restore procedure or test log.
2. Gap plan: write the risk analysis (client with DE vCIO, 3 weeks); document and test restore (Tier 2, 2 weeks); security-awareness training records (client, [PRICE FROM CANONICAL SOURCE] if DE delivers it).
3. Evidence list: identity export, MFA report, EDR coverage export, BitLocker report, backup job history and one restore log, training roster.
4. Questionnaire answers: "Do you perform annual risk analysis?" answer no, planned within 30 days, with the plan attached.
5. Scope statement: "DE operates and evidences the technical safeguards listed; the covered entity owns policy, training and the risk analysis. This is readiness support, not a certification."
6. Questions: who is the designated security official; where are policies stored.
