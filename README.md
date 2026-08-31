<p align="center">
  <img src="public/assets/lagrange-mark.png" alt="Village of La Grange" width="120">
</p>

<h1 align="center">Village of La Grange — Parking Maps</h1>

<p align="center">
  Two public, mobile-friendly interactive parking maps for the Village of La Grange.<br/>
  Built by <strong>Municipal GIS Partners (MGP)</strong>
</p>

---

## Documentation

This repo is **self-contained** — the project history that used to live only on the MGP `X:` drive
has been ported in, so no network-share access is needed to pick the project up.

| Doc | What's in it |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Architecture, conventions, and agent guidance — **start here** |
| [`docs/PROJECT-CONTEXT.md`](docs/PROJECT-CONTEXT.md) | Client, stakeholders, how the deliverable got its shape, content rules |
| [`docs/DATA.md`](docs/DATA.md) | Data model, LGDM→FGDB→AGOL pipeline, known data defects, verification |
| [`docs/BACKLOG.md`](docs/BACKLOG.md) | Open items and the latest stakeholder meeting |
| [`DEPLOY.md`](DEPLOY.md) | Azure resources and the manual deploy commands |

## Two experiences, one codebase

Per the stakeholder reframe, the old "single map with everything" is replaced by **two separate, audience-targeted apps**, each driven by its own profile JSON:

| App | Profile | Audience | Filter |
|-----|---------|----------|--------|
| **Permit** | `public/profiles/lagrange-permit.json` | Four permit-type pages: Resident Overnight Only · Resident Day/Night (24 hr.) · Commuter & LTHS Students · Employees | `USERCLASS = 'PERMIT'`, then the page's explicit `areaIds` list |
| **Public** | `public/profiles/lagrange-public.json` | Visitors / shoppers / diners | `USERCLASS IN ('VISITOR','RESTRICTED')`, color-coded by time limit |

Each map shows **only what is relevant to its audience** — applicable lots, zones and rules — and the public map contains **no permit content** at all.

## Data source

Hosted feature service **`LaGrange_Parking_Permits`** on the La Grange AGOL org
(`https://lagrangeil.maps.arcgis.com`, item `f13e7fa3199141a2be6c2eea816de8d4`):

- `…/FeatureServer/2` — **ParkingArea** (polygons; `USERCLASS`, `PRIMARYRULE`, `HAS*` audience flags, `AREAID`)
- `…/FeatureServer/3` — **ParkingRule** (related table, 1:many on `AREAID`)

> ⚠️ **The layers must be shared publicly in AGOL** for these anonymous public apps to load them.
> They are public today — but **republishing the service resets sharing to org-only** and both apps
> break instantly with `Token Required`. Re-test anonymous access after every republish.

The "paths to the maps" live in the **profile JSON** (`layer.url`, `relatedRules.url`, `itemId`), not in `.env`.

## Getting started

```bash
git clone https://github.com/mgp-inc/lagrange-parking.git
cd lagrange-parking
npm install
npm run dev                 # permit app → http://localhost:5173/
```

That is the whole setup — **the app runs with no `.env` at all.** `.env.permit` / `.env.public` are
committed and need no edits.

`.env` (gitignored, holds `VITE_ARCGIS_API_KEY`) is the one file a clone cannot give you, but it is
**not** required to develop: verified 2026-08-05, the GISC tiled basemaps serve tiles anonymously.
Comments in `src/main.tsx` and in the committed `.env` claim otherwise — treat those as stale until
`scripts/verify-basemaps.mjs` says different. Add a key for production builds anyway (insurance
against an AGOL sharing change, and required if `enableWalkTime` is ever enabled): copy
`.env.example` → `.env` and get the key from MGP, or mint a referrer-restricted one.

Nothing else is required — no VPN, no `X:` drive, no ArcGIS Pro, no AGOL login. The apps are static
bundles that read one public feature service. ArcGIS Pro and AGOL credentials only matter if you need
to change the *underlying data* (`docs/DATA.md`).

Sanity-check the live services before you trust anything you see:

```bash
node scripts/verify-permit-pages.mjs   # every listed lot resolves + returns rules
node scripts/verify-basemaps.mjs       # each basemap actually serves a tile
```

## Commands

```bash
npm run dev            # permit app  → http://localhost:5173/
npm run dev:public     # public app  → http://localhost:5173/ (next free port if permit is up)
npm run build          # builds both → dist/permit and dist/public
npm run build:permit
npm run build:public
npm run lint           # 5 pre-existing errors on main — not your regression, see docs/BACKLOG.md
```

