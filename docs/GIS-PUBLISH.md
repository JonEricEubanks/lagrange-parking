# GIS Publish Steps — Getting Polygon Updates Live

**Status:** Jericho saved polygon edits in the ArcPro project file (2026-08-21).
The edits are in the local FGDB on the MGP network. The publish script still needs to run.

## Prerequisites

- Connected to MGP network (office or VPN) so `X:\GISC\...` is accessible
- ArcGIS Pro installed with the `mgp-agol-mcp` conda env (currently only on John's machine)
  - **OR** — see Step 3 alternative below

---

## Steps

### 1. Confirm what Jericho edited
Ask Jericho which feature class was updated:
- **OvernightResidentSubzones** (the green highlighted overnight areas) → use `publish_subzones.py`
- **Main parking permits layer** (lot boundaries/attributes) → different workflow, see Step 2b

### 2a. Publish the Overnight Subzones layer (most likely)

Run from a machine with ArcGIS Pro + the mgp-agol-mcp conda env and network access:

```bash
# Dry run first — just prints what it would do:
C:\Users\jkenny\AppData\Local\ESRI\conda\envs\mgp-agol-mcp\python.exe scripts/publish_subzones.py

# Then commit if it looks right:
C:\Users\jkenny\AppData\Local\ESRI\conda\envs\mgp-agol-mcp\python.exe scripts/publish_subzones.py --commit
```

The FGDB source: `X:\GISC\Community\LaGrange\Project\20240829_ParkingDecalMaps\APRX\Parking_Permit_Restructure\ParkingPermits.gdb`

**After it runs:** refresh the live site at https://mango-cliff-087d26410.7.azurestaticapps.net — the map will pick up the changes automatically.

### 2b. If the main parking layer was edited

This is more complex — edits flow through the enterprise SDE (`GISC_PRODUCTION`, version `DBO.VLG`) and require reconcile/post before the Feature Service reflects them. Talk to John or Jericho about the full SDE publish workflow.

### 3. Alternative (no ArcPro required) — rewrite publish_subzones.py

`publish_subzones.py` currently requires ArcPro (`arcpy`). It could be rewritten to use the `arcgis` pip package instead, which runs on any machine with Python. The FGDB would still need to be accessible via network.

If we own this going forward, this rewrite should be done so the script can run from any dev machine.

---

## After Publishing

No code changes or redeployment needed — the app queries the Feature Service live.
Confirm by opening the permit map and checking:
- https://mango-cliff-087d26410.7.azurestaticapps.net (permit app — overnight tab)
- The green subzone highlights should appear on the updated lots
