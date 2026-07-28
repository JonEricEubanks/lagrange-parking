# Backlog & open items

Newest meeting at the top. Anything "blocked" names who it is blocked on.

---

## Meeting with Charity Jones — 2026-07-28

Four outcomes. **One was implemented the same day; the rest are open.**

### ✅ 1. Slim the lot popup — DONE 2026-07-28

Charity asked to remove, from the lot detail card (the "popup" that opens when a lot is selected):

- the **Facility** row (`FACILITYTYPE`)
- the **Spaces** row (`MAXSPACES`)
- **everything under "Details"** — the `Details` heading, `Accessible Spaces` (`NUMHANDICAP`) and
  `Location` (`LOCDESC`)

Implemented by emptying `fields.display` in `public/profiles/lagrange-permit.json`. The permit card
is now **lot name + parking rules + designated-space exhibit**. No component changes were needed —
`LotDetailCard` already guards on `mainFields.length` / `detailFields.length`.

> **Note / unconfirmed:** the card header still shows a colored swatch with the **legend label**
> for the lot ("Parking Lot" / "Parking Garage" / "On-Street Permit Spaces"). That is derived from
> `FACILITYTYPE` and is arguably "the facility type" she asked to remove — but it is also the key
> tying the card to the map colors, so it was left in. **Confirm with Charity.** To remove it, edit
> the `lot-card-header` block in `src/components/LotDetailCard.tsx`.

> Only `lagrange-permit.json` changed. The **public** profile still shows Facility / Spaces /
> Accessible Spaces (it has no Location row), since the meeting covered the permit app. Confirm
> whether the public app should match.

### ☐ 2. Reduce the height of the lot boxes — not started

On the results list ("**7 places to park**"), the lot boxes are tall enough that the
"**What you need to know**" panel below is pushed out of view. Charity wants the boxes shorter so
more of that panel is visible without scrolling.

Where to change it:
- The boxes are **`.finder-list-item`** in `src/styles/index.css` (`padding: 13px 14px`), with
  `.finder-list-name` / `.finder-list-go`. **Not** `.feature-list-item` — that belongs to the
  `FeatureList` component, which only the Explorer/Directory templates use.
- The "N places to park" heading is `src/components/templates/GuidedFinder.tsx` **lines 212 / 242**.
- "What you need to know" is `src/components/PermitInfo.tsx` **line 26**.

Check on mobile too: the results list is a collapsible bottom sheet there (`sheetCollapsed` in
`GuidedFinder.tsx`).

### ✅ 3b. Second round of stylistic changes — DONE 2026-07-28

- **Landing-page title** now reads "Village of La Grange Permit Parking" instead of "Village of
  La Grange". Driven by `picker.brandTitle`; the header on the four inner pages still shows
  `profile.community` so the breadcrumb stays short.
- **Purchase/Apply button is green** (`--lf-accent-green` #43B749, hover `--lf-accent-green-dark`)
  so it stands out from the surrounding blue. `.guide-apply-btn` in `index.css`.
- **Landing-page hero photo placeholder** — `picker.image`. Set `placeholder` for a dashed
  "Village photo goes here" box; **swap in `src` when the Village supplies a real photo** and the
  same slot renders the image (`.finder-hero` / `.finder-hero--placeholder`).
- **Designated-space image placeholder** — `profile.exhibitPlaceholder`, shown on pages flagged
  `tab.expectsDesignatedSpaces` for any lot with no `areaExhibits` entry.

### ✅ 3a. Designated-space diagrams wired for 5 of 7 overnight lots — DONE 2026-07-28

Charity's `Res Overnight Permits - Designated Spaces.pdf` (Heuer and Associates, **dated
12/30/2016**, sheets **1–4 of 5**) was extracted to `public/assets/exhibits/` and wired into
`areaExhibits`:

| Lot | Sheet | Designated spaces |
|---|---|---|
| Lot 2 | 1 of 5 | 74 |
| Lot 5 | 2 of 5 | 36 |
| Lot 12 | 3 of 5 (top) | 21 (12 + 9) |
| Lot 11 | 3 of 5 (bottom) | 10 |
| Lot 13 | 4 of 5 | 31 |

Sheet 3 carries two lots on one page and was split into two crops. Extraction used PyMuPDF from
`C:\Users\jkenny\AppData\Local\ESRI\conda\envs\mgp-agol-mcp\python.exe` (150 dpi; clip rects
`(55,58,565,322)` for Lot 12 and `(55,325,565,700)` for Lot 11).

**Still showing the placeholder:** the **VH Garage** and **Lot 15**.

Open questions on this set:
- **Sheet 5 of 5 was not in the PDF** — presumably the VH Garage. Ask Charity.
- **Lot 15 postdates these drawings** (it is a 2026 lot), so it will never be in this set.
- **Sheet 3's legend reads "21 SPACES"**, which matches Lot 12's 12 + 9 but excludes Lot 11's 10 —
  so the legend appears to describe only the upper map. Captions therefore use each map's own
  labels, not the legend total. Worth confirming.
- **These drawings are ten years old (12/30/2016).** Confirm they still reflect current striping
  before treating them as authoritative.
