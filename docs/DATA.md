# Data — model, pipeline, and known problems

Everything the apps read, where it comes from, and what is wrong with it. Verified against the live
service on **2026-07-28**.

---

## 1. What the apps read

One public AGOL hosted feature service, queried anonymously over REST. No login, no proxy.

**`LaGrange_Parking_Permits`** — La Grange org, item `f13e7fa3199141a2be6c2eea816de8d4`
`https://services2.arcgis.com/FwavjPsU0K1YB1vX/arcgis/rest/services/LaGrange_Parking_Permits/FeatureServer`

| Sublayer | Name | Count | Used by the apps? |
|---|---|---|---|
| `/0` | `PermitEligibleAddress` (points) | 263 | **No** — Charity removed eligibility points 2026-06-11 |
| `/1` | `StudyZone` (polygons) | 9 | No |
| `/2` | **`ParkingArea`** (polygons) | 144 | **Yes** — `layer.url` in both profiles |
| `/3` | **`ParkingRule`** (table) | 173 | **Yes** — `relatedRules.url` in both profiles |

Of the 144 `ParkingArea` features: **21** are `USERCLASS='PERMIT'` (permit app) and **123** are
`VISITOR`/`RESTRICTED` (public app).

> **Sublayer ids are hardcoded in the profile JSONs.** They survive a service overwrite, so this is
> safe — but if the service is ever rebuilt from scratch rather than overwritten, re-check them.

A second service supplies map context only:
`LaGrangeImportantPlaces_ParkingContext_/FeatureServer/0` (`referenceLayers` in the permit profile).

### `ParkingArea` — the fields that matter

