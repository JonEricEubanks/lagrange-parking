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

### ◐ 3. Designated overnight parking areas as real GIS features — DIGITIZED, not yet published

**What these are and why Charity asked for them is documented in full in [`DATA.md` §3.6](DATA.md).**
Short version: an overnight resident permit only lets you park in specific designated spaces
*inside* a lot, not anywhere in it. The permit pages were telling residents which *lots* they could
use while staying silent on where inside the lot — which is the part that actually gets people
ticketed. Charity supplied the Village's engineering drawings (Heuer and Associates, sheets 1–4 of
5, dated 12/30/2016) and asked that the areas be drawn as real map features rather than shown as
scanned diagrams.

**Done 2026-07-28 —** JK digitized `OvernightResidentSubzones` into `ParkingPermits.gdb`: 8 polygons
covering Lots 2, 5, 11, 12 and 13, EPSG 3435. Verified: every polygon's centroid falls inside its
parent lot, and the areas track the sheet counts (Lot 13 is the one outlier at roughly 2× — probably
a double-loaded row or the drive aisle inside the trace; worth an eyeball, blocks nothing).

**Scope decision — only the permitted areas were drawn**, not the prohibited ones. The rule is
"park in these areas, nowhere else in the lot", so red polygons would have meant digitizing the
entire remainder of every lot to express what the green areas already imply. Two consequences the
app must handle, both covered below.

**Not drawn:** the **VH Garage** (Heuer sheet 5 of 5 was missing from the set Charity sent) and
**Lot 15** (a 2026 lot; these drawings are from 2016). Both need requesting.

Remaining:

1. **Add the join key** — `python scripts/add_subzone_areaid.py --commit`. As drawn the only
   attribute is `Zone` ("2", "5", "12"); the app joins on `AREAID`. Dry run passes, all 8 resolve.
   Do not concatenate `"LOT" + Zone` in the browser — it breaks on the VH Garage, which is next up.
2. **Publish as its own hosted feature layer**, shared publicly. **Not** as a new sublayer of
   `LaGrange_Parking_Permits` — overwriting that service resets its sharing and takes both live apps
   down (`DATA.md` §2), and the profiles hardcode sublayer ids `/2` and `/3`.
3. **Wire up the app** — design below.

Note there is **no `PERMITTYPE` field**: the feature class is overnight-resident by definition. If
employee designated spaces are ever drawn they need a separate feature class or a type field — Lots
2 and 5 have both overnight-resident *and* CBD-employee designated spaces, and each page must show
only its own.

### App-side design for the subzones

Charity's requirement: the subzones should show **when you click into a lot and are zoomed in**, not
across the whole downtown, "so it isn't messy". That is two independent gates, and both are needed:

- **Scale** — a `minScale` so the bands never draw when zoomed out. They are 1,200–10,000 sq ft and
  illegible above roughly **1:4000**. Make it profile-driven so it can be tuned without a rebuild.
- **Selection** — filter to the selected lot's `AREAID`, so only the lot being viewed highlights.

Both belong in the profile — e.g. a `subzones` block with `url`, `keyField`, `minScale`, fill and
outline. Keep it generic; no hardcoded field names (`CLAUDE.md`).

⚠️ **The YES-only decision has a trap.** Because absence of green now carries meaning, the app has
to state the rule in words ("park only in the highlighted areas") rather than let users infer it —
**and** absence of green is ambiguous in the data: it can mean "nothing is permitted here" or "not
drawn yet". The VH Garage and Lot 15 are in the second state. **Gate the message on the lot actually
having subzones**, and leave those two on the existing generic guidance until their drawings arrive.
Showing "park only in the highlighted areas" on a lot with no highlights would read as "you cannot
park anywhere here", which is wrong.

Once live, the Lot 2 `areaExhibits` diagram can be retired.

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
