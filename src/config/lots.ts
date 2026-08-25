import type { CSSProperties } from 'react';
import type { ParkingProfile, SymbologyEntry, TabDef } from './types';

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

/**
 * Resolve a feature's symbology class when entries carry `match` criteria
 * (first matching entry wins, mirroring the renderer's Arcade expression).
 * Returns undefined when no entry has match rules, so callers can fall back to
 * plain rendererField-value equality.
 */
export function classifySymbology(
  attrs: Record<string, unknown> | undefined,
  symbology: SymbologyEntry[]
): SymbologyEntry | undefined {
  if (!symbology.some((s) => s.match)) return undefined;
  if (attrs) {
    for (const s of symbology) {
      if (!s.match) continue;
      const ok = Object.entries(s.match).every(([field, values]) =>
        values.includes(String(attrs[field] ?? ''))
      );
      if (ok) return s;
    }
  }
  return symbology.find((s) => s.value === '_default');
}

/**
 * Whether a feature belongs to the legend entry `legendFilter`. Uses
 * match-based classification when the profile defines it, otherwise plain
 * rendererField-value equality (with `_default` catching unknown values).
 */
export function matchesLegendFilter(
  attrs: Record<string, unknown>,
  symbology: SymbologyEntry[] | undefined,
  rendererField: string,
  legendFilter: string
): boolean {
  const matched = classifySymbology(attrs, symbology ?? []);
  if (matched) return matched.value === legendFilter;
  const knownValues = symbology
    ? symbology.filter((s) => s.value !== '_default').map((s) => s.value)
    : [];
  const val = String(attrs[rendererField] ?? '');
  if (legendFilter === '_default') return !knownValues.includes(val);
  return val === legendFilter;
}

/** CSS for a legend swatch, rendering hatched entries the same way the map does. */
export function swatchStyle(s: SymbologyEntry): CSSProperties {
  const rgba = `rgba(${s.color[0]}, ${s.color[1]}, ${s.color[2]}, ${s.color[3]})`;
  if (s.style && s.style !== 'solid') {
    const angle = s.style === 'backward-diagonal' ? '-45deg' : '45deg';
    return {
      background: `repeating-linear-gradient(${angle}, ${rgba} 0 2px, rgba(255, 255, 255, 0.85) 2px 5px)`,
    };
  }
  return { backgroundColor: rgba };
}

const matchClause = (m: Record<string, string[]>) =>
  Object.entries(m)
    .map(([field, values]) => `${field} IN (${values.map(quote).join(', ')})`)
    .join(' AND ');

/**
 * SQL filter selecting exactly the features a legend entry paints. Mirrors the
 * renderer's first-match-wins ordering, so an entry excludes anything an
 * earlier entry already claimed (e.g. "open every day" lots must exclude the
 * evenings-only lots, which are also FACILITYTYPE = 'Lot').
 */
export function symbologyFilterWhere(
  symbology: SymbologyEntry[],
  value: string,
  rendererField: string
): string | null {
  const idx = symbology.findIndex((s) => s.value === value);
  if (idx < 0) return null;
  const entry = symbology[idx];
  const own = entry.match ? matchClause(entry.match) : `${rendererField} = ${quote(entry.value)}`;
  const earlier = symbology
    .slice(0, idx)
    .filter((s) => s.match)
    .map((s) => `NOT (${matchClause(s.match!)})`);
  return [`(${own})`, ...earlier].join(' AND ');
}
