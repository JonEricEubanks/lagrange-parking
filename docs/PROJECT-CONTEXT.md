# Project Context — La Grange Parking Maps

Background an agent or analyst needs before touching this repo. Ported into the repo on
**2026-07-28** from the running project log at
`X:\GISC\Community\LaGrange\Project\20240829_ParkingDecalMaps\PROJECTDOCUMENTATION.md`, because the
person picking this up **does not have X: drive access**. That file remains the historical
source of truth for the GIS/ArcGIS side; everything needed to work on *the apps* is now here.

---

## 1. What this is and why

**Outcome:** Village stakeholders and the public get accurate, clear visualizations that support
the Village's parking-management and permit-process overhaul.

**Client:** Village of La Grange, IL. **Consultant:** Municipal GIS Partners (MGP).

**Terminology:** the program moved from "decals" → **"permits"**. Charity was explicit: *no more
"decal" anywhere* in public-facing text. The word still exists in the **data** as internal
`RULETYPE` codes (`CBD_DECAL`, `COMMUTER_DECAL`, `BUSINESS_DECAL`) — those are never shown raw;
they map to friendly labels via `ruleSymbology` in the profile JSON. Don't "fix" the codes; fix the
label if one reads wrong.

### People

| Name | Role |
|------|------|
| **Charity Jones** | Assistant Village Manager — **primary client contact and reviewer**. All design/content decisions route through her. |
| Susan Mika | Village stakeholder |
| **John Kenny** | MGP — project lead (took over 2026-06-01) |
| Jillian Stephens | MGP — initial scoping & client comms; available for questions |
| Alex Wilson | MGP — prior analyst; authored most of the original data & maps |

### Timeline

Village program go-live was **end of June 2026** (new signage, lot acquisition, permit-system
upgrade). The apps are **live now** and in an iterate-on-feedback phase with Charity.

---

## 2. How the deliverable got to its current shape

Worth knowing, because the repo still contains artifacts from earlier phases.

1. **Original scope (pre-June 2026):** two ArcGIS **StoryMaps** (resident/permit + visitor) plus a
   data restructure and an address-geocoding task.
2. **2026-06-01:** JK took the project over. Built the data restructure (D1) — see `DATA.md`.
3. **2026-06-02:** published to AGOL — one relational hosted feature service + two styled web maps.
4. **2026-06-18 — Charity's reframe.** She killed the single all-in-one map. The deliverable became
   **two separate audience-targeted web apps**. That is what this repo is.
5. **2026-06-19:** this repo forked from `clf-cbd-parking`; both apps built and deployed to Azure.
6. **2026-07-27:** Charity's 8-page map-comments PDF applied; the permit app became **four
   permit-type pages**; Lot 15 added; the Guided Finder became the only layout.
7. **2026-07-28:** detail-card slimming (this session) — see `BACKLOG.md` for what came out of that
   meeting.

**StoryMaps are not the current deliverable.** The two React apps superseded them. The AGOL web maps
from step 3 still exist and are useful for QA in ArcGIS, but nothing in this repo depends on them —
the apps query the hosted **feature service** directly.

---

## 3. The two apps

One codebase, two builds selected by `VITE_PROFILE` (see `CLAUDE.md` → Architecture).

| | Permit app | Public app |
|---|---|---|
| Profile | `public/profiles/lagrange-permit.json` | `public/profiles/lagrange-public.json` |
| Audience | permit holders | visitors / shoppers / diners |
| Data filter | `USERCLASS = 'PERMIT'` | `USERCLASS IN ('VISITOR','RESTRICTED')` |
| Structure | **four permit-type pages** | one page |
| Colored by | `FACILITYTYPE` (Lot / Garage / On-Street) | `PRIMARYRULE` (time-limit ramp) |
| Live URL | https://mango-cliff-087d26410.7.azurestaticapps.net | https://ashy-mud-0b906db10.7.azurestaticapps.net |

The permit app's four pages are **permit types, not user groups**:
Resident Overnight Only · Resident Day/Night (24 hr.) · Commuter & LTHS Students · Employees.

**The public app contains no permit content at all.** That separation is the whole point of the
reframe — don't merge them or cross-link them.

---

## 4. Content rules from the stakeholder

Non-negotiable unless Charity says otherwise. These are easy to violate by accident.

- **No pricing.** `RATE_TEXT` / `RATE_MONTHLY` exist in the data and are populated
  (e.g. "$45/month daytime"). They are deliberately **not** in any profile's display fields.
  Do not surface them.
- **No "decal"** in any user-visible string.
- **Guidance over policy.** Plain language telling someone where they may park, not ordinance text.
- **`tab.areaIds` is the Village's verbatim lot list** and is policy, not a data-derived guess.
  "The map should only show the following lots" — do not replace it with an inferred list.
- **Per-lot detail is secondary.** The primary sidebar content is the permit-wide
  "What you need to know" panel (`PermitInfo.tsx`, fed by `tab.guide.sections`). As of 2026-07-28
  the per-lot card is deliberately minimal — name, rules, designated-space exhibit.

---

## 5. Where things live outside this repo

The new maintainer will not have access to most of this. Recorded so it can be requested.

| Thing | Location |
|---|---|
| Running project log (history, GIS decisions) | `X:\GISC\Community\LaGrange\Project\20240829_ParkingDecalMaps\PROJECTDOCUMENTATION.md` |
| ArcGIS Pro project + source FGDB | `…\20240829_ParkingDecalMaps\APRX\Parking_Permit_Restructure\` |
| Village policy PDFs, eligibility spreadsheets | `…\20240829_ParkingDecalMaps\Village Policies and Documentation\` |
| Charity's review PDFs (map comments, exhibits) | delivered by email; extracted assets live in `public/assets/exhibits/` |
| AGOL org | https://lagrangeil.maps.arcgis.com (named user `LaGrange_IL_ADMIN`) |
| AGOL publish scripts | `C:\dev\agent1\actions\agol\scripts\` (JK's machine) |
| Azure resources | tenant `Community-Essentials.com`, RG `rg-lagrange-parking` — see `DEPLOY.md` |

**The apps depend on none of it at runtime.** They are static bundles that query one public AGOL
feature service. You can develop, build and deploy with nothing but this repo, `npm`, and the `az`
CLI. The X: drive matters only when the *underlying data* must change (see `DATA.md`).
