// Verifies that every locale file has exactly the same keys and ICU placeholders as en.json,
// and that no message is empty. Run: npm run check:i18n
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "messages");
const locales = ["en", "fa", "ar"];
const load = (locale) => JSON.parse(readFileSync(path.join(dir, `${locale}.json`), "utf8"));

const dottedKeys = [];
function flatten(obj, prefix = "", out = new Map()) {
  for (const [key, value] of Object.entries(obj)) {
    if (key.includes(".")) dottedKeys.push(prefix ? `${prefix}.${key}` : key);
    const id = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") flatten(value, id, out);
    else out.set(id, String(value));
  }
  return out;
}

const placeholders = (message) =>
  [...message.matchAll(/\{(\w+)[^}]*\}|<(\w+)>/g)].map((m) => m[1] ?? `<${m[2]}>`).sort().join(",");

const reference = flatten(load("en"));
const problems = [];

for (const locale of locales) {
  const messages = flatten(load(locale));
  for (const [key, value] of messages) {
    if (!value.trim()) problems.push(`${locale}: empty message "${key}"`);
  }
  if (locale === "en") continue;
  for (const key of reference.keys()) {
    if (!messages.has(key)) problems.push(`${locale}: missing "${key}"`);
    else if (placeholders(reference.get(key)) !== placeholders(messages.get(key))) {
      problems.push(`${locale}: placeholder mismatch in "${key}"`);
    }
  }
  for (const key of messages.keys()) {
    if (!reference.has(key)) problems.push(`${locale}: extra key "${key}"`);
  }
}

for (const key of new Set(dottedKeys)) problems.push(`key contains "." (next-intl reads it as nesting): "${key}"`);

if (problems.length) {
  console.error(`i18n check failed (${problems.length}):\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`i18n check passed: ${reference.size} keys × ${locales.length} locales, placeholders consistent.`);
