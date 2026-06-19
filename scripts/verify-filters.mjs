// Test candidate PERMITZONE-first audience predicates against live data.
// Run: node scripts/verify-filters.mjs
const FS = 'https://services2.arcgis.com/FwavjPsU0K1YB1vX/arcgis/rest/services/LaGrange_Parking_Permits/FeatureServer';

const NONE = "(PERMITZONE IS NULL OR PERMITZONE IN ('NONE',''))";
const CAND = {
  Residents: `PERMITZONE IN ('A','B','C','D','2A','5A','9A') OR (${NONE} AND RULETYPE IN ('OVERNIGHT_RESIDENT','DAYTIME_RESIDENT'))`,
  'Commuter & LT Students': `PERMITZONE IN ('E','G','H') OR (${NONE} AND RULETYPE = 'COMMUTER_DECAL')`,
  Employees: `PERMITZONE IN ('CBD','WBD') OR (${NONE} AND RULETYPE IN ('CBD_DECAL','BUSINESS_DECAL'))`,
};

async function groupBy(field, where) {
  const stats = encodeURIComponent(JSON.stringify([{ statisticType: 'count', onStatisticField: 'OBJECTID', outStatisticFieldName: 'n' }]));
  const url = `${FS}/3/query?where=${encodeURIComponent(where)}&groupByFieldsForStatistics=${field}&outStatistics=${stats}&f=json`;
  const d = await (await fetch(url)).json();
  if (d.error) return 'ERR ' + JSON.stringify(d.error);
  return (d.features || []).map((f) => `${f.attributes[field]}=${f.attributes.n}`).join('  ');
}
async function count(where) {
  const url = `${FS}/3/query?where=${encodeURIComponent(where)}&returnCountOnly=true&f=json`;
  return (await (await fetch(url)).json()).count;
}

let total = 0;
for (const [label, where] of Object.entries(CAND)) {
  const n = await count(where);
  total += n;
  console.log(`\n### ${label}  (${n} permit rules)`);
  console.log('  RULETYPE :', await groupBy('RULETYPE', where));
  console.log('  PERMITZONE:', await groupBy('PERMITZONE', where));
}
// Permit rules total (USERCLASS PERMIT) for cross-check
const permitTotal = await count("USERCLASS = 'PERMIT'");
console.log(`\nSum across 3 audiences = ${total}; total PERMIT-userclass rules = ${permitTotal}`);
