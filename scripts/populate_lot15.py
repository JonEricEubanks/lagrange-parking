"""Populate attributes + related rules for the new Lot 15 in ParkingPermits.gdb.

Lot 15 was digitized into ParkingArea by hand (it is not in LGDM
Parking_Restriction_POLY). This fills in the attributes the app needs and adds
the three ParkingRule rows implied by the Village's 2026-07-27 comments:
West End resident overnight, West End resident 24 hr, and WBD employee.

    python scripts/populate_lot15.py            # dry run, prints the plan
    python scripts/populate_lot15.py --commit   # writes

Needs the arcpy env:
    C:\\Users\\jkenny\\AppData\\Local\\ESRI\\conda\\envs\\mgp-agol-mcp\\python.exe
"""

import sys
import arcpy

GDB = r"X:\GISC\Community\LaGrange\Project\20240829_ParkingDecalMaps\APRX\Parking_Permit_Restructure\ParkingPermits.gdb"
AREA = GDB + r"\ParkingArea"
RULE = GDB + r"\ParkingRule"
AREA_ID = "LOT15"
COMMIT = "--commit" in sys.argv

# Attributes to set on the ParkingArea row. Capacity fields are deliberately
# absent — the Village has not supplied a space count and inventing one for a
# public parking map would be worse than showing nothing.
AREA_UPDATES = {
    "PARKINGCONTEXT": "OFF_STREET",
    "FACILITYTYPE": "Lot",            # null renders as grey "Other" in the app
    "HASVISITOR": 0,                  # permit lot — no visitor parking
    "HASPERMIT": 1,
    "HASRESIDENT": 1,                 # West End resident overnight + 24 hr
    "HASCOMMUTER": 0,
    "HASCBD": 1,                      # WBD employee permits are valid here
    "SRC_FRAGMENTS": 0,               # digitized, not merged from LGDM sources
    "LOCDESC": (
        "South side of W Burlington Ave between S Brainard Ave and S Stone Ave. "
        "West End (WBD) employee and resident permit parking."
    ),
    "PRODNOTES": (
        "Digitized 2026-07-27 from Village exhibit 'New Village Lot 15' (7/22/2026). "
        "NOT present in LGDM DBO.Parking_Restriction_POLY (GEODBID 024) — this feature "
        "and its rules are lost if ParkingArea is rebuilt from LGDM. Add to LGDM to make it durable."
    ),
}

# One row per permit type valid in this lot, matching each page's ruleWhere:
#   resident-overnight / resident-24hr -> RULETYPE IN (OVERNIGHT_RESIDENT, DAYTIME_RESIDENT, ...)
#   employees                          -> RULETYPE IN (CBD_DECAL, BUSINESS_DECAL) OR PERMITZONE IN (CBD, WBD)
# RATE_TEXT/RATE_MONTHLY stay null: the apps show no pricing, and no rate was supplied.
NEW_RULES = [
    {
        "AREAID": AREA_ID,
        "RULETYPE": "OVERNIGHT_RESIDENT",
        "USERCLASS": "PERMIT",
        "ISPERMIT": 1,
        "PERMITNAME": "West End Overnight Resident Permit",
        "PERMITZONE": "NONE",
        "ENFORCE_DAYS": "ALL",
        "ENFORCE_START": "02:00",
        "ENFORCE_END": "06:00",
        "ENFORCE_TEXT": "2:00am - 6:00am",
    },
    {
        "AREAID": AREA_ID,
        "RULETYPE": "DAYTIME_RESIDENT",
        "USERCLASS": "PERMIT",
        "ISPERMIT": 1,
        "PERMITNAME": "West End Resident 24 Hr Permit",
        "PERMITZONE": "NONE",
        "ENFORCE_DAYS": "ALL",
        "ENFORCE_TEXT": "All day and all night",
    },
    {
        "AREAID": AREA_ID,
        "RULETYPE": "BUSINESS_DECAL",
        "USERCLASS": "PERMIT",
        "ISPERMIT": 1,
        "PERMITNAME": "WBD Employees",
        "PERMITZONE": "WBD",
        "ENFORCE_DAYS": "WEEKDAY",
        "ENFORCE_START": "06:00",
        "ENFORCE_END": "18:00",
        "ENFORCE_TEXT": "6:00AM-6:00PM",
    },
]


def check_domains():
    """Fail loudly rather than writing a value the domain will reject."""
    domains = {d.name: d for d in arcpy.da.ListDomains(GDB)}

    def coded(field_domain):
        d = domains.get(field_domain)
        return set(d.codedValues) if d and d.domainType == "CodedValue" else None

    field_domain = {f.name: f.domain for f in arcpy.ListFields(AREA) if f.domain}
    field_domain.update({f.name: f.domain for f in arcpy.ListFields(RULE) if f.domain})

    problems = []
    for name, value in AREA_UPDATES.items():
        allowed = coded(field_domain.get(name, ""))
        if allowed and value not in allowed:
            problems.append(f"ParkingArea.{name}={value!r} not in {sorted(allowed)}")
    for i, row in enumerate(NEW_RULES):
        for name, value in row.items():
            allowed = coded(field_domain.get(name, ""))
            if allowed and value not in allowed:
                problems.append(f"ParkingRule[{i}].{name}={value!r} not in {sorted(allowed)}")
    return problems


def main():
    if not arcpy.Exists(AREA):
        sys.exit(f"ParkingArea not found: {AREA}")

    problems = check_domains()
    if problems:
        print("DOMAIN VIOLATIONS — nothing written:")
        for p in problems:
            print("  " + p)
        sys.exit(1)
    print("Domain check: all values valid\n")

    existing = [
        r[0] for r in arcpy.da.SearchCursor(RULE, ["OID@"], f"AREAID = '{AREA_ID}'")
    ]
    if existing:
        print(f"ParkingRule already has {len(existing)} row(s) for {AREA_ID} "
              f"(OIDs {existing}) — skipping inserts to avoid duplicates.")

    fields = list(AREA_UPDATES)
    print(f"ParkingArea [{AREA_ID}] field updates:")
    with arcpy.da.UpdateCursor(AREA, ["OID@"] + fields, f"AREAID = '{AREA_ID}'") as cur:
        found = False
        for row in cur:
            found = True
            for i, name in enumerate(fields, start=1):
                before, after = row[i], AREA_UPDATES[name]
                if before != after:
                    shown = str(after)
                    print(f"  {name:15} {str(before):22} -> "
                          f"{shown if len(shown) < 60 else shown[:57] + '...'}")
                row[i] = AREA_UPDATES[name]
            if COMMIT:
                cur.updateRow(row)
        if not found:
            sys.exit(f"No ParkingArea row with AREAID = {AREA_ID}")

    if not existing:
        print(f"\nParkingRule inserts ({len(NEW_RULES)}):")
        keys = sorted({k for r in NEW_RULES for k in r})
        for r in NEW_RULES:
            print(f"  {r['RULETYPE']:20} zone={r['PERMITZONE']:5} {r.get('ENFORCE_TEXT', '')}")
        if COMMIT:
            with arcpy.da.InsertCursor(RULE, keys) as cur:
                for r in NEW_RULES:
                    cur.insertRow(tuple(r.get(k) for k in keys))

    print("\n" + ("COMMITTED." if COMMIT else "DRY RUN — re-run with --commit to write."))


if __name__ == "__main__":
    main()
