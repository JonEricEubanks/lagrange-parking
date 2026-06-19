<p align="center">
  <img src="public/assets/lagrange-mark.png" alt="Village of La Grange" width="120">
</p>

<h1 align="center">Village of La Grange — Parking Maps</h1>

<p align="center">
  Two public, mobile-friendly interactive parking maps for the Village of La Grange.<br/>
  Built by <strong>Municipal GIS Partners (MGP)</strong>
</p>

---

## Two experiences, one codebase

Per the stakeholder reframe, the old "single map with everything" is replaced by **two separate, audience-targeted apps**, each driven by its own profile JSON:

| App | Profile | Audience | Filter |
|-----|---------|----------|--------|
| **Permit** | `public/profiles/lagrange-permit.json` | Residents · Commuter & LT Students · Employees (one tab each) | `USERCLASS = 'PERMIT'`, then per-tab `HASRESIDENT` / `HASCOMMUTER` / `HASCBD` |
| **Public** | `public/profiles/lagrange-public.json` | Visitors / shoppers / diners | `USERCLASS IN ('VISITOR','RESTRICTED')`, color-coded by time limit |

Each map shows **only what is relevant to its audience** — applicable lots, zones and rules — and the public map contains **no permit content** at all.

## Data source

Hosted feature service **`LaGrange_Parking_Permits`** on the La Grange AGOL org
(`https://lagrangeil.maps.arcgis.com`, item `f13e7fa3199141a2be6c2eea816de8d4`):

- `…/FeatureServer/2` — **ParkingArea** (polygons; `USERCLASS`, `PRIMARYRULE`, `HAS*` audience flags, `AREAID`)
- `…/FeatureServer/3` — **ParkingRule** (related table, 1:many on `AREAID`)

> ⚠️ **The layers must be shared publicly in AGOL** for these anonymous public apps to load them.
> Today the service is shared to the org only.

The "paths to the maps" live in the **profile JSON** (`layer.url`, `relatedRules.url`, `itemId`), not in `.env`.

## Commands

```bash
npm install
npm run dev            # permit app  → http://localhost:5173/lagrange-parking/
npm run dev:public     # public app  → http://localhost:5173/lagrange-parking-public/
npm run build          # builds both → dist/permit and dist/public
npm run build:permit
npm run build:public
```

Profile selection, base path and output dir are set per build mode in `.env.permit` / `.env.public`.

## Tech stack

React 19 · TypeScript · Vite 7 · ArcGIS JS SDK (`@arcgis/core` v5). Public/anonymous access via an
optional API key (`VITE_ARCGIS_API_KEY`, only needed if `enableWalkTime` is turned on). No login.

## Brand

Village of La Grange Brand Guidelines (0719): Dark Blue `#00306C`, La Grange Blue `#126BB5`,
Medium Blue `#13ACE1`, Green `#43B749`, Light Blue `#A8E0F8`, Mint `#D8ECD4`. Fonts: Nunito Sans
(Avenir substitute) + Oswald (Acumin substitute). Logo assets in `public/assets/`.

## Audience filtering (verified against live data)

- **Which lots** per tab: exact, via `ParkingArea.HASRESIDENT` / `HASCOMMUTER` / `HASCBD`.
- **Which rules** per lot: filtered by **`PERMITZONE`-first** predicates in each tab's `ruleWhere`
  (residential `A,B,C,D,5A`/`2A`/`9A`; commuter `E,G`; LTHS student `H`; employee `CBD,WBD`; with a
  `RULETYPE` fallback only when there is no zone code). This is exact on today's data and correctly
  rescues mislabeled rows.

### Data-quality findings (flag to the data owner)
1. **`RULETYPE` is a noisy heuristic** — e.g. `COMMUTER_DECAL` is tagged on residential zones A–D.
   We therefore trust `PERMITZONE` over `RULETYPE`. This is the project doc's "rule classifier needs
   QA" item; a cleanup pass would let us drop the fallback entirely.
2. **The `AT&T` (`ATT`) permit lot has all `HAS*` flags = 0**, so it currently appears in **no**
   permit tab. Set its audience flag(s) if it should be visible.

### Optional durable fix — `AUDIENCE` field
`scripts/add_audience_field.py` adds + populates an `AUDIENCE` field on `ParkingRule` (PERMITZONE-first
logic, dry-run by default). Once run, simplify each tab's `ruleWhere` to:
`AUDIENCE = 'RESIDENT'` · `AUDIENCE IN ('COMMUTER','STUDENT')` · `AUDIENCE = 'EMPLOYEE'`.

### Diagnostics
`scripts/inspect-service.mjs` (schema + value distributions) and `scripts/verify-filters.mjs`
(per-tab filter counts) — both run read-only against the public service with `node`.

---

<p align="center"><sub>Proprietary — Village of La Grange / Municipal GIS Partners.</sub></p>