- The **Employees** page also references designated spaces in its guide text ("designated spaces
  only in Lot 5", "designated on-street spaces on Waiola Ave"), but no employee diagrams exist, so
  `expectsDesignatedSpaces` was deliberately **not** set there — it would show 8 placeholders.

### ☐ 3. Designated overnight parking areas as real GIS features — NEXT, JK to digitize

The static exhibits above are the **interim**. The agreed end state is to draw the designated areas
as real geometry so they render on the map instead of as a scanned diagram, shaded **green where the
permit is valid and red where it is not**.

Step 1 is done — Charity's drawings arrived 2026-07-28. Remaining:

1. **JK digitizes the areas in ArcGIS Pro**, tracing the Heuer sheets against the Cook 2025 aerial.
   The drawings are 2016 CAD-derived and **not georeferenced**, so this is heads-up digitizing; the
   striped bands sit along identifiable lot edges, which makes it tractable.
2. Publish, then reference the layer from the profile and surface it in **"What you need to know"**.

**Recommended structure — a new standalone polygon feature class, published as its own hosted
layer.** Reasons:

- It is **sub-lot geometry**, a different granularity from `ParkingArea`; it cannot be an attribute.
- Publishing it **separately** rather than as a new sublayer of `LaGrange_Parking_Permits` keeps the
  existing service untouched. That matters here: overwriting that service **resets its public
  sharing and breaks both apps** (`DATA.md` §2), and the profiles hardcode sublayer ids `/2` and
  `/3`. A separate layer makes this change purely additive.
- The app joins on `AREAID` anyway — it does not use the relationship class — so nothing is lost by
  not being in the same service.

Suggested schema (build it in `ParkingPermits.gdb` so it lives with the rest, then publish alone):

| Field | Purpose |
|---|---|
| `AREAID` | FK to `ParkingArea` — **must match exactly** (`LOT2`, `LOT15`, …) |
| `DESIGNATION` | `ALLOWED` / `NOT_ALLOWED` — drives the green/red symbology. Use a coded domain. |
| `PERMITTYPE` | Which permit the area applies to. **Needed** — Lot 2 and Lot 5 have both overnight-resident *and* CBD-employee designated spaces, and each page must show only its own. |
| `SPACECOUNT` | Spaces in the band, per the drawing — lets us cross-check the totals |
| `LABEL` | Optional on-map label, e.g. "17 spaces" |
| `SOURCEREF` | Provenance, e.g. "Heuer sheet 3 of 5, 12/30/2016" |

`PERMITTYPE` is the field most likely to be forgotten and the most expensive to add later — without
it the Employees page would show the overnight bands.

Once live, the app filters the layer by the selected lot **and** the current page's permit type, and
the static `areaExhibits` entries can be retired lot by lot as each is digitized.

---

## Carried over — open with the Village

| # | Item | Blocked on |
|---|---|---|
| 1 | **Apply / purchase URL is a placeholder.** `profile.apply.url` (and the `resident-24hr` page's own `guide.apply.url`) both point at `https://www.villageoflagrange.com/`. `PURCHASEURL` is null on every rule row. The "Apply for a Permit Now →" button therefore goes to the Village homepage. | Charity — real Passport/permit URL |
| 2 | **Lot 15 space counts.** `MAXSPACES` / `NUMHANDICAP` are null. Now moot on the permit card (capacity no longer shown) but still wrong in the data. | Charity |
| 3 | **Lot 4** is CBD employee parking in the data but absent from Charity's employee lot list — currently shown nowhere. Confirm it should stay dropped. | Charity |
| 4 | **`ATT` lot** has all audience flags 0 and appears nowhere. Retired, or should it show? | Charity |
| 5 | **Eligibility-area boundaries** — Charity's own open question, never actioned. The `PermitEligibilityZone` convex hulls overshoot (a point inside the hull is not necessarily eligible); the authoritative data is the address list. Options: drop the hull, label it "approximate", or snap to real parcels. | Charity |
| 6 | **Heuer designated-space sheets 2–5 of 5** | Charity — likely folded into item 3 above |

---

## Carried over — engineering

| # | Item | Notes |
|---|---|---|
| 1 | **Three lots show an empty detail card** (Lot 13 on Commuter; Lot 2 and VH Garage on Employees) | Upstream `RULETYPE` mislabels — see `DATA.md` §3.1. Either fix the source data or widen the page's `ruleWhere`. `verify-permit-pages.mjs` warns about these. |
| 2 | **Employee on-street rows are titled "Commuter Permit"** | Same root cause. Heading comes from `RULETYPE`. |
| 3 | **`AUDIENCE` field never added** | `scripts/add_audience_field.py` has never been run; the field does not exist on the live table. Running it would let every `ruleWhere` collapse to one clean predicate. Its `HAS*`-recompute half is obsolete. |
| 4 | **`npm run lint` has 5 pre-existing errors on `main`** | Ref-during-render in `MapPanel`, setState-in-effect in `useParkingLayer` / `useWalkRoute`. **Not new breakage** — don't mistake them for a regression you caused. |
| 5 | **CI does not deploy** | `.github/workflows/deploy.yml` only builds and uploads an artifact. Deploys are manual — see `DEPLOY.md`. Wiring it up needs two GitHub secrets; note `gh` is **not installed** on JK's box. |
| 6 | **Bundle is large** (~1.9 MB main chunk, gzip ~566 kB) | Almost entirely `@arcgis/core`. Vite warns on every build. Not a problem in practice for this audience; code-splitting would be the fix if it ever is. |
| 7 | **`scripts/verify-filters.mjs` is stale** | Predates the four-page model; reports the old three-audience buckets. Either rewrite against `tab.areaIds` or delete it. |
| 8 | **Explorer / Directory templates are unreferenced** | Reachable at `#/explorer` and `#/directory` for internal comparison; nothing links to them. See `CLAUDE.md` — do not reintroduce a layout chooser. |
| 9 | **`profile.branding` is dead code for the live app** | The `useEffect` that writes `--lf-*` CSS variables lives in `ParkingApp.tsx` (the Explorer template), which the live app never renders. Harmless today — the defaults in `src/styles/index.css` are hardcoded to the same La Grange values — but **a new profile alone will not re-theme the app**. Lift that effect into `App.tsx` or a shared hook before retargeting another community. Only `branding.logo` is read by `GuidedFinder`. |
