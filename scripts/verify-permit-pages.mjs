// Verifies each permit page's explicit lot list against the live service:
// every AREAID in the profile must resolve to exactly one PERMIT area, and
// every listed lot must return at least one rule under that page's ruleWhere.
// A lot with no rules still draws on the map but its detail card is empty, so
// those are reported as warnings for the data owner (RULETYPE is a known-noisy
// field — a mislabeled row drops the lot out of its own page).
// Run: node scripts/verify-permit-pages.mjs
import { readFile } from 'node:fs/promises';

const profile = JSON.parse(await readFile('public/profiles/lagrange-permit.json', 'utf8'));
const AREAS = profile.layer.url;
const RULES = profile.relatedRules.url;
const KEY = profile.relatedRules.keyField ?? 'AREAID';
const q = (v) => `'${String(v).replace(/'/g, "''")}'`;

async function queryOn(base, where, outFields) {
  const url = `${base}/query?where=${encodeURIComponent(where)}&outFields=${outFields}&returnGeometry=false&f=json`;
  const data = await (await fetch(url)).json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.features ?? [];
}
const query = (where, outFields) => queryOn(AREAS, where, outFields);

let failures = 0;
const ruleless = [];

for (const tab of profile.tabs) {
  if (!tab.areaIds?.length) {
    console.log(`\n${tab.label}: no explicit lot list (falls back to rules-derived membership)`);
    continue;
  }
  const where = `(${profile.layer.baseWhere}) AND AREAID IN (${tab.areaIds.map(q).join(',')})`;
  const features = await query(where, 'AREAID,AREANAME,FACILITYTYPE');
  const found = new Set(features.map((f) => f.attributes.AREAID));
  const missing = tab.areaIds.filter((id) => !found.has(id));

  console.log(`\n${tab.label} — ${features.length}/${tab.areaIds.length} lots resolved`);
  for (const f of features) {
    const a = f.attributes;
    const shown = profile.nameOverrides?.[a.AREAID] ?? a.AREANAME;
    // Same query the app runs for the detail card: this lot, this page's rules.
    const rules = tab.ruleWhere
      ? await queryOn(RULES, `${KEY}=${q(a.AREAID)} AND (${tab.ruleWhere})`, 'RULETYPE')
      : [];
    const note = rules.length ? `${rules.length} rule(s)` : 'NO RULES — empty detail card';
    if (!rules.length) ruleless.push(`${tab.label}: ${shown} (${a.AREAID})`);
    console.log(`  ${a.AREAID.padEnd(28)} ${String(shown).padEnd(34)} ${note}`);
  }
  if (missing.length) {
    failures += missing.length;
    console.log(`  MISSING: ${missing.join(', ')}`);
  }
}

// Name overrides must point at areas that exist, or they silently do nothing.
const overrideIds = Object.keys(profile.nameOverrides ?? {});
if (overrideIds.length) {
  const found = new Set(
    (await query(`AREAID IN (${overrideIds.map(q).join(',')})`, 'AREAID')).map(
      (f) => f.attributes.AREAID
    )
  );
  const dangling = overrideIds.filter((id) => !found.has(id));
  console.log(`\nName overrides: ${overrideIds.length - dangling.length}/${overrideIds.length} resolve`);
  if (dangling.length) {
    failures += dangling.length;
    console.log(`  DANGLING: ${dangling.join(', ')}`);
  }
}

if (ruleless.length) {
  console.log(`\nWARNING — ${ruleless.length} listed lot(s) return no rules for their page:`);
  for (const r of ruleless) console.log(`  ${r}`);
  console.log('  These lots draw on the map but show an empty detail card.');
  console.log('  Cause is upstream data (RULETYPE mislabeling), not the profile.');
}

console.log(failures ? `\nFAILED — ${failures} unresolved id(s)` : '\nOK — every listed lot resolves');
process.exit(failures ? 1 : 0);
