# Scheduled updates — October 2026

Two dated changes the Village asked for, still to do. Each is a **profile-only edit** to
`public/profiles/lagrange-permit.json`, then build, verify, commit, push and deploy the
**permit** app. No component code changes, no GIS/AGOL changes, and the public (visitor) app
does not change.

| When | Update | Status |
|---|---|---|
| 9/25 close of business | Purchase buttons → "Online purchasing currently unavailable" notice | ✅ Done 2026-09-28 (`c8629c0`) |
| 9/28 | Resident eligibility "prior to 1993" → "prior to 1991" | ✅ Done 2026-09-28 (`c8629c0`) |
| **10/1**, 12:01 a.m. or start of business | Purchase buttons → the new online store | 🟡 Committed & pushed 2026-09-30 (`4f78c5f`); **SWA deploy pending** |
| **10/20**, start of business, **no later than noon** | Show Lot 15 again on Resident Day/Night and Employees | ⏳ To do |

Once an update ships, mark it ✅ in this table with the date and commit hash.

---

## Before you start (read this every time)

1. **Work in the root folder `C:\CodeApps\LagrangeParking`.** The nested `lagrange-parking\`
   folder inside it is an **old, stale copy**. On 2026-09-28 edits were made there by mistake and
   the local preview wrongly showed "Lot 5 CBD" on the resident pages. Do not edit, build or
   deploy from it.
2. **Get the latest code first:** `git fetch origin` then `git pull --ff-only origin main`.
   The local branch is named `master`; GitHub's is `main`. Push with `git push origin HEAD:main`.
3. **Commit only `public/profiles/lagrange-permit.json`.** The working tree carries unrelated
   uncommitted files (the Word developer guide, its backup and `~$` lock file, and the
   `lagrange-parking` submodule pointer). Leave them out.
4. **Do not undo these existing, correct settings.** They are how the live site is supposed to look:
   - `layer.baseWhere` excludes `AREANAME <> 'Lot 5 CBD'`, and the `overlayLayers` entry shows
     Lot 5 CBD only on `employees` as a band. If "Lot 5 CBD" shows up as a labeled lot on a resident
     page, you are on stale code — stop and go back to step 1.
   - Lot 4 is on the Employees page.
   - Lot 15 stays **off** Resident Overnight Only and Commuter & LTHS Students, even after 10/20.
5. Use the direct URLs below. **Never paste the Outlook "safelinks.protection.outlook.com"
   wrappers** from the client's email.

---

## October 1 — switch purchase buttons to the new online store

> **Status 2026-09-30:** profile edit done, built, `verify-permit-pages.mjs` clean (only the 3 known
> warnings), checked locally, committed and pushed as `4f78c5f`. **Only remaining step: deploy the
> permit app to SWA on 10/1** (see "Ship it" → deploy and "Confirm it's live"), then mark ✅ above.

**Client request:** "10/1 – At 12:01 am or at start of business, the 'Apply for a Permit Now' link
needs to be redirected to https://lagrangeil.cmrpay.com. This will remain the link for the
foreseeable future."

> ⚠️ **Confirm the URL with the Village before shipping.** The client wrote `lagrangeil.cmrpay.com`,
> but the store the site used before the blackout was `lagrangepermits.rmcpay.com` ("rmc", not
> "cmr"). Open the new URL in a browser; if it doesn't load a La Grange permit store, ask the
> Village before deploying.
>
> **2026-09-30:** `https://lagrangeil.cmrpay.com` responds 200 and redirects to `/dashboard`, a
> "Passport Customer Portal" (Passport is the Village's new permit platform). Shipped as written.

### What to change

There are **two** purchase buttons, and **both** must change. They are the same green button in
the side panel; one page just overrides its label.

| JSON path | Label shown | Pages |
|---|---|---|
| `apply.url` (top level) | Apply for a Permit Now → | Resident Overnight, Commuter & LTHS, Employees |
| `tabs[id="resident-24hr"].guide.apply.url` | Purchase a Permit → | Resident Day/Night (24 hr.) |

Replace **both** occurrences of

```
https://www.villageoflagrange.com/DocumentCenter/View/3775/Online-Purchasing-Currently-Unavailable
```

with

```
https://lagrangeil.cmrpay.com
```

(or the corrected URL the Village confirms). Leave the labels alone.

Afterwards the string `Online-Purchasing-Currently-Unavailable` must not appear anywhere in the
profile.

Leave the "Effective October 1st, …" sentences on the two resident pages as they are unless the
Village asks otherwise.

---

## October 20 — show Lot 15 again

**Client request:** "On 10/20, we need to turn on Lot 15 to be visible in its appropriate places on
the web pages. This can be as early as start of business on 10/20 but should be no later than noon
on 10/20."

**Clarified with the client:** before it was hidden, Lot 15 was shown on **Resident Day/Night
(24 hr.)** and **Employees**, so add it back to exactly those two pages.

### What to change

Which lots each page shows is controlled only by `tabs[].areaIds`. That list is the Village's
policy, taken as written, and nothing else should be inferred from it. Add `"LOT15"` to two arrays:

```jsonc
// tabs[id="resident-24hr"]
"areaIds": ["LOT2", "LOT5", "VILLAGEHALLPARKINGSTRUCTURE", "LOT15"],

// tabs[id="employees"] — insert after VILLAGEHALLPARKINGSTRUCTURE, keep everything else
"areaIds": [
  "LOT2",
  "LOT4",
  "LOT5",
  "VILLAGEHALLPARKINGSTRUCTURE",
  "LOT15",
  "OS115798",
  "OS115799",
  "OS115797",
  "OS118723"
],
```

Do **not** add it to `resident-overnight` or `commuter`.

### Check the wording on the same day (ask the Village if unsure)

- The Employees text already says "WBD permits are valid anywhere in Lot 15…". That sentence was
  left in place while the lot was hidden, and it becomes correct again once Lot 15 is showing.
- On Resident Overnight Only the text says "West End permits are valid in Lot 13 only." (it used
  to say "Lots 13 and 15"). **Do not change it** unless the Village says overnight West End permits
  are valid in Lot 15 again. The instruction was to restore Lot 15 on Resident Day/Night and
  Employees only.
- Resident Day/Night used to have a `lotSubzoneNotes.LOT15` entry ("park only in the highlighted
  areas…"). It was taken out during the September client-feedback round. **Lot 15 has no
  overnight bands drawn in GIS** (see `CLAUDE.md`, "Designated overnight subzones"), and that
  sentence on a lot with no bands reads as "you cannot park here". Leave it out unless the
  bands are drawn and the Village asks for it.

---

## Ship it (same steps for both updates)

Run from `C:\CodeApps\LagrangeParking`, in PowerShell:

```powershell
git fetch origin; git pull --ff-only origin main   # latest code

# … make the edit above …

git --no-pager diff -- public/profiles/lagrange-permit.json   # review: only the intended lines
npm run build                                                  # both apps must build
node scripts/verify-permit-pages.mjs                           # every listed lot must resolve
node scripts/verify-basemaps.mjs                               # basemap tiles load (build has no API key)
npm run dev                                                    # look at it locally, then Ctrl+C
```

`verify-permit-pages.mjs` currently warns about three lots with no rules: Commuter Lot 13,
Employees Lot 2 and Employees VH Garage. Those gaps are in the source data (known and
documented), so they don't block a release. Anything **new** should be looked at. For 10/20,
confirm the output lists Lot 15 under **both** "Resident Day/Night (24 hr.)" and "Employees",
and that it resolves.

Commit and push only the profile:

```powershell
git add -- public/profiles/lagrange-permit.json
git commit -m "Oct 1: point purchase buttons to the new online store"   # or "Oct 20: show Lot 15 on Resident 24 hr. and Employees"
git push origin HEAD:main
```

Deploy the **permit** app only (see `DEPLOY.md`). Account: `jeubanks@Community-Essentials.com`,
subscription **Microsoft Azure Sponsorship** `b8f90e47-b8ee-45f1-9442-d3b4f8fd0695`, resource group
`rg-lagrange-parking`:

```powershell
az account set --subscription b8f90e47-b8ee-45f1-9442-d3b4f8fd0695
npm run build:permit
$env:SWA_TOKEN = az staticwebapp secrets list -n lagrange-parking-permit -g rg-lagrange-parking --query "properties.apiKey" -o tsv
npx -y @azure/static-web-apps-cli deploy ./dist/permit --deployment-token $env:SWA_TOKEN --env production
Remove-Item Env:SWA_TOKEN
```

Never print, paste or commit the deployment token.

### Confirm it's live

Fetch the deployed profile and check it (append a random query string to get around caching):

```powershell
$j = Invoke-RestMethod "https://mango-cliff-087d26410.7.azurestaticapps.net/profiles/lagrange-permit.json?nocache=$(Get-Random)"
$j.apply.url                                                            # Oct 1: the new store
($j.tabs | ? id -eq 'resident-24hr').guide.apply.url                    # Oct 1: the new store
($j.tabs | ? id -eq 'resident-24hr').areaIds -join ', '                 # Oct 20: includes LOT15
($j.tabs | ? id -eq 'employees').areaIds -join ', '                     # Oct 20: includes LOT15
```

Then open https://mango-cliff-087d26410.7.azurestaticapps.net. For 10/1, click a purchase button
on each of the four pages. For 10/20, click Lot 15 on Resident Day/Night and on Employees, and
check it does **not** appear on Resident Overnight Only or Commuter.

Finally, mark the update ✅ in the table at the top of this file, with the date and commit hash.