`AREAID` (primary key, e.g. `LOT5`, `OS115790`) · `AREANAME` · `FACILITYTYPE` (Lot / Garage /
On-Street — the permit app's renderer field) · `USERCLASS` (VISITOR / PERMIT / RESTRICTED — splits
the two apps) · `PRIMARYRULE` (the public app's renderer field) · `MAXSPACES` · `NUMHANDICAP` ·
`LOCDESC` · `HASRESIDENT` / `HASCOMMUTER` / `HASCBD` (audience booleans) · `GEODBID` (`024`).

`AREAID` is derived from the lot name uppercased with non-alphanumerics stripped — `Lot 15` →
`LOT15`. **Any other spelling silently breaks the `tab.areaIds` lists.**

### `ParkingRule` — related 1→many on `AREAID`

`AREAID` · `RULETYPE` · `USERCLASS` · `ISPERMIT` · `PERMITNAME` · `PERMITZONE` (A–H / CBD / WBD /
2A / 5A / 9A / NONE) · `ENFORCE_DAYS` · `ENFORCE_START` · `ENFORCE_END` · `ENFORCE_TEXT` ·
`MAXDURATION` · `RATE_TEXT` · `RATE_MONTHLY` · `PURCHASEURL` · `ORDINANCEREF` · `SRC_OID`.

`RULETYPE` domain: `FREE_15MIN` `FREE_30MIN` `FREE_1HR` `FREE_2HR` `FREE_3HR` `FREE_4HR` `METERED`
`UNRESTRICTED` `NO_PARKING` `DECAL_ZONE` `CBD_DECAL` `COMMUTER_DECAL` `OVERNIGHT_RESIDENT`
`DAYTIME_RESIDENT` `BUSINESS_DECAL`.

The apps show `ENFORCE_TEXT` ("When") and `MAXDURATION` ("Time limit") only. **`RATE_TEXT` is
populated but deliberately never displayed** — no pricing (see `PROJECT-CONTEXT.md` §4).
`PURCHASEURL` is **null on every row**, so the per-rule "How to apply" button never renders.

---

## 2. The pipeline behind the service

```
LGDM  mgp-sql02 / GISC_PRODUCTION / DBO.Parking_Restriction_POLY   (GEODBID '024', versioned)
  │   the Village's authoritative parking inventory, edited in ArcGIS Pro
  │   ─ lagrange_build_fgdb.py  (de-fragments lots, un-stacks rules)
  ▼
FGDB  X:\...\APRX\Parking_Permit_Restructure\ParkingPermits.gdb
  │   ParkingArea / ParkingRule / StudyZone / PermitEligibleAddress + 6 domains + rel class
  │   ─ lagrange_publish_relational.py  (overwrites the hosted service)
  ▼
AGOL  LaGrange_Parking_Permits  (public)
  │
  ▼
Apps  anonymous REST queries from the two static bundles
```

Build/publish scripts live on JK's machine at `C:\dev\agent1\actions\agol\scripts\` — **not in this
repo**, and they need `arcpy` (conda env `mgp-agol-mcp`) plus AGOL credentials. **An app-side agent
cannot run them.** Data changes are a JK task.

**The restructure this pipeline performs** (this is the project's core data win): in LGDM one
physical lot is fragmented into several overlapping polygons, one per restriction type — Lot 5 was
5 overlapping rows — and each row stacks up to three enforcement rule-sets. The build dissolves
same-named off-street features into **one** `ParkingArea` and un-stacks every rule into its own
`ParkingRule` row.

### ⚠ Republishing resets public sharing

`UploadServiceDefinition` with `overwriteExistingService=True` **wipes the service's public sharing
back to org-only**, and both apps instantly break with `{"code":499,"message":"Token Required"}`.

The publish script was fixed on 2026-07-27 to set `sharing_level = SharingLevel.EVERYONE`, but
**verify anonymously after every republish** — no token, expect a count and not an error:

```bash
curl -s "https://services2.arcgis.com/FwavjPsU0K1YB1vX/arcgis/rest/services/LaGrange_Parking_Permits/FeatureServer/2/query?where=1=1&returnCountOnly=true&f=json"
```

### ⚠ Two known build-script defects

Expect these if the FGDB is ever rebuilt from LGDM:

1. **`HASCBD` comes back 0 for a WBD-only lot.** `emit_area()` sets it from `CBD_DECAL` only, not
   `BUSINESS_DECAL`. Harmless for the four permit pages (they use explicit `areaIds`) but it makes
   the Directory audience badges wrong. One-line fix:
   `has_cbd = 1 if (rts & {'CBD_DECAL','BUSINESS_DECAL'}) else 0`.
2. **`MAXSPACES` comes back `0`, not null**, because `emit_area()` collapses an empty
   `MAXPARKINGSPACES` to `0`. See §3.3 — the apps now suppress zeros, so this is contained, but the
   underlying value is still wrong.

---

## 3. Known data problems

These are **upstream data** issues, not app bugs. Fixing them properly means editing LGDM and
republishing. The app works around them where it safely can.

### 3.1 `RULETYPE` is a noisy heuristic — three lots show an empty card

`RULETYPE` was assigned by a keyword classifier over free text, and it is wrong in places. Each
page's `tab.ruleWhere` filters on `PERMITZONE` first and falls back to `RULETYPE` where there is no
zone code — so a mislabeled row with no zone **drops its lot out of its own page**.

Three lots currently return **no rules at all** for the page they are listed on, and render a
detail card with nothing in it:

| Page | Lot | Why |
|---|---|---|
| Commuter & LTHS Students | **Lot 13** | Its rules are typed `OVERNIGHT_RESIDENT`, though `LOCDESC` reads "Commuter Parking Only" and the page guide references Lot 13 commuter verification |
| Employees | **Lot 2** | Its CBD rule is typed `COMMUTER_DECAL` with `PERMITZONE = NONE`, so nothing matches |
| Employees | **VH Garage** | Has no employee rule at all, though the guide says CBD permits are valid on Levels 2–3 |

`node scripts/verify-permit-pages.mjs` reports these as a WARNING block. **Re-run it after any data
change** — if the list shrinks, the data got better.

The same noise in the other direction: four employee on-street rows are typed `COMMUTER_DECAL` and
are rescued onto the Employees page by `PERMITZONE IN ('CBD','WBD')` — but the rule heading renders
from `RULETYPE`, so a CBD employee sees a row **titled "Commuter Permit"**. Cosmetic but confusing.

**The durable fix** is `scripts/add_audience_field.py`, which adds and populates an `AUDIENCE` field
on `ParkingRule` using PERMITZONE-first logic. It is **dry-run by default and has never been run** —
`AUDIENCE` does not exist on the live table (verified 2026-07-28). Once run, each page's `ruleWhere`
collapses to `AUDIENCE = 'RESIDENT'` / `IN ('COMMUTER','STUDENT')` / `= 'EMPLOYEE'`. Note its
**`HAS*`-recompute half is now obsolete** — the explicit `areaIds` lists supersede it.

### 3.2 Duplicate and bare rule rows

The un-stacking produces near-duplicate rows: Lot 5 on the Day/Night page shows **7** rules,
including three `Permit Zone` rows and three resident rows with overlapping windows
(`2:00am-6:00am`, `6:00am-6:00pm`, `6:00pm-2:00am`). All are real rows in the source — nothing is
suppressed there, and it is the noisiest card in the app.

Separately, 18 rows have **no enforcement window and no duration**. Where such a row duplicates a
populated row of the same type it rendered as a heading with nothing under it; `LotDetailCard.tsx`
now drops those (6 on the permit pages, 2 on the public app). A bare row that is the *only* row of
its type is kept, so no lot ever loses its sole rule.

### 3.3 Capacity is not inventoried

`MAXSPACES = 0` on **every on-street area** and on **117 of the 123** public-app features; Lot 15 is
`null`. Zero here means "never counted", not "no spaces". Both apps therefore **suppress the count
entirely when it is 0/null** rather than print "0 spaces" — via the `hideZero` flag on a profile
field (`src/config/types.ts` → `FieldDef`), honoured by `LotDetailCard`, plus a `> 0` guard in
`FeatureList.tsx`.

The permit app no longer displays capacity at all (2026-07-28 — Charity), so `hideZero` is currently
load-bearing only for the **public** profile. Keep the mechanism.

### 3.4 Areas deliberately not shown

- **Lot 4** — `HASCBD = 1`, `LOCDESC` "CBD Permit Parking Only 6am to 6pm", but it is **absent from
  Charity's employee lot list**, so it appears on no page. Believed intentional; unconfirmed.
- **`ATT`** (AT&T lot) — all `HAS*` flags 0, on no page's `areaIds`, `LOCDESC` null. Appears nowhere.
  Possibly retired; unconfirmed.

Because `tab.areaIds` overrides the `HAS*` booleans entirely, neither can leak onto a map. Each
tab's `where` (`HASRESIDENT = 1` etc.) is now **inert** for all four permit pages — it survives only
as a fallback for a future tab defined without an explicit list.

### 3.5 Lot 15 is live but half-provisioned

Digitized by JK 2026-07-27 and published (`ParkingArea` 143→144, `ParkingRule` 170→173). It is
**also backfilled into LGDM** — 3 features inserted into version `DBO.VLG`, left **UNPOSTED for JK
to reconcile and post**. `MAXSPACES` and `NUMHANDICAP` are null pending counts from Charity.

LGDM notes for whoever posts it: LGDM is traditionally versioned with editor tracking and each
community has its own version (`DBO.VLG` = La Grange). Text fields are narrow — `SOURCE` holds 20
chars, `PRODUCTIONNOTES` 100, and overflow aborts mid-transaction with "Invalid column value".
`FEATUREID` = GEODBID + OBJECTID; `REPLICAFILTER` must be `VLG`. The full backfill recipe (three
same-named features dissolve into one area; `PERMITNAME` wording drives `RULETYPE` through an
ordered keyword match — row 2 **must** say "Daytime" and must **not** say "Overnight") is in the
X: drive log under §2026-07-27.

---

## 4. Verifying against live data

All read-only, no credentials, plain `node`. **Run these before showing the apps to the Village.**

```bash
node scripts/verify-permit-pages.mjs   # every listed lot resolves AND returns rules for its page
node scripts/verify-basemaps.mjs       # each basemap actually serves a deepest-zoom tile
node scripts/inspect-service.mjs       # schema + value distributions
node scripts/inspect-residents.mjs     # resident-page specific dump
node scripts/preview-data-fix.mjs      # read-only preview of the AUDIENCE/HAS* recompute
```

`scripts/verify-filters.mjs` **predates the four-page model** and still reports the old
three-audience buckets — historical, do not trust its output.

### Why `verify-basemaps.mjs` exists

The `GISC_IMAGERY_*` mosaics (2024/2025/2026) return **HTTP 404 for every tile over La Grange at
every zoom**, even though their `?f=json` service metadata reads perfectly. **Metadata is not proof
of coverage.** The aerial basemap therefore uses **`COUNTY_IMAGERY_COOK_2025_Project`**, which
serves real tiles and shares `GISC_BASEMAP_LIGHTCANVAS`'s tiling scheme exactly (wkid 3435, 512 px,
same origin, L0–L13), so it drops straight in. The script fetches an actual deepest-zoom tile per
profile to catch a silent regression.

### Python scripts (JK only — need arcpy + credentials)

`scripts/add_audience_field.py` · `scripts/populate_lot15.py` · `scripts/lgdm_add_lot15.py`.
All default to dry-run and take `--commit`. Conda env:
`C:\Users\jkenny\AppData\Local\ESRI\conda\envs\mgp-agol-mcp`.

> `import arcpy` rebinds `datetime` to the module — alias the class on import if you need it.
