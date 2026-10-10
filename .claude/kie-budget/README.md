# kie.ai budget gate

Every kie.ai generator in this repo (`/nano-banana-images`, `/excalidraw-visuals`, `/scrollcraft`) asks this gate before it spends a credit, and records the real debit after. Joe set the policy on 2026-10-04: "we can spend money but need to have a way to project how much we will spend for each job and limit how much it can spend like a soft and hard limit."

## The rules

| Limit | Default | What happens |
|---|---|---|
| Job soft | $2 | The job will not open (and no call crosses it) without `--soft-ok "<Joe, date>"` |
| Job hard | $5 | Always refused. Only editing `limits.json` raises it |
| Month soft | $25 | Same as job soft, counted across all jobs this calendar month |
| Month hard | $50 | Always refused |
| Projection | — | A job stops at 125% of the cost projected when it was opened; a bigger job is a new projection |
| Balance | — | Refused when the kie.ai balance cannot cover the next call; the gate never tops up |

Joe changes the numbers in `limits.json`. Prices per model are in the same file (`usdPerCredit` 0.005: Nano Banana 2 at 1K is 8 credits ≈ $0.04). Video models are priced per second and are estimates until the first real run.

## Before you open a job (Joe, 2026-10-08)

The limits below stop a job spending too much. They do not stop it generating an image
nobody wanted, which is the more common way the money goes. Joe's rule: consult first,
with options, and show the work before and after.

1. Put 2-3 concrete directions to DE and get a pick — not an open "what should I make?".
2. State the prompt you are about to send and what you expect back. DE can cancel here
   for free.
3. After the run, show the image against that stated intent, and say plainly when the
   result missed it.
4. Variants are for a deliberate series or set only. Anything else gets its own brief,
   so the site does not fill with near-duplicates.

`estimate` costs nothing and is the right way to price step 2 before asking.

## Running a job

```bash
B=.claude/kie-budget/budget.mjs
node $B estimate --model nano-banana-2 --count 6            # projection only, no spend
node $B open --job store-flagship-imagery --model nano-banana-2 --count 6 --note "Store concept 4 hero + sections"
KIE_JOB=store-flagship-imagery python3 .claude/skills/nano-banana-images/scripts/generate_kie.py prompt.json out.jpg
node $B status                                              # balance, month to date, open jobs
node $B close --job store-flagship-imagery                  # spent vs projected
```

Without `KIE_JOB` set to an open job, every generator exits with code 2 before any request leaves the machine. Dry runs (`--dry-run`) never touch the gate.

## Files

- `limits.json`: limits and prices (Joe's file).
- `ledger.jsonl`: one line per open / spend / close, committed so every session sees the month's spend. Actual debit comes from the balance before and after, or kie.ai's `creditsConsumed`.
- `budget.mjs`: the CLI (no dependencies). `gate.cjs`: the bridge the Node generators require; the Python one calls `budget.mjs` through `_kie.py`.
