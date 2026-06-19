# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

Two public, mobile-friendly interactive parking maps for the **Village of La Grange**, built from one
codebase (forked from `clf-cbd-parking`). A **permit** app with three audience tabs and a fully
separate **public/visitor** app. See `README.md` for the stakeholder reframe driving the design.

## Commands

```bash
npm run dev            # permit app  (--mode permit)
npm run dev:public     # public app  (--mode public)
npm run build          # both → dist/permit, dist/public
npm run lint
```

No test framework is configured.

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
main.tsx (esriConfig.apiKey) → App → useParkingProfile() → ParkingApp
  useParkingLayer   → FeatureLayer + UniqueValueRenderer from profile.symbology (baseWhere applied)
  useSelectedLot    → queries the current audience feature set (re-queries on tab change)
  useRelatedRules   → queries ParkingRule by AREAID + per-tab ruleWhere
  ParkingApp        → composes definitionExpression = baseWhere AND tab.where AND legendFilter
    LegendSidebar (filter) | MapPanel | DetailPanel → LotDetailCard (+ related rules) + FeatureList
```

### Audience model

- **Which lots** per tab: exact, via `ParkingArea.HAS*` booleans (`HASRESIDENT`/`HASCOMMUTER`/`HASCBD`).
- **Which rules** per lot/tab: heuristic `tab.ruleWhere` (RULETYPE/PERMITZONE) until an `AUDIENCE`
  field is added to `ParkingRule`. Stakeholder content rules: **no pricing**, guidance over policy.

## Build modes / deploy

`vite.config.ts` reads `VITE_BASE` + `VITE_OUTDIR` via `loadEnv(mode)`. Permit base
`/lagrange-parking/`, public base `/lagrange-parking-public/`. Each builds to its own `dist/` subdir.

## Data prerequisite

The hosted `LaGrange_Parking_Permits` layers must be **shared publicly** in AGOL for these anonymous
apps to load them (currently org-only).