Profile selection, base path and output dir are set per build mode in `.env.permit` / `.env.public`.
No test framework is configured.

## Deployment

Both apps are deployed as separate **Azure Static Web Apps (Free)**. See
**[DEPLOY.md](DEPLOY.md)** for resources, build/deploy commands, custom domains, and
prerequisites (AGOL public sharing, ArcGIS key referrer restriction).

## Tech stack

React 19 · TypeScript · Vite 7 · ArcGIS JS SDK (`@arcgis/core` v5). No login — the app never prompts
for an ArcGIS identity (`esriConfig.request.useIdentity = false`).

> **`VITE_ARCGIS_API_KEY` is optional in practice**, despite comments in `src/main.tsx` and `.env`
> saying the basemap requires it. Verified 2026-08-05: both GISC tiled basemaps serve tiles
> anonymously. Keep the key in production builds as insurance and for routing
> (`enableWalkTime`, off today). See [Getting started](#getting-started).

## Brand

Village of La Grange Brand Guidelines (0719): Dark Blue `#00306C`, La Grange Blue `#126BB5`,
Medium Blue `#13ACE1`, Green `#43B749`, Light Blue `#A8E0F8`, Mint `#D8ECD4`. Fonts: Nunito Sans
(Avenir substitute) + Oswald (Acumin substitute). Logo assets in `public/assets/`.

## Audience filtering (verified against live data)

- **Which lots** per page: the Village's own verbatim list in `tab.areaIds` — "the map should only
  show the following lots" is policy, not something to infer. This **overrides** both the
  rules-derived lookup and the `HAS*` booleans (each tab still carries a `where` as a fallback for
  tabs that have no explicit list; for all four current pages it is inert).
- **Which rules** per lot/page: `PERMITZONE`-first predicates in each page's `ruleWhere`
  (residential `5A`/`2A`/`9A`; commuter `A–E,G`; LTHS student `H`; employee `CBD,WBD`), with a
  `RULETYPE` fallback where there is no zone code.

### Data-quality findings (flag to the data owner)
1. **`RULETYPE` is a noisy heuristic.** Because `ruleWhere` keys off it where no `PERMITZONE`
   exists, a mislabeled row drops a lot out of its own page. Three lots currently return **no rules**
   and so show an **empty detail card** — caught by `verify-permit-pages.mjs`:
   - **Lot 13** on *Commuter & LTHS Students* — its rules are typed `OVERNIGHT_RESIDENT` even though
     `LOCDESC` reads "Commuter Parking Only" and the page guide references Lot 13 commuter verification.
   - **Lot 2** and **VH Garage** on *Employees* — the guide states CBD permits are valid in both, but
     Lot 2's CBD rule is typed `COMMUTER_DECAL` with no zone, and the Garage has no employee rule at all.
2. Conversely, four employee on-street rows are typed `COMMUTER_DECAL` but rescued by
   `PERMITZONE IN ('CBD','WBD')` — they render on the Employees page **titled "Commuter Permit"**,
   because the rule heading is driven by `RULETYPE`.
3. **The `AT&T` (`ATT`) permit lot has all `HAS*` flags = 0** and is on no page's `areaIds`, so it
   appears in **no** permit page. **Lot 4** is `HASCBD = 1` ("CBD Permit Parking Only 6am to 6pm")
   but is absent from the Village's employee list, so it is likewise not shown. Both are intentional
   today — confirm with the Village.
4. **Capacity is not inventoried for on-street areas** — `MAXSPACES = 0` on all of them (and 117 of
   123 public-app features), and Lot 15 is `null`. The apps now suppress the spaces line rather than
   print "0 spaces"; real counts would let it show everywhere.

### Optional durable fix — `AUDIENCE` field
`scripts/add_audience_field.py` adds + populates an `AUDIENCE` field on `ParkingRule` (PERMITZONE-first
logic, dry-run by default) — **not yet run; the field does not exist on the live table.** Once run,
each page's `ruleWhere` simplifies to `AUDIENCE = 'RESIDENT'` · `IN ('COMMUTER','STUDENT')` ·
`= 'EMPLOYEE'`. Note its `HAS*`-recompute half is now superseded by the explicit `areaIds` lists.

### Diagnostics
`scripts/inspect-service.mjs` (schema + value distributions) and `scripts/verify-filters.mjs`
(per-tab filter counts) — both run read-only against the public service with `node`.

---

<p align="center"><sub>Proprietary — Village of La Grange / Municipal GIS Partners.</sub></p>
