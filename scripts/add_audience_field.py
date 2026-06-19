"""
Fix audience accuracy on the hosted LaGrange_Parking_Permits feature service.

The source rule classifier is noisy (e.g. residential Permit Zones A-D were tagged
COMMUTER and flagged HASCOMMUTER instead of HASRESIDENT). This script makes the data
consistent and reversible:

  1. Adds an AUDIENCE field to ParkingRule [3] (if missing) and populates it with a
     PERMITZONE-first rule (the zone code is reliable; RULETYPE is a noisy fallback).
  2. Recomputes each ParkingArea [2] audience flag (HASRESIDENT / HASCOMMUTER / HASCBD /
     HASVISITOR) from the AUDIENCE of the rules that belong to it — so each lot/zone shows
     up under the correct permit tab. (LT students roll up into HASCOMMUTER.)

Additive + idempotent; re-runnable. Does NOT change USERCLASS or geometry.

Run in an env with the `arcgis` package (e.g. arcgispro-py3):
    python scripts/add_audience_field.py            # DRY RUN (default) — reports only
    python scripts/add_audience_field.py --commit   # apply

Auth (same La Grange AGOL named user used for prior deploys):
    set USERNAME / PASSWORD below, or env LAGRANGE_AGOL_USER / LAGRANGE_AGOL_PASS,
    or point env CREDENTIALS_ENV at a credentials.env with USERNAME=/PASSWORD= lines.
"""
import os
import sys
import argparse

PORTAL_URL = "https://lagrangeil.maps.arcgis.com"
BASE = (
    "https://services2.arcgis.com/FwavjPsU0K1YB1vX/arcgis/rest/services/"
    "LaGrange_Parking_Permits/FeatureServer"
)
AREA_URL = f"{BASE}/2"
RULE_URL = f"{BASE}/3"
FIELD = "AUDIENCE"

USERNAME = os.environ.get("LAGRANGE_AGOL_USER", "")
PASSWORD = os.environ.get("LAGRANGE_AGOL_PASS", "")
CREDENTIALS_ENV = os.environ.get("CREDENTIALS_ENV", "")

RESIDENT_ZONES = {"A", "B", "C", "D", "2A", "5A", "9A"}
COMMUTER_ZONES = {"E", "G"}
STUDENT_ZONES = {"H"}
EMPLOYEE_ZONES = {"CBD", "WBD"}


def audience(ruletype, permitzone, userclass):
    """PERMITZONE-first; RULETYPE only as a fallback when there is no zone code."""
    rt = (ruletype or "").upper()
    pz = (permitzone or "").upper()
    uc = (userclass or "").upper()
    if uc == "VISITOR":
        return "VISITOR"
    if pz in RESIDENT_ZONES:
        return "RESIDENT"
    if pz in COMMUTER_ZONES:
        return "COMMUTER"
    if pz in STUDENT_ZONES:
        return "STUDENT"
    if pz in EMPLOYEE_ZONES:
        return "EMPLOYEE"
    if rt in ("OVERNIGHT_RESIDENT", "DAYTIME_RESIDENT"):
        return "RESIDENT"
    if rt == "COMMUTER_DECAL":
        return "COMMUTER"
    if rt in ("CBD_DECAL", "BUSINESS_DECAL"):
        return "EMPLOYEE"
    if rt == "NO_PARKING":
        return "RESTRICTED"
    return "OTHER"


