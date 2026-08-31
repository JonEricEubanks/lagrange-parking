// Read-only preview of what add_audience_field.py --commit would change.
// Run: node scripts/preview-data-fix.mjs
const FS = 'https://services2.arcgis.com/FwavjPsU0K1YB1vX/arcgis/rest/services/LaGrange_Parking_Permits/FeatureServer';
const RES = new Set(['A', 'B', 'C', 'D', '2A', '5A', '9A']);
const COM = new Set(['E', 'G']);
const STU = new Set(['H']);
const EMP = new Set(['CBD', 'WBD']);
const aud = (rt, pz, uc) => {
  rt = (rt || '').toUpperCase(); pz = (pz || '').toUpperCase(); uc = (uc || '').toUpperCase();
  if (uc === 'VISITOR') return 'VISITOR';
  if (RES.has(pz)) return 'RESIDENT';
  if (COM.has(pz)) return 'COMMUTER';
  if (STU.has(pz)) return 'STUDENT';
  if (EMP.has(pz)) return 'EMPLOYEE';
  if (['OVERNIGHT_RESIDENT', 'DAYTIME_RESIDENT'].includes(rt)) return 'RESIDENT';
  if (rt === 'COMMUTER_DECAL') return 'COMMUTER';
  if (['CBD_DECAL', 'BUSINESS_DECAL'].includes(rt)) return 'EMPLOYEE';
  if (rt === 'NO_PARKING') return 'RESTRICTED';
  return 'OTHER';
};
const q = async (layer, fields) =>
  (await (await fetch(`${FS}/${layer}/query?where=1%3D1&outFields=${encodeURIComponent(fields)}&returnGeometry=false&f=json`)).json()).features.map((f) => f.attributes);

const rules = await q(3, 'AREAID,RULETYPE,PERMITZONE,USERCLASS');
const byArea = {};
const tally = {};
for (const r of rules) {
  const a = aud(r.RULETYPE, r.PERMITZONE, r.USERCLASS);
  tally[a] = (tally[a] || 0) + 1;
  (byArea[r.AREAID] ||= new Set()).add(a);
}
console.log('Rule AUDIENCE tally:', tally);

const areas = await q(2, 'AREAID,AREANAME,USERCLASS,HASRESIDENT,HASCOMMUTER,HASCBD,HASVISITOR');
console.log('\nArea flag changes (PERMIT/RESTRICTED only):');
let n = 0;
for (const a of areas.filter((x) => x.USERCLASS !== 'VISITOR')) {
  const s = byArea[a.AREAID] || new Set();
  const nw = {
    HASRESIDENT: s.has('RESIDENT') ? 1 : 0,
    HASCOMMUTER: s.has('COMMUTER') || s.has('STUDENT') ? 1 : 0,
    HASCBD: s.has('EMPLOYEE') ? 1 : 0,
  };
  const diff = Object.entries(nw).filter(([k, v]) => (a[k] || 0) !== v);
  if (diff.length) {
    n++;
    console.log(`  ${String(a.AREANAME).slice(0, 34).padEnd(34)} ${diff.map(([k, v]) => `${k}:${a[k] || 0}→${v}`).join('  ')}`);
  }
}
console.log(`\n${n} permit areas would change. (Residents tab gains the residential zones; mis-tagged ones move out of Commuter.)`);
