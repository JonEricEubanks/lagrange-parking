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

### ✅ 2. Reduce the height of the lot boxes — DONE 2026-07-28

On the results list ("**7 places to park**"), the lot boxes are tall enough that the
"**What you need to know**" panel below is pushed out of view. Charity wants the boxes shorter so
more of that panel is visible without scrolling.

`PermitInfo` renders **after** the lot list in `GuidedFinder`, so the list's height directly
determines how far down the guide starts. Tightened in `src/styles/index.css`:

| | Before | After |
|---|---|---|
| `.finder-list-item` padding | `13px 14px` | `8px 12px` |
| `.finder-list-item` font-size | 15px | 14px (explicit `line-height: 1.25`) |
| `.finder-list-go` chevron | 20px | 16px (`line-height: 1`) |
| `.finder-list` gap | 8px | 6px |
| `.finder-results-h` margin | `14px 0 8px` | `10px 0 6px` |

Row height 48px → 36px; **the 7-lot Resident Overnight page reclaims ~106px**, which is what lifts
"What you need to know" into view.

The chevron mattered more than it looks: at 20px it set the row's line-box floor, so reducing the
padding alone would not have shrunk the row.

Note the boxes are **`.finder-list-item`** — *not* `.feature-list-item`, which belongs to the
`FeatureList` component that only the Explorer/Directory templates use. Editing the wrong one
changes nothing in the live app.

Width was left alone: the boxes are `width: 100%` of the results panel, so narrowing them would add
dead space without recovering any vertical room.

Still the biggest available lever if she wants more: **`PermitInfo` could move above the lot list**.
Not done — Charity framed the fix as shrinking the boxes, and reordering would bury the lots instead.

### ✅ 3b. Second round of stylistic changes — DONE 2026-07-28

- **Landing-page title** now reads "Village of La Grange Permit Parking" instead of "Village of
  La Grange". Driven by `picker.brandTitle`; the header on the four inner pages still shows
  `profile.community` so the breadcrumb stays short.
- **Purchase/Apply button is green** (`--lf-accent-green` #43B749, hover `--lf-accent-green-dark`)
  so it stands out from the surrounding blue. `.guide-apply-btn` in `index.css`.
- **Cover image on the landing page** — `picker.image`. Renders a dashed "Village photo goes here"
  box today; **when the Village supplies a photo, drop it in `public/assets/` and set `src`** and the
  same slot renders it (`.finder-hero` / `.finder-hero--placeholder` in `index.css`). This is the
  only image placeholder in the app — it is a page cover, not a per-lot diagram.

### ✋ Not doing: static PDF exhibits per lot

Charity's `Res Overnight Permits - Designated Spaces.pdf` (Heuer and Associates, sheets 1–4 of 5)
arrived 2026-07-28. The sheets for Lots 5, 11, 12 and 13 were briefly extracted and wired into
`areaExhibits`, then **removed on JK's call** — the designated areas are going to be **drawn as real
GIS features** (item 3 below), so scanned drawings are not the deliverable and would only have to be
retired again.

The **Lot 2** exhibit predates this and stays, since it came out of Charity's 7/27 review.

Also decided: **do not show space counts.** Captions no longer carry them, and `SPACECOUNT` was
dropped from the proposed layer schema below.

The source PDF is in JK's `Downloads`; re-extract with PyMuPDF if it is ever wanted (sheet 3 carries
Lots 12 and 11 on one page and needs splitting). Two things noticed while reading it, still worth
raising with Charity:
- **Sheet 5 of 5 was not in the PDF** — presumably the VH Garage.
- **The drawings are dated 12/30/2016.** Confirm they still reflect current striping before
  digitizing from them.

### ☐ 3. Designated overnight parking areas as real GIS features — NEXT, JK to digitize

The end state is to draw the designated areas as **real geometry** so they render on the map rather
than as a scanned diagram, shaded **green where the permit is valid and red where it is not**. This
supersedes the static-exhibit approach entirely.

Charity's drawings arrived 2026-07-28, so the inputs are in hand. Remaining:

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
| `SOURCEREF` | Provenance, e.g. "Heuer sheet 3 of 5, 12/30/2016" |

**No space-count field** — the Village does not want counts surfaced (2026-07-28).

`PERMITTYPE` is the field most likely to be forgotten and the most expensive to add later — without
it the Employees page would show the overnight bands.

Once live, the app filters the layer by the selected lot **and** the current page's permit type, and
the static `areaExhibits` entries can be retired lot by lot as each is digitized.

---

## Carried over — open with the Village

| # | Item | Blocked on |
|---|---|---|
| 1 | **Apply / purchase URL is a placeholder.** `profile.apply.url` (and the `resident-24hr` page's own `guide.apply.url`) both point at `https://www.villageoflagrange.com/`. `PURCHASEURL` is null on every rule row. The "Apply for a Permit Now →" button therefore goes to the Village homepage. | Charity — real Passport/permit URL |
| 2 | **Lot 15 capacity is null** (`MAXSPACES` / `NUMHANDICAP`). Moot for display — the permit card no longer shows capacity and the Village does not want space counts surfaced — but still wrong in the data. Low priority. | Charity |
| 3 | **Lot 4** is CBD employee parking in the data but absent from Charity's employee lot list — currently shown nowhere. Confirm it should stay dropped. | Charity |
| 4 | **`ATT` lot** has all audience flags 0 and appears nowhere. Retired, or should it show? | Charity |
| 5 | **Eligibility-area boundaries** — Charity's own open question, never actioned. The `PermitEligibilityZone` convex hulls overshoot (a point inside the hull is not necessarily eligible); the authoritative data is the address list. Options: drop the hull, label it "approximate", or snap to real parcels. | Charity |
| 6 | **Heuer sheet 5 of 5** was missing from the set she sent (sheets 1–4 arrived) — presumably the VH Garage. Needed as a digitizing input for item 3. | Charity |
| 7 | **A cover photo for the landing page.** The Village offered to supply one; a labelled placeholder holds the slot. | Charity |

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
