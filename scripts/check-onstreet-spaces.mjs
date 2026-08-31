const base = 'https://services2.arcgis.com/FwavjPsU0K1YB1vX/arcgis/rest/services/LaGrange_Parking_Permits/FeatureServer/2/query';
const where = encodeURIComponent("FACILITYTYPE = 'On-Street' AND USERCLASS = 'VISITOR'");
fetch(base + '?where=' + where + '&outFields=AREAID,AREANAME,PRIMARYRULE,MAXSPACES,LOCDESC&returnGeometry=false&f=json')
  .then((r) => r.json())
  .then((d) => {
    const feats = d.features.map((f) => f.attributes);
    const withSpaces = feats.filter((f) => Number(f.MAXSPACES) > 0);
    const total = feats.reduce((s, f) => s + (Number(f.MAXSPACES) || 0), 0);
    console.log('on-street polygons:', feats.length);
    console.log('with MAXSPACES>0:', withSpaces.length);
    console.log('sum MAXSPACES:', total);
    const byRule = {};
    for (const f of feats) {
      const k = f.PRIMARYRULE || '?';
      byRule[k] = byRule[k] || { polys: 0, spaces: 0 };
      byRule[k].polys++;
      byRule[k].spaces += Number(f.MAXSPACES) || 0;
    }
    console.table(byRule);
  });
