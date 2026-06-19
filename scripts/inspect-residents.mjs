const FS = 'https://services2.arcgis.com/FwavjPsU0K1YB1vX/arcgis/rest/services/LaGrange_Parking_Permits/FeatureServer';
const q = async (layer, where, fields) => {
  const url = `${FS}/${layer}/query?where=${encodeURIComponent(where)}&outFields=${encodeURIComponent(fields)}&returnGeometry=false&f=json`;
  return (await (await fetch(url)).json()).features.map((f) => f.attributes);
};

// 1) The resident-tab lots
const lots = await q(2, "USERCLASS='PERMIT' AND HASRESIDENT=1", 'AREAID,AREANAME,PRIMARYRULE');
console.log('=== Residents tab lots (HASRESIDENT=1) ===');
lots.forEach((l) => console.log(`  ${l.AREAID.padEnd(8)} ${String(l.AREANAME).padEnd(22)} PRIMARYRULE=${l.PRIMARYRULE}`));

// 2) ALL rules on those lots (what the detail card *could* show)
const ids = lots.map((l) => `'${l.AREAID}'`).join(',');
const rules = await q(3, `AREAID IN (${ids})`, 'AREAID,RULETYPE,PERMITNAME,PERMITZONE,ENFORCE_TEXT,RATE_TEXT');
console.log(`\n=== ALL rules on those lots (${rules.length}) ===`);
rules.forEach((r) => console.log(`  ${r.AREAID.padEnd(8)} ${String(r.RULETYPE).padEnd(18)} zone=${String(r.PERMITZONE).padEnd(5)} ${r.PERMITNAME ?? ''} | ${r.ENFORCE_TEXT ?? ''}`));

// 3) Where do residential zone A–D permits actually live, and are those areas flagged resident?
const zoneRules = await q(3, "PERMITZONE IN ('A','B','C','D')", 'AREAID,RULETYPE,PERMITNAME,PERMITZONE');
const zoneAreaIds = [...new Set(zoneRules.map((r) => r.AREAID))];
console.log(`\n=== Zone A–D permit rules live on areas: ${zoneAreaIds.join(', ')} ===`);
for (const aid of zoneAreaIds) {
  const a = await q(2, `AREAID='${aid}'`, 'AREAID,AREANAME,USERCLASS,PRIMARYRULE,HASRESIDENT,HASCOMMUTER,HASCBD');
  console.log('  ', JSON.stringify(a[0]));
}
