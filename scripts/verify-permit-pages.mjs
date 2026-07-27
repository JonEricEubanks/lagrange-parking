// Verifies each permit page's explicit lot list against the live service:
// every AREAID in the profile must resolve to exactly one PERMIT area.
// Run: node scripts/verify-permit-pages.mjs
import { readFile } from 'node:fs/promises';

const profile = JSON.parse(await readFile('public/profiles/lagrange-permit.json', 'utf8'));
const AREAS = profile.layer.url;
const q = (v) => `'${String(v).replace(/'/g, "''")}'`;

async function query(where, outFields) {
  const url = `${AREAS}/query?where=${encodeURIComponent(where)}&outFields=${outFields}&returnGeometry=false&f=json`;
  const data = await (await fetch(url)).json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.features ?? [];
}

let failures = 0;

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
    console.log(`  ${a.AREAID.padEnd(28)} ${shown}  (${a.FACILITYTYPE})`);
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

console.log(failures ? `\nFAILED — ${failures} unresolved id(s)` : '\nOK — every listed lot resolves');
process.exit(failures ? 1 : 0);
