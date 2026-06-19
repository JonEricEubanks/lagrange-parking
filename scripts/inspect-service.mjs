// One-off: introspect the public LaGrange_Parking_Permits service.
// Run: node scripts/inspect-service.mjs
const FS = 'https://services2.arcgis.com/FwavjPsU0K1YB1vX/arcgis/rest/services/LaGrange_Parking_Permits/FeatureServer';

async function j(url) {
  const r = await fetch(url);
  return r.json();
}
async function groupBy(layer, field, where = '1=1') {
  const stats = encodeURIComponent(JSON.stringify([{ statisticType: 'count', onStatisticField: 'OBJECTID', outStatisticFieldName: 'n' }]));
  const url = `${FS}/${layer}/query?where=${encodeURIComponent(where)}&groupByFieldsForStatistics=${field}&outStatistics=${stats}&f=json`;
  const d = await j(url);
  if (d.error) return `ERROR ${JSON.stringify(d.error)}`;
  return (d.features || []).map((f) => `${f.attributes[field]}=${f.attributes.n}`).join('  ');
}
async function sumWhere(layer, fields, where) {
  const stats = encodeURIComponent(JSON.stringify(fields.map((f) => ({ statisticType: 'sum', onStatisticField: f, outStatisticFieldName: f }))));
  const url = `${FS}/${layer}/query?where=${encodeURIComponent(where)}&outStatistics=${stats}&f=json`;
  const d = await j(url);
  if (d.error) return `ERROR ${JSON.stringify(d.error)}`;
  return JSON.stringify(d.features?.[0]?.attributes ?? {});
}

const root = await j(`${FS}?f=json`);
console.log('SERVICE:', root.error ? JSON.stringify(root.error) : root.name);
if (root.layers) root.layers.forEach((l) => console.log('  LAYER', l.id, l.name));
if (root.tables) root.tables.forEach((t) => console.log('  TABLE', t.id, t.name));

for (const id of [2, 3]) {
  const meta = await j(`${FS}/${id}?f=json`);
  console.log(`\n=== [${id}] ${meta.name} — fields ===`);
  (meta.fields || []).forEach((f) => console.log(`  ${f.name} (${f.type.replace('esriFieldType', '')})`));
}

console.log('\n=== ParkingArea [2] ===');
console.log('USERCLASS:', await groupBy(2, 'USERCLASS'));
console.log('PRIMARYRULE:', await groupBy(2, 'PRIMARYRULE'));
console.log('FACILITYTYPE:', await groupBy(2, 'FACILITYTYPE'));
console.log('HAS* sums (PERMIT):', await sumWhere(2, ['HASVISITOR', 'HASPERMIT', 'HASRESIDENT', 'HASCOMMUTER', 'HASCBD'], "USERCLASS='PERMIT'"));

console.log('\n=== ParkingRule [3] ===');
console.log('RULETYPE:', await groupBy(3, 'RULETYPE'));
console.log('PERMITZONE:', await groupBy(3, 'PERMITZONE'));
console.log('USERCLASS:', await groupBy(3, 'USERCLASS'));
