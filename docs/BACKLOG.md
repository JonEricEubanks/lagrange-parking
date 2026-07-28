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
- The boxes are `.feature-list-item` — `src/styles/index.css` around **line 842** (with
  `.feature-list-item-main`, `-name`, `-meta` following).
- The "N places to park" heading is `src/components/templates/GuidedFinder.tsx` **lines 212 / 242**.
- "What you need to know" is `src/components/PermitInfo.tsx` **line 26**.

Note the 2026-07-28 change above already removed the `· N spaces` text from the box's meta line for
most lots, which shortens some boxes slightly — but the padding is the real driver. Check on mobile
too: the results list is a collapsible bottom sheet there (`sheetCollapsed` in `GuidedFinder.tsx`).

### ☐ 3. Designated overnight parking areas — BLOCKED on Charity

**Every overnight lot has specific spaces where permit holders must park**, and those are not
currently mapped. Today only Lot 2 has anything — a static diagram
(`public/assets/exhibits/lot2-overnight-resident-spaces.png`, from Heuer and Associates sheet 1 of
5), wired through `profile.areaExhibits`.

Agreed plan:
1. **Charity sends the document** defining the designated areas for the remaining lots.
2. **JK digitizes them as a GIS feature** — a new polygon layer, not an attribute.
3. The app links that information into the **"What you need to know"** panel as a designated-spaces
   section.

Nothing to build until step 1 lands. When it does, decide whether the new layer becomes another
sublayer of `LaGrange_Parking_Permits` or a separate hosted layer — the app would reference it as a
`referenceLayers` entry or a new profile block. The existing Heuer sheets **2–5 of 5** are probably
part of what she is sending.

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
