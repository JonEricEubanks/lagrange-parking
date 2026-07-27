import type { ParkingProfile, TabDef } from './types';

const quote = (v: string) => `'${String(v).replace(/'/g, "''")}'`;

/** The area-id field this profile joins on. */
export const idFieldOf = (profile: ParkingProfile) => profile.layer.idField ?? 'AREAID';

/**
 * Membership clause for a tab, preferring the Village's explicit lot list over
 * anything derived from the data. Returns null when the tab has no explicit
 * list, so callers can fall back to the rules-derived lookup.
 */
export function explicitAreaWhere(profile: ParkingProfile, tab?: TabDef | null): string | null {
  if (!tab?.areaIds?.length) return null;
  return `${idFieldOf(profile)} IN (${tab.areaIds.map(quote).join(', ')})`;
}

/** Display name for an area, honouring the profile's nameOverrides. */
export function areaDisplayName(
  attrs: Record<string, unknown> | undefined,
  nameField: string,
  idField?: string,
  nameOverrides?: Record<string, string>
): string {
  if (!attrs) return 'Parking area';
  const override = idField ? nameOverrides?.[String(attrs[idField] ?? '')] : undefined;
  return override ?? String(attrs[nameField] ?? 'Parking area');
}
