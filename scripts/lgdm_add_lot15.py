"""Add Lot 15 to LGDM DBO.Parking_Restriction_POLY, in the DBO.VLG version.

Lot 15 currently exists only in ParkingPermits.gdb, so `lagrange_build_fgdb.py`
would delete it on the next rebuild. This puts it in the system of record.

Three features are inserted with identical geometry and PARKINGAREANAME 'Lot 15'.
The build script dissolves same-named off-street features into one ParkingArea
and takes one ParkingRule from each -- which is how Lot 5 already gets its five
rules. One feature per permit type valid in the lot.

Edits land in DBO.VLG and are left UNPOSTED for review/reconcile/post.

    python scripts/lgdm_add_lot15.py            # dry run
    python scripts/lgdm_add_lot15.py --commit   # writes to DBO.VLG

Needs arcpy:
    C:\\Users\\jkenny\\AppData\\Local\\ESRI\\conda\\envs\\mgp-agol-mcp\\python.exe
"""

import os
import re
import sys
import tempfile

import arcpy

COMMIT = "--commit" in sys.argv

INSTANCE = "mgp-sql02"
DATABASE = "GISC_PRODUCTION"
VERSION = "DBO.VLG"
FC_NAME = "GISC_PRODUCTION.DBO.Parking_Restriction_POLY"
GEODBID = "024"

SRC_GDB = r"X:\GISC\Community\LaGrange\Project\20240829_ParkingDecalMaps\APRX\Parking_Permit_Restructure\ParkingPermits.gdb"
SRC_FC = SRC_GDB + r"\ParkingArea"

COMMON = {
    "GEODBID": GEODBID,
    "PARKINGAREATYPE": "LOT",
    "PARKINGAREANAME": "Lot 15",
    "OWNERSHIP": "Village of La Grange",
    "MAINTAINED": "Village of La Grange",
    "ISPERMITPARKING": 1,
    "ISCOMMUTERPARKING": 0,
    "CLASSIFICATION": "PARKING",
    "REPLICAFILTER": "VLG",
    # SOURCE caps at 20 chars and PRODUCTIONNOTES at 100 -- keep these short.
    "SOURCE": "Village Exhibit",
    "SOURCETYPE": "ORTHOIMAGERY",
    "LOCATIONDESCRIPTION": (
        "South side of W Burlington Ave between S Brainard Ave and S Stone Ave. "
        "West End (WBD) employee and resident permit parking."
    ),
    "PRODUCTIONNOTES": (
        "Digitized from Village exhibit 'New Village Lot 15' 7/22/2026. Space counts pending."
    ),
    # MAXPARKINGSPACES / ISHANDICAP / NUMBEROFHANDICAPSPOTS deliberately left null --
    # the Village has not supplied counts. NOTE: the FGDB build collapses a null
    # MAXPARKINGSPACES to 0, which the app renders as "Spaces 0". Fill these before rebuilding.
}

# One row per permit type. The PERMITNAME wording is load-bearing: the FGDB build
# keyword-matches "{PARKINGAREANAME} {PERMITNAME} {ENFORCEMENTTIMES}" in a fixed
# order, so row 2 must say "Daytime" and must not say "Overnight".
ROWS = [
    {**COMMON,
     "PERMITNAME": "West End Overnight Resident Permit",
     "DAYSOFENFORCEMENT": "ALL",
     "ENFORCEMENTTIMES": "2:00am - 6:00am"},
    {**COMMON,
     "PERMITNAME": "West End Daytime Resident Permit (24 Hr)",
     "DAYSOFENFORCEMENT": "ALL",
     "ENFORCEMENTTIMES": "All day and all night"},
    {**COMMON,
     "PERMITNAME": "WBD Employees",
     "DAYSOFENFORCEMENT": "WEEKDAY",
     "ENFORCEMENTTIMES": "6:00AM-6:00PM"},
]

EXPECTED_RULETYPES = ["OVERNIGHT_RESIDENT", "DAYTIME_RESIDENT", "BUSINESS_DECAL"]


def predicted_ruletype(row):
    """Mirror of rule_type_for_set() in lagrange_build_fgdb.py, so we can prove
    the wording produces the rules the published apps already show."""
    name = row["PARKINGAREANAME"]
    pname = row["PERMITNAME"]
    blob = f"{name} {pname} {row['ENFORCEMENTTIMES']}".lower()
    if "overnight" in blob or re.search(r"2:?0?0?\s*am.*6:?0?0?\s*am", blob):
        return "OVERNIGHT_RESIDENT"
    if "commuter" in blob or row["ISCOMMUTERPARKING"] == 1:
        return "COMMUTER_DECAL"
    if "employee" in blob:
        return "BUSINESS_DECAL"
    if "cbd" in blob:
        return "CBD_DECAL"
    if "daytime" in blob:
        return "DAYTIME_RESIDENT"
    if "decal zone" in name.lower():
        return "DECAL_ZONE"
    if "resident" in blob:
        return "OVERNIGHT_RESIDENT"
    return "DECAL_ZONE"


def connect(version):
    folder = tempfile.gettempdir()
    name = f"lgdm_{re.sub(r'[^A-Za-z0-9]', '_', version)}.sde"
    path = os.path.join(folder, name)
    if os.path.exists(path):
        os.remove(path)
    arcpy.management.CreateDatabaseConnection(
        folder, name, "SQL_SERVER", INSTANCE, "OPERATING_SYSTEM_AUTH",
        database=DATABASE, version_type="TRANSACTIONAL", version=version,
    )
    return path


