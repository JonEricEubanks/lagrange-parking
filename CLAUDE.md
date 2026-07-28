# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

Two public, mobile-friendly interactive parking maps for the **Village of La Grange**, built from one
codebase (forked from `clf-cbd-parking`). A **permit** app with four permit-type pages and a fully
separate **public/visitor** app. See `README.md` for the stakeholder reframe driving the design.

## Start here

This project was handed off. The docs below are self-contained on purpose — the maintainer does
**not** have access to the `X:` drive where the original project log lives.

| Read | For |
|---|---|
| **`docs/PROJECT-CONTEXT.md`** | Who the client is, how the deliverable got its shape, and the **content rules you must not violate** (no pricing, no "decal", `areaIds` is policy) |
| **`docs/DATA.md`** | The hosted service, the LGDM→FGDB→AGOL pipeline, and **every known data defect** the app works around |
| **`docs/BACKLOG.md`** | Open items, who each is blocked on, and the latest stakeholder meeting |
| **`DEPLOY.md`** | Azure resources + the manual deploy commands |

**Before changing behaviour, check `docs/BACKLOG.md`** — several obvious-looking "bugs" are known
upstream data problems with a decision already attached, and 5 lint errors on `main` are pre-existing.

## Commands

```bash
npm run dev            # permit app  (--mode permit)
npm run dev:public     # public app  (--mode public)
npm run build          # both → dist/permit, dist/public
npm run lint
```

No test framework is configured.

## One app, not a layout chooser

`App.tsx` renders the **Guided Finder** directly — that is the chosen experience and what the
Village reviews. The Explorer and Directory were built as review alternatives and stay reachable at
`#/explorer` and `#/directory` for internal comparison, but **nothing links to them**. There is no
landing page asking the visitor to pick a layout (the old `HomePage.tsx` — in git history if needed).
Do not reintroduce one.

## Architecture

React 19 + TypeScript + Vite + ArcGIS JS SDK v5. No state library — React hooks. Custom CSS with
`--lf-*` / `--font-*` CSS variables (defaults in `src/styles/index.css`, overridden at runtime from
`profile.branding` in `ParkingApp`). Public/anonymous; API key only used if `enableWalkTime` is on.

### Profile-driven

Each experience is a JSON profile in `public/profiles/`. `VITE_PROFILE` (set per build mode in
`.env.permit` / `.env.public`) picks which one `useParkingProfile` loads. A profile controls: layer
URL + field mapping (`nameField`/`rendererField`/`idField`/`spacesField`/`baseWhere`), the related
`ParkingRule` table config, symbology, audience tabs (`where` + `ruleWhere`), branding, extent.

To retarget another community: write a new profile JSON + `.env.<mode>` and drop in brand assets.
Components are generic — **do not hardcode field names** (the clf original hardcoded
`MAINTENANCERESTRICTION`/`LotName`; that has been parameterized).

### Data flow

```
main.tsx (esriConfig.apiKey) → App → useParkingProfile() → GuidedFinder   ← the live experience
  useParkingLayer   → FeatureLayer + UniqueValueRenderer from profile.symbology (baseWhere applied)
  useSelectedLot    → queries the current page's feature set (re-queries on page change)
  useRelatedRules   → queries ParkingRule by AREAID + that page's ruleWhere
  GuidedFinder      → definitionExpression = baseWhere AND memberFilter
                      memberFilter = explicitAreaWhere(tab.areaIds)        ← wins when present
                                   ?? useAudienceAreaIds(ruleWhere)        ← else rules-derived
                                   ?? tab.where (HAS* flags)               ← last resort
    PermitInfo ("What you need to know") | MapPanel | FeatureList | LotDetailCard (+ rules, exhibit)
```

`ParkingApp` **is** the Explorer template (routed at `#/explorer`), not a shared shell.
`AudienceGuide` is its left-rail guide — it replaced the old `LegendSidebar`.

⚠️ **`profile.branding` colors are applied to CSS variables only inside `ParkingApp`**, which the
live app never renders. Today this is invisible, because the `--lf-*` defaults in
`src/styles/index.css` are hardcoded to exactly the same La Grange values. But it means **writing a
new profile alone will not re-theme the app** — retargeting another community also needs that
`useEffect` lifted out of `ParkingApp` into a shared hook (or into `App.tsx`).

