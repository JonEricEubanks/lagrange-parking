# GIS Publish Steps — Getting Polygon Updates Live

**Status (2026-08-21):** Jericho saved polygon edits in the ArcPro project file. Verified via the
AGOL REST API that the hosted services have NOT received them — last feature edits on AGOL:
`LaGrange_Parking_Permits` = 2026-07-27, `LaGrange_Overnight_Resident_Subzones` = 2026-07-29.
The edits are sitting in the FGDB on the MGP network waiting for the publish step below.

**Credentials: SOLVED.** We now have working AGOL admin credentials (`LaGrange_IL_ADMIN`,
org `https://lagrangeil.maps.arcgis.com` — "Village of La Grange IL"). Verified live via a
generateToken + portals/self call on 2026-08-21. They live in the gitignored `.env` at the repo
root (`ARCGIS_USERNAME` / `ARCGIS_PASSWORD` / `ARCGIS_ORG_URL`) — `publish_subzones.py` reads
them automatically. Never commit `.env`; never paste the password anywhere.

> Note: AGOL auth/publish works from ANY network — only the `X:\GISC\...` source GDB requires
> being on the MGP network (or VPN, or a local copy of the GDB with `LAGRANGE_GDB` set).
> Recommended: rotate the `LaGrange_IL_ADMIN` password since John (departed) knew it.

## Prerequisites

- Connected to MGP network (office or VPN) so `X:\GISC\...` is accessible
  — or a local copy of `ParkingPermits.gdb` with the `LAGRANGE_GDB` env var pointed at it
- ArcGIS Pro installed (script needs `arcpy`; use Pro's conda python — see Step 2a)
  - **OR** — see Step 3 alternative below
- Repo-root `.env` with the AGOL credentials (already set up)

---

## Steps

### 1. Confirm what Jericho edited
Ask Jericho which feature class was updated:
- **OvernightResidentSubzones** (the green highlighted overnight areas) → use `publish_subzones.py`
- **Main parking permits layer** (lot boundaries/attributes) → different workflow, see Step 2b

### 2a. Publish the Overnight Subzones layer (most likely)

The script is now portable — it no longer depends on John's machine. It reads credentials from
the repo-root `.env` (or env vars), and the GDB path / work dir are overridable via
`LAGRANGE_GDB` / `PUBLISH_WORK_DIR`.

Run from any machine with ArcGIS Pro installed and the GDB reachable. Use Pro's own conda
python by its FULL path (gotchas: the `python.exe` ArcGIS puts on PATH throws "Access is
denied"; `conda run` garbles output — always call the env's python.exe directly):

```powershell
# Find Pro's conda envs (default env is usually arcgispro-py3):
dir "C:\Program Files\ArcGIS\Pro\bin\Python\envs\"
dir "$env:LOCALAPPDATA\ESRI\conda\envs\"

# Dry run first — validates the GDB + AREAID field and prints per-AREAID counts, publishes nothing:
& "C:\Program Files\ArcGIS\Pro\bin\Python\envs\arcgispro-py3\python.exe" scripts/publish_subzones.py

# Then commit if it looks right:
& "C:\Program Files\ArcGIS\Pro\bin\Python\envs\arcgispro-py3\python.exe" scripts/publish_subzones.py --commit
```

If the FC is missing the `AREAID` field, run `scripts/add_subzone_areaid.py --commit` first.

The FGDB source: `X:\GISC\Community\LaGrange\Project\20240829_ParkingDecalMaps\APRX\Parking_Permit_Restructure\ParkingPermits.gdb`

**After it runs:** refresh the live site at https://mango-cliff-087d26410.7.azurestaticapps.net — the map will pick up the changes automatically. Also verify the subzones service is still shared to Everyone (the script forces this, but confirm) and that `LaGrange_Parking_Permits` was NOT touched.

### 2b. If the main parking layer was edited

This is more complex — edits flow through the enterprise SDE (`GISC_PRODUCTION`, version `DBO.VLG`) and require reconcile/post before the Feature Service reflects them. Talk to Jericho about the full SDE publish workflow (John is gone).

**NEVER overwrite/republish the `LaGrange_Parking_Permits` hosted service** — the apps hardcode sublayers `/2` and `/3`, and a republish resets public sharing (past outage: "Token Required"). It must stay shared to Everyone.

### 3. Alternative (no ArcPro required) — rewrite publish_subzones.py

`publish_subzones.py` currently requires ArcPro (`arcpy`). It could be rewritten to use the `arcgis` pip package instead (zip the FGDB → upload → publish/overwrite), which runs on any machine with plain Python. The FGDB would still need to be reachable (network or local copy).

If we own this going forward, this rewrite should be done so the script can run from any dev machine.

---

## Checklist for the next on-network session

1. [ ] Confirm with Jericho WHICH feature class he edited (subzones → 2a; main permits layer → 2b)
2. [ ] On a machine with ArcGIS Pro: verify X: is mounted and the GDB opens
3. [ ] Copy/pull this repo (needs `scripts/` + the `.env` — recreate `.env` there, don't email it)
4. [ ] Dry run `publish_subzones.py` (no creds needed) and sanity-check the AREAID counts
5. [ ] `--commit`, then verify: green overnight highlights on the live permit app, subzones
       service shared Everyone, `LaGrange_Parking_Permits` untouched (/2 and /3 still load)
6. [ ] Afterwards: rotate the `LaGrange_IL_ADMIN` password and update `.env`

---

## After Publishing

No code changes or redeployment needed — the app queries the Feature Service live.
Confirm by opening the permit map and checking:
- https://mango-cliff-087d26410.7.azurestaticapps.net (permit app — overnight tab)
- The green subzone highlights should appear on the updated lots