def main():
    # --- source geometry -----------------------------------------------------
    geom = None
    with arcpy.da.SearchCursor(SRC_FC, ["SHAPE@"], "AREAID = 'LOT15'") as cur:
        for (g,) in cur:
            geom = g
    if geom is None:
        sys.exit("No LOT15 polygon in the FGDB to copy geometry from.")
    print(f"source geometry : {geom.partCount} part(s), {geom.area:,.0f} sq ft, "
          f"SR {geom.spatialReference.factoryCode}")

    # --- wording check -------------------------------------------------------
    print("\nRULETYPE the FGDB build will derive from this wording:")
    ok = True
    for row, expected in zip(ROWS, EXPECTED_RULETYPES):
        got = predicted_ruletype(row)
        flag = "OK " if got == expected else "MISMATCH"
        if got != expected:
            ok = False
        print(f"  {flag}  {row['PERMITNAME']:42} -> {got}")
    if not ok:
        sys.exit("\nWording would not reproduce the published rules. Nothing written.")

    sde = connect(VERSION)
    fc = os.path.join(sde, FC_NAME)
    if not arcpy.Exists(fc):
        sys.exit(f"Cannot reach {FC_NAME} in {VERSION}")

    d = arcpy.Describe(fc)
    print(f"\nconnected       : {DATABASE} @ {INSTANCE}")
    print(f"version         : {d.changeTracked if False else VERSION}")
    print(f"versioned       : {d.isVersioned}")

    if geom.spatialReference.factoryCode != d.spatialReference.factoryCode:
        sys.exit("Spatial reference mismatch between FGDB and LGDM.")

    existing = [
        r for r in arcpy.da.SearchCursor(
            fc, ["OID@"], f"GEODBID='{GEODBID}' AND PARKINGAREANAME='Lot 15'")
    ]
    if existing:
        sys.exit(f"Lot 15 already present in {VERSION} (OIDs {[r[0] for r in existing]}). "
                 "Nothing written.")

    # --- domain check --------------------------------------------------------
    domains = {dm.name: dm for dm in arcpy.da.ListDomains(sde)}
    fdom = {f.name: f.domain for f in arcpy.ListFields(fc) if f.domain}
    problems = []
    for i, row in enumerate(ROWS):
        for k, v in row.items():
            dn = fdom.get(k)
            if dn and domains.get(dn) and domains[dn].domainType == "CodedValue":
                if v not in domains[dn].codedValues:
                    problems.append(f"row{i}.{k}={v!r} not in domain {dn}")
    # Text fields here are narrow (SOURCE is 20, PRODUCTIONNOTES 100). Catch an
    # overflow up front rather than halfway through an edit transaction.
    caps = {f.name: f.length for f in arcpy.ListFields(fc) if f.type == "String"}
    for i, row in enumerate(ROWS):
        for k, v in row.items():
            cap = caps.get(k)
            if cap and isinstance(v, str) and len(v) > cap:
                problems.append(f"row{i}.{k} is {len(v)} chars, field holds {cap}")

    if problems:
        print("\nVALIDATION FAILED -- nothing written:")
        for p in problems:
            print("  " + p)
        sys.exit(1)
    print("domain + length : all values valid")

    fields = sorted(ROWS[0])
    print(f"\n{len(ROWS)} features to insert into {VERSION}:")
    for row, rt in zip(ROWS, EXPECTED_RULETYPES):
        print(f"  Lot 15 | {row['PERMITNAME']:42} | {row['DAYSOFENFORCEMENT']:8} | "
              f"{row['ENFORCEMENTTIMES']:24} -> {rt}")

    if not COMMIT:
        print("\nDRY RUN -- re-run with --commit to write to " + VERSION)
        return

    editor = arcpy.da.Editor(sde)
    editor.startEditing(False, True)   # with_undo=False, multiuser_mode=True (versioned)
    editor.startOperation()
    new_oids = []
    try:
        with arcpy.da.InsertCursor(fc, ["SHAPE@"] + fields) as cur:
            for row in ROWS:
                new_oids.append(cur.insertRow([geom] + [row[f] for f in fields]))
        # FEATUREID follows the GEODBID + OBJECTID convention used by every other row.
        # The where clause needs the real OID column name -- "OID@" is a cursor
        # token, not SQL.
        oid_field = d.OIDFieldName
        with arcpy.da.UpdateCursor(fc, ["OID@", "FEATUREID"],
                                   f"{oid_field} IN ({','.join(str(o) for o in new_oids)})") as cur:
            for r in cur:
                r[1] = f"{GEODBID}{r[0]}"
                cur.updateRow(r)
        editor.stopOperation()
        editor.stopEditing(True)
    except Exception:
        editor.abortOperation()
        editor.stopEditing(False)
        raise

    print(f"\nINSERTED into {VERSION}: OIDs {new_oids}")
    with arcpy.da.SearchCursor(
        fc, ["OID@", "FEATUREID", "PARKINGAREANAME", "PERMITNAME", "DAYSOFENFORCEMENT",
             "ENFORCEMENTTIMES", "CREATEDBY", "DATECREATED"],
        f"GEODBID='{GEODBID}' AND PARKINGAREANAME='Lot 15'",
    ) as cur:
        for r in cur:
            print("  " + " | ".join(str(v) for v in r))

    print(f"\nEdits are UNPOSTED in {VERSION}. Reconcile and post to dbo.DEFAULT when ready.")


if __name__ == "__main__":
    main()
