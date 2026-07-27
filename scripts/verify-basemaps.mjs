// Checks each profile's basemap tile services actually serve tiles over this
// community, anonymously. The GISC_IMAGERY_* mosaics 404 over La Grange even
// though their metadata reads fine — so metadata alone is not proof of coverage.
// Run: node scripts/verify-basemaps.mjs
import { readFile } from 'node:fs/promises';

const PROFILES = ['lagrange-permit', 'lagrange-public'];
let failures = 0;

for (const name of PROFILES) {
  const profile = JSON.parse(await readFile(`public/profiles/${name}.json`, 'utf8'));

  // Centre of this profile's own parking, in the tile scheme's SR.
  const extUrl = `${profile.layer.url}/query?where=${encodeURIComponent(
    profile.layer.baseWhere ?? '1=1'
  )}&returnExtentOnly=true&outSR=3435&f=json`;
  const ext = (await (await fetch(extUrl)).json()).extent;
  const cx = (ext.xmin + ext.xmax) / 2;
  const cy = (ext.ymin + ext.ymax) / 2;

  console.log(`\n${name}`);
  const services = [
    ['canvas', profile.basemap.tileUrl],
    ['aerial', profile.basemap.imageryUrl],
  ].filter(([, url]) => url);

  for (const [role, url] of services) {
    const meta = await (await fetch(`${url}?f=json`)).json();
    const ti = meta.tileInfo;
    if (!ti) {
      failures++;
      console.log(`  FAIL ${role}: no tileInfo — ${JSON.stringify(meta.error ?? {}).slice(0, 100)}`);
      continue;
    }

    // Deepest zoom is what matters: that is where people read the parking.
    const lod = ti.lods[ti.lods.length - 1];
    const span = ti.cols * lod.resolution;
    const col = Math.floor((cx - ti.origin.x) / span);
    const row = Math.floor((ti.origin.y - cy) / span);
    const res = await fetch(`${url}/tile/${lod.level}/${row}/${col}`);
    const type = res.headers.get('content-type') ?? '';
    const kb = ((await res.arrayBuffer()).byteLength / 1024).toFixed(0);
    const ok = res.ok && type.startsWith('image');
    if (!ok) failures++;

    const svc = url.split('/services/')[1]?.split('/')[0] ?? url;
    console.log(
      `  ${ok ? 'OK  ' : 'FAIL'} ${role.padEnd(7)} ${svc}  L${lod.level} → HTTP ${res.status} ${type} ${kb} KB`
    );
  }
}

console.log(failures ? `\nFAILED — ${failures} basemap(s) serve no tiles here` : '\nOK — every basemap serves tiles');
process.exit(failures ? 1 : 0);
