// Shared Node bridge to budget.mjs for the kie.ai generators (CommonJS so both
// .cjs and .mjs scripts can require/import it). gate() exits the process with
// the gate's refusal before any createTask; record() logs the real debit.
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const BUDGET = path.join(__dirname, "budget.mjs");

function gate(model, { resolution, seconds } = {}) {
  const job = process.env.KIE_JOB;
  const argv = [BUDGET, "gate", "--job", job || "", "--model", model];
  if (resolution) argv.push("--resolution", String(resolution));
  if (seconds) argv.push("--seconds", String(seconds));
  try {
    process.stderr.write(execFileSync(process.execPath, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  } catch (e) {
    process.stderr.write(String(e.stderr || e.stdout || e.message));
    process.stderr.write("\nkie.ai budget gate refused; nothing was sent. Open a job first:\n  node .claude/kie-budget/budget.mjs open --job <name> --model <id> --count <n>\n  then run with KIE_JOB=<name>\n");
    process.exit(2);
  }
  return job;
}

function record(model, credits, { task, file } = {}) {
  const argv = [BUDGET, "record", "--job", process.env.KIE_JOB, "--model", model, "--credits", String(credits)];
  if (task) argv.push("--task", task);
  if (file) argv.push("--file", file);
  try {
    process.stderr.write(execFileSync(process.execPath, argv, { encoding: "utf8" }));
  } catch (e) {
    process.stderr.write(`WARNING: spend not recorded in the ledger: ${e.message}\n`);
  }
}

module.exports = { gate, record };
