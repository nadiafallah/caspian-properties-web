// Launch gate. Scans the production build for anything that must not reach the public site:
// photo placeholders, missing-content markers and [VERIFY]/[CONTENT NEEDED] tokens.
// Also warns when the broker card or trade licence is close to expiry.
//
//   Preview review:  npm run build && npm run check:content            (reports, exits 0)
//   Launch gate:     NEXT_PUBLIC_SITE_STAGE=launch npm run build && NEXT_PUBLIC_SITE_STAGE=launch npm run check:content
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const launch = process.env.NEXT_PUBLIC_SITE_STAGE === "launch";
const appDir = path.join(root, ".next", "server", "app");

if (!existsSync(appDir)) {
  console.error("No build found. Run `npm run build` first.");
  process.exit(1);
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".html")) out.push(full);
  }
  return out;
}

const PATTERNS = [
  { id: "photo placeholder", re: /data-placeholder="/g },
  { id: "content needed", re: /data-content-needed="([^"]*)"/g },
  { id: "[VERIFY] token", re: /\[VERIFY/g },
  { id: "[CONTENT NEEDED] token", re: /\[CONTENT NEEDED/g },
];

const findings = new Map();
for (const file of walk(appDir)) {
  const html = readFileSync(file, "utf8");
  const page = "/" + path.relative(appDir, file).replace(/\\/g, "/").replace(/\.html$/, "").replace(/(^|\/)index$/, "");
  for (const { id, re } of PATTERNS) {
    const matches = [...html.matchAll(re)];
    if (!matches.length) continue;
    const key = `${id}`;
    const entry = findings.get(key) ?? { count: 0, pages: new Set(), details: new Set() };
    entry.count += matches.length;
    entry.pages.add(page);
    for (const m of matches) if (m[1]) entry.details.add(m[1]);
    findings.set(key, entry);
  }
}

// Licence expiry warnings (dates live in src/config/company.ts).
const company = readFileSync(path.join(root, "src", "config", "company.ts"), "utf8");
const expiries = [
  ["Broker card (BRN)", /brnExpiry:\s*verified\("(\d{4}-\d{2}-\d{2})"/],
  ["Trade licence", /licenceExpiry:\s*verified\("(\d{4}-\d{2}-\d{2})"/],
];
const problems = [];
const warnings = [];
for (const [label, re] of expiries) {
  const match = company.match(re);
  if (!match) continue;
  const days = Math.floor((Date.parse(`${match[1]}T00:00:00Z`) - Date.now()) / 86_400_000);
  if (days < 0) problems.push(`${label} expired on ${match[1]} — update src/config/company.ts and the card preview.`);
  else if (days <= 60) warnings.push(`${label} expires in ${days} days (${match[1]}).`);
}

console.log(`Content check (${launch ? "LAUNCH" : "preview"} stage)`);
if (!findings.size) console.log("  ✓ No placeholders or missing-content markers in the build.");
for (const [id, entry] of findings) {
  console.log(`  • ${id}: ${entry.count} on ${entry.pages.size} page(s)`);
  for (const d of entry.details) console.log(`      – ${d}`);
}
for (const w of warnings) console.log(`  ! ${w}`);
for (const p of problems) console.log(`  ✗ ${p}`);

if (problems.length || (launch && findings.size)) {
  console.error("\nLaunch blocked: resolve the items above (see docs/CONTENT_INVENTORY.md).");
  process.exit(1);
}
if (!launch && findings.size) {
  console.log("\nPreview stage: these items are expected until Nadia supplies the content. A launch build must have none.");
}