### Audience model

The permit app has **four pages**, one per permit type: resident overnight, resident day/night
(24 hr.), commuter & LTHS student, employee.

- **Which lots** per tab: `tab.areaIds` — the Village's own list, verbatim. "Map should only show
  the following lots" is policy, not something to infer from the data. Tabs without an explicit
  list fall back to rules-derived membership (`useAudienceAreaIds`), then to the `HAS*` booleans.
  `scripts/verify-permit-pages.mjs` checks every listed id still resolves against the live service.
- **Which rules** per lot/tab: heuristic `tab.ruleWhere` (RULETYPE/PERMITZONE) until an `AUDIENCE`
  field is added to `ParkingRule`. Stakeholder content rules: **no pricing**, guidance over policy.
- **Permit-wide info** (`tab.guide.sections`) renders in the side panel via `PermitInfo` under the
  heading "What you need to know" — hours, eligibility and limits that apply to every lot on the
  page. **This is the primary content.** Per-lot detail is deliberately secondary: as of 2026-07-28
  the permit profile's `fields.display` is **empty**, so a selected lot shows only its name, its
  parking rules and any designated-space exhibit. That was Charity's call — don't add attribute rows
  back without hers. (The public profile still shows Facility / Spaces / Accessible Spaces.)
- **Display names**: `profile.nameOverrides` (keyed by area id) relabels an area in map labels,
  lists and detail cards without editing hosted data.
- **Designated spaces**: `profile.areaExhibits` attaches a diagram to a lot (some permits are only
  valid in specific spaces inside a lot — see Lot 2).

### Basemap

`basemap.imageryUrl` adds a Map/Aerial toggle. Use **`COUNTY_IMAGERY_COOK_2025_Project`** — the
`GISC_IMAGERY_*` mosaics return 404 for every tile over La Grange even though their service metadata
reads fine, so metadata is not proof of coverage. `scripts/verify-basemaps.mjs` fetches a real
deepest-zoom tile per profile to catch that. The Cook service shares the canvas basemap's tiling
scheme exactly (wkid 3435, 512 px, same origin, L0–L13), so it drops straight in as an alternate
basemap. On aerial the parking polygons drop to `layer.imageryOpacity`, their
labels go light-on-dark (`useParkingLayer.setBasemapMode` — the layer's owner restyles it, MapPanel
only reports the choice), and the Important Places reference layer hides.

## Build modes / deploy

`vite.config.ts` reads `VITE_BASE` + `VITE_OUTDIR` via `loadEnv(mode)`. Permit base
`/lagrange-parking/`, public base `/lagrange-parking-public/`. Each builds to its own `dist/` subdir.

## Data prerequisite

Full data model, pipeline and known defects: **`docs/DATA.md`**.

The hosted `LaGrange_Parking_Permits` layers must be **shared publicly** in AGOL for these anonymous
apps to load them. They are public today.

⚠️ **Republishing the service resets that sharing to org-only**, and both apps immediately break with
`{"code":499,"message":"Token Required"}`. After *any* republish, re-test anonymous access — an
untokened `fetch` of `…/FeatureServer/2/query?where=1=1&returnCountOnly=true&f=json` must return a
count, not an error. Sublayer ids survive an overwrite ([2] ParkingArea, [3] ParkingRule); the
profiles hardcode those URLs.

## Verifying against live data

All read-only, no credentials — run before showing the app to the Village:

```bash
node scripts/verify-permit-pages.mjs   # every listed lot resolves + returns rules for its page
node scripts/verify-basemaps.mjs       # each basemap actually serves a deepest-zoom tile
node scripts/inspect-service.mjs       # schema + value distributions
```

`verify-permit-pages.mjs` also warns when a listed lot returns **no** rules under its page's
`ruleWhere` — that lot draws on the map but its detail card comes up empty. Those are upstream
`RULETYPE` mislabels, not profile bugs. `scripts/verify-filters.mjs` predates the four-page model and
still reports the old three-audience buckets; treat it as historical.
