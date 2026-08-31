"""
Add + populate AREAID on OvernightResidentSubzones so the web app can join each
subzone to its parent lot.

JK digitized the subzones with a `Zone` field holding the bare lot number
("2", "5", "12"). The app keys everything off `ParkingArea.AREAID` ("LOT2",
"LOT5", "VILLAGEHALLPARKINGSTRUCTURE"), so a real AREAID column has to exist
before this layer is published — string-munging "LOT" + Zone in the browser
would break the moment a non-numbered area is drawn (the Village Hall Garage
is the next one due, and it is not "LOT<n>").

Dry-run by default. Nothing is written without --commit.

    python scripts/add_subzone_areaid.py            # report only
    python scripts/add_subzone_areaid.py --commit   # write

Needs arcpy: C:\\Users\\jkenny\\AppData\\Local\\ESRI\\conda\\envs\\mgp-agol-mcp
"""

import argparse
import os
import sys

import arcpy

GDB = r"X:\GISC\Community\LaGrange\Project\20240829_ParkingDecalMaps\APRX\Parking_Permit_Restructure\ParkingPermits.gdb"
SUBZONES = os.path.join(GDB, "OvernightResidentSubzones")
PARKING_AREA = os.path.join(GDB, "ParkingArea")

# Zone values that do not follow the "LOT<n>" convention go here. The Village
# Hall Garage is the one to expect (Heuer sheet 5 of 5, not yet received).
ZONE_OVERRIDES = {
    "VH": "VILLAGEHALLPARKINGSTRUCTURE",
    "VHGARAGE": "VILLAGEHALLPARKINGSTRUCTURE",
    "GARAGE": "VILLAGEHALLPARKINGSTRUCTURE",
}


def areaid_for(zone):
    """Map a `Zone` value onto a ParkingArea.AREAID."""
    z = (zone or "").strip().upper()
    if not z:
        return None
    if z in ZONE_OVERRIDES:
        return ZONE_OVERRIDES[z]
    if z.startswith("LOT"):  # already an AREAID
        return z
    if z.isdigit():
        return f"LOT{int(z)}"
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--commit", action="store_true", help="write changes (default: dry run)")
    args = ap.parse_args()

    for fc in (SUBZONES, PARKING_AREA):
        if not arcpy.Exists(fc):
            sys.exit(f"missing: {fc}")

    valid = {r[0] for r in arcpy.da.SearchCursor(PARKING_AREA, ["AREAID"])}

    existing = {f.name.upper() for f in arcpy.ListFields(SUBZONES)}
    needs_field = "AREAID" not in existing

    rows, unresolved = [], []
    with arcpy.da.SearchCursor(SUBZONES, ["OBJECTID", "Zone"]) as cur:
        for oid, zone in cur:
            aid = areaid_for(zone)
            ok = aid in valid
            rows.append((oid, zone, aid, ok))
            if not ok:
                unresolved.append((oid, zone, aid))

    print(f"{'OID':>5}  {'Zone':<8} -> {'AREAID':<30} resolves?")
    print("-" * 60)
    for oid, zone, aid, ok in rows:
        print(f"{oid:>5}  {str(zone):<8} -> {str(aid):<30} {'yes' if ok else 'NO'}")

    print(f"\n{len(rows)} subzone(s); AREAID field {'will be added' if needs_field else 'already exists'}")

    if unresolved:
        print(f"\n!! {len(unresolved)} row(s) do not map to a real ParkingArea.AREAID:")
        for oid, zone, aid in unresolved:
            print(f"   OID {oid}: Zone={zone!r} -> {aid!r}")
        print("   Fix the Zone value or add an entry to ZONE_OVERRIDES. Nothing written.")
        sys.exit(1)

    if not args.commit:
        print("\nDRY RUN — re-run with --commit to write.")
        return

    if needs_field:
        arcpy.management.AddField(SUBZONES, "AREAID", "TEXT", field_length=50,
                                  field_alias="Parking Area ID")
        print("added field AREAID")

    n = 0
    with arcpy.da.UpdateCursor(SUBZONES, ["OBJECTID", "Zone", "AREAID"]) as cur:
        for oid, zone, _ in cur:
            cur.updateRow((oid, zone, areaid_for(zone)))
            n += 1
    print(f"populated AREAID on {n} row(s)")


if __name__ == "__main__":
    main()
