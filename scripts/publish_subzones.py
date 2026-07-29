"""
Publish OvernightResidentSubzones from the project FGDB to the La Grange AGOL org
as its own standalone hosted feature layer.

Deliberately NOT a new sublayer of LaGrange_Parking_Permits: overwriting that
service resets its public sharing and takes both live apps down with
"Token Required", and the app profiles hardcode its sublayer ids /2 and /3.
Publishing separately keeps this purely additive.

The layer MUST end up shared with EVERYONE — the web apps query it anonymously.

Run with the arcpy conda env:
    C:\\Users\\jkenny\\AppData\\Local\\ESRI\\conda\\envs\\mgp-agol-mcp\\python.exe scripts/publish_subzones.py

Dry-run by default; --commit actually publishes.
"""

import argparse
import json
import os
import sys

import arcpy

GDB = r"X:\GISC\Community\LaGrange\Project\20240829_ParkingDecalMaps\APRX\Parking_Permit_Restructure\ParkingPermits.gdb"
FC = os.path.join(GDB, "OvernightResidentSubzones")

PROFILE_DIR = r"C:\dev\agent1\actions\agol\profiles\lagrange"
BLANK = r"C:\Program Files\ArcGIS\Pro\Resources\ArcToolBox\Services\routingservices\data\Blank.aprx"
WORK = r"C:\dev\agent1\working\publish"
APRX_PATH = os.path.join(WORK, "lagrange_subzones_publish.aprx")

SERVICE_NAME = "LaGrange_Overnight_Resident_Subzones"
PORTAL_FOLDER = "La Grange Parking"
SDDRAFT = os.path.join(WORK, SERVICE_NAME + ".sddraft")
SD = os.path.join(WORK, SERVICE_NAME + ".sd")

arcpy.env.overwriteOutput = True


def load_env(path):
    out = {}
    with open(path) as fh:
        for line in fh:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip()
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--commit", action="store_true", help="publish (default: dry run)")
    args = ap.parse_args()

    if not arcpy.Exists(FC):
        sys.exit(f"missing: {FC}")

    fields = {f.name.upper() for f in arcpy.ListFields(FC)}
    if "AREAID" not in fields:
        sys.exit("AREAID missing — run scripts/add_subzone_areaid.py --commit first")

    n = int(arcpy.management.GetCount(FC)[0])
    by_area = {}
    with arcpy.da.SearchCursor(FC, ["AREAID"]) as cur:
        for (aid,) in cur:
            by_area[aid] = by_area.get(aid, 0) + 1
    print(f"source   : {FC}")
    print(f"features : {n}  -> " + ", ".join(f"{k}={v}" for k, v in sorted(by_area.items())))
    print(f"service  : {SERVICE_NAME}  (folder '{PORTAL_FOLDER}')")

    if not args.commit:
        print("\nDRY RUN — re-run with --commit to publish.")
        return

    profile = json.load(open(os.path.join(PROFILE_DIR, "profile.json")))
    creds = load_env(os.path.join(PROFILE_DIR, "credentials.env"))
    org_url = profile["agol_org_url"]
    user, pw = creds["ARCGIS_USERNAME"], creds["ARCGIS_PASSWORD"]

    os.makedirs(WORK, exist_ok=True)
    for p in (SDDRAFT, SD):
        if os.path.exists(p):
            os.remove(p)

    print(f"\nSigning in to {org_url} as {user} ...")
    arcpy.SignInToPortal(org_url, user, pw)

    if os.path.exists(APRX_PATH):
        os.remove(APRX_PATH)
    aprx = arcpy.mp.ArcGISProject(BLANK)
    aprx.saveACopy(APRX_PATH)
    del aprx
    aprx = arcpy.mp.ArcGISProject(APRX_PATH)
    m = aprx.createMap("SubzonePublish", "Map")
    m.addDataFromPath(FC)
    for mm in list(aprx.listMaps()):
        if mm.name != "SubzonePublish":
            try:
                aprx.deleteItem(mm)
            except Exception:
                pass
    aprx.save()

    print(f"Creating sharing draft '{SERVICE_NAME}' ...")
    draft = m.getWebLayerSharingDraft("HOSTING_SERVER", "FEATURE", SERVICE_NAME, m.listLayers())
    draft.summary = ("Designated overnight resident parking areas inside Village of La Grange "
                     "permit lots.")
    draft.description = (
        "Polygons showing where an overnight resident permit holder MAY park inside each lot "
        "between 2 a.m. and 6 a.m. Only permitted areas are mapped - anywhere else within the lot "
        "is not permitted. Digitized from Village engineering drawings (Heuer and Associates, "
        "'Overnight Resident Parking', 12/30/2016). AREAID joins to ParkingArea in the "
        "LaGrange_Parking_Permits service. The Village Hall Garage and Lot 15 are not yet mapped."
    )
    draft.tags = "La Grange, parking, permit, overnight, resident, designated spaces"
    draft.credits = "Village of La Grange / Municipal GIS Partners (MGP)"
    draft.portalFolder = PORTAL_FOLDER
    draft.overwriteExistingService = True
    draft.allowExporting = True
    draft.exportToSDDraft(SDDRAFT)
    arcpy.server.StageService(SDDRAFT, SD)
    print("  uploading ...")
    arcpy.server.UploadServiceDefinition(SD, "HOSTING_SERVER")
    del aprx

    from arcgis.gis import GIS
    gis = GIS(org_url, username=user, password=pw)
    me = gis.users.me
    items = gis.content.search(f'title:"{SERVICE_NAME}" AND owner:{me.username}',
                               item_type="Feature Service", max_items=25)
    item = next((it for it in items if it.title == SERVICE_NAME), items[0] if items else None)
    if item is None:
        sys.exit("WARNING: published but could not locate the item to share it.")

    # Must be EVERYONE — the apps are anonymous. Publishing does not do this for us.
    try:
        from arcgis.gis import SharingLevel
        item.sharing.sharing_level = SharingLevel.EVERYONE
        shared_as = str(item.sharing.sharing_level)
    except Exception:
        item.share(everyone=True)
        shared_as = "everyone (legacy share API)"

    lyr = item.layers[0]
    print("\n===== PUBLISHED =====")
    print("item id  :", item.id)
    print("service  :", item.url)
    print("layer 0  :", lyr.url)
    print("count    :", lyr.query(return_count_only=True))
    print("sharing  :", shared_as, "(must be EVERYONE for the public apps)")
    print("fields   :", ", ".join(f["name"] for f in lyr.properties.fields))


if __name__ == "__main__":
    main()