def load_credentials_env(path):
    user = pwd = None
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line.startswith("USERNAME="):
                user = line.split("=", 1)[1].strip()
            elif line.startswith("PASSWORD="):
                pwd = line.split("=", 1)[1].strip()
    return user, pwd


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--commit", action="store_true", help="apply changes (default: dry run)")
    args = ap.parse_args()
    dry = not args.commit
    print("MODE:", "DRY RUN" if dry else "COMMIT")

    from arcgis.gis import GIS
    from arcgis.features import FeatureLayer

    user, pwd = USERNAME, PASSWORD
    if (not user or not pwd) and CREDENTIALS_ENV and os.path.exists(CREDENTIALS_ENV):
        user, pwd = load_credentials_env(CREDENTIALS_ENV)
    if not user or not pwd:
        sys.exit("No credentials. Set USERNAME/PASSWORD, env vars, or CREDENTIALS_ENV.")

    gis = GIS(PORTAL_URL, user, pwd)
    print("Signed in as", gis.users.me.username)
    rules_tbl = FeatureLayer(RULE_URL, gis)
    areas_lyr = FeatureLayer(AREA_URL, gis)

    # --- 1. AUDIENCE field on ParkingRule ---
    have = {f["name"].upper() for f in rules_tbl.properties.fields}
    if FIELD.upper() not in have:
        print(f"Adding field {FIELD} to ParkingRule ...")
        if not dry:
            rules_tbl.manager.add_to_definition(
                {"fields": [{"name": FIELD, "type": "esriFieldTypeString",
                             "alias": "Audience", "length": 16, "nullable": True,
                             "editable": True}]}
            )
            print("  added.")
        else:
            print("  [dry run] would add field.")
    else:
        print(f"Field {FIELD} already exists.")

    rules = rules_tbl.query(
        where="1=1", out_fields="OBJECTID,AREAID,RULETYPE,PERMITZONE,USERCLASS",
        return_geometry=False,
    ).features

    rule_updates = []
    by_area = {}
    tally = {}
    for r in rules:
        a = audience(r.attributes.get("RULETYPE"), r.attributes.get("PERMITZONE"),
                     r.attributes.get("USERCLASS"))
        tally[a] = tally.get(a, 0) + 1
        rule_updates.append({"attributes": {"OBJECTID": r.attributes["OBJECTID"], FIELD: a}})
        by_area.setdefault(r.attributes.get("AREAID"), set()).add(a)
    print("Rule AUDIENCE tally:", dict(sorted(tally.items())))

    # --- 2. Recompute area flags from rules ---
    areas = areas_lyr.query(
        where="1=1",
        out_fields="OBJECTID,AREAID,AREANAME,USERCLASS,HASRESIDENT,HASCOMMUTER,HASCBD,HASVISITOR",
        return_geometry=False,
    ).features

    area_updates = []
    changes = []
    for a in areas:
        at = a.attributes
        auds = by_area.get(at.get("AREAID"), set())
        new = {
            "HASRESIDENT": 1 if "RESIDENT" in auds else 0,
            "HASCOMMUTER": 1 if (auds & {"COMMUTER", "STUDENT"}) else 0,
            "HASCBD": 1 if "EMPLOYEE" in auds else 0,
            "HASVISITOR": 1 if "VISITOR" in auds else 0,
        }
        diff = {k: v for k, v in new.items() if (at.get(k) or 0) != v}
        if diff:
            changes.append((at.get("AREANAME"), at.get("USERCLASS"), diff))
            area_updates.append({"attributes": {"OBJECTID": at["OBJECTID"], **new}})

    print(f"\nArea flag changes ({len(area_updates)}):")
    for name, uc, diff in changes:
        print(f"  {str(name)[:34]:34} [{uc}]  {diff}")

    if dry:
        print(f"\n[dry run] would update {len(rule_updates)} rules + {len(area_updates)} areas. "
              "Re-run with --commit.")
        return

    def apply(layer, updates, label):
        ok = 0
        for i in range(0, len(updates), 500):
            res = layer.edit_features(updates=updates[i:i + 500])
            ok += sum(1 for x in res.get("updateResults", []) if x.get("success"))
        print(f"  {label}: updated {ok}/{len(updates)}")

    print("\nApplying ...")
    apply(rules_tbl, rule_updates, "rules")
    apply(areas_lyr, area_updates, "areas")
    print("Done.")


if __name__ == "__main__":
    main()
