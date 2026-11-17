// Runs `npm audit` like `npm audit --audit-level=high`, except that advisories listed in ALLOWED don't fail it.
// Keep the list short, give each entry a reason, and take it out as soon as a fixed version is in package-lock.json.
import { spawnSync } from "node:child_process";

const ALLOWED = new Map([
  [
    "GHSA-fc5q-39xc-vjpf",
    "picomatch ReDoS (all versions up to 4.0.7, no fix released yet). Only reaches build and test tools " +
      "(vite, vitest, tinyglobby, node-gyp), never the shipped app. Remove once picomatch publishes a fix.",
  ],
]);
const BLOCKING = new Set(["high", "critical"]);

const result = spawnSync("npm", ["audit", "--json"], { encoding: "utf8", shell: process.platform === "win32" });
let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error(result.stdout, result.stderr);
  console.error("npm audit didn't return a report.");
  process.exit(1);
}
if (report.error) {
  console.error(JSON.stringify(report.error, null, 2));
  console.error("npm audit failed.");
  process.exit(1);
}

const advisories = new Map();
for (const [name, vuln] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of vuln.via) {
    if (typeof via === "string") continue;
    const id = via.url?.split("/").pop() ?? String(via.source);
    if (!advisories.has(id)) advisories.set(id, { ...via, id, packages: new Set() });
    advisories.get(id).packages.add(name);
  }
}

const blocking = [...advisories.values()].filter((a) => BLOCKING.has(a.severity) && !ALLOWED.has(a.id));
const skipped = [...advisories.values()].filter((a) => ALLOWED.has(a.id));
const counts = report.metadata?.vulnerabilities ?? {};
console.log(`npm audit: ${counts.total ?? 0} vulnerable packages (${counts.high ?? 0} high, ${counts.critical ?? 0} critical).`);

for (const a of skipped) console.log(`Allowed ${a.id} (${a.severity}, ${[...a.packages].join(", ")}): ${ALLOWED.get(a.id)}`);
for (const id of ALLOWED.keys()) {
  if (!advisories.has(id)) {
    const note = `${id} no longer appears in npm audit; remove it from ALLOWED in scripts/audit.mjs.`;
    console.log(process.env.GITHUB_ACTIONS ? `::warning::${note}` : note);
  }
}

if (blocking.length) {
  for (const a of blocking) console.error(`${a.severity}: ${a.id} ${a.title} (${[...a.packages].join(", ")}) ${a.url}`);
  console.error(`${blocking.length} high or critical advisories aren't allowed. Run \`npm audit\` for details.`);
  process.exit(1);
}
console.log("No high or critical advisories outside the allowed list.");
