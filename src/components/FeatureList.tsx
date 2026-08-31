import { useMemo, useState } from 'react';
import type Graphic from '@arcgis/core/Graphic.js';
import type { SymbologyEntry, LayerFields, AreaInfo, ParkingProfile } from '../config/types';
import { areaDisplayName, classifySymbology, matchesLegendFilter, swatchStyle } from '../config/lots';

type SortKey = 'name' | 'spaces' | 'restriction';

export function FeatureList({
  features,
  selectedIndex,
  onSelect,
  symbology,
  legendFilter,
  layerFields,
  areaInfo,
  consolidate,
  ruleSymbology,
  ruleFilter,
  onRuleFilterToggle,
}: {
  features: Graphic[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  symbology?: SymbologyEntry[];
  legendFilter?: string | null;
  layerFields: LayerFields;
  areaInfo?: Record<string, AreaInfo>;
  consolidate?: ParkingProfile['consolidateList'];
  ruleSymbology?: SymbologyEntry[];
  ruleFilter?: string | null;
  onRuleFilterToggle?: (value: string) => void;
}) {
  const { nameField, rendererField, spacesField, idField, nameOverrides } = layerFields;
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [onStreetOpen, setOnStreetOpen] = useState(false);

  const nameOf = (g: Graphic): string =>
    areaDisplayName(g.attributes, nameField, idField, nameOverrides);

  const symMap = useMemo(() => {
    const map = new Map<string, SymbologyEntry>();
    if (symbology) for (const s of symbology) map.set(s.value, s);
    return map;
  }, [symbology]);

  const defaultSym = symMap.get('_default');

  // Mirrors the map renderer: match-based classification when the profile uses
  // it, otherwise plain rendererField-value equality.
  const symOf = (attrs: Record<string, unknown>): SymbologyEntry | undefined =>
    classifySymbology(attrs, symbology ?? []) ??
    symMap.get(String(attrs[rendererField] ?? '')) ??
    defaultSym;

  const { filteredEntries, consolidatedCount, consolidatedBreakdown } = useMemo(() => {
    let entries = features.map((feature, originalIndex) => ({ feature, originalIndex }));

    if (legendFilter != null) {
      entries = entries.filter(({ feature }) =>
        matchesLegendFilter(feature.attributes, symbology, rendererField, legendFilter)
      );
    }

    let consolidatedCount = 0;
    const consolidatedBreakdown: { value: string; label: string; count: number }[] = [];
    if (consolidate) {
      const { field, values } = consolidate;
      const isConsolidated = ({ feature }: { feature: Graphic }) =>
        values.includes(String(feature.attributes[field] ?? ''));
      const consolidated = entries.filter(isConsolidated);
      consolidatedCount = consolidated.length;
      entries = entries.filter((e) => !isConsolidated(e));

      // Category counts by rule (e.g. "2 Hour", "Metered"), in ruleSymbology order.
      // A subdivided rule (e.g. METERED by AREANAME) splits into finer chips keyed
      // "sub:<byField value>" so metered hours get their own rows.
      const sub = consolidate.subdivide;
      const counts = new Map<string, number>();
      const subLabels = new Map<string, string>();
      for (const { feature } of consolidated) {
        const raw = String(feature.attributes[rendererField] ?? '');
        let key = raw;
        if (sub && raw === sub.value) {
          const subVal = String(feature.attributes[sub.byField] ?? '');
          key = `sub:${subVal}`;
          subLabels.set(key, subVal);
        }
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const parentOf = (k: string) => (k.startsWith('sub:') ? sub!.value : k);
      const order = (v: string) => {
        const i = ruleSymbology?.findIndex((s) => s.value === parentOf(v)) ?? -1;
        return i === -1 ? Number.MAX_SAFE_INTEGER : i;
      };
      const sorted = [...counts.keys()].sort(
        (a, b) => order(a) - order(b) || a.localeCompare(b, undefined, { numeric: true })
      );
      for (const value of sorted) {
        const label =
          subLabels.get(value) ??
          ruleSymbology?.find((s) => s.value === value)?.label ??
          (value || 'Other');
        consolidatedBreakdown.push({ value, label, count: counts.get(value)! });
      }

      // With a chip selected, list the matching on-street spaces themselves.
      if (ruleFilter != null) {
        entries = consolidated.filter(({ feature }) => {
          const raw = String(feature.attributes[rendererField] ?? '');
          const key =
            sub && raw === sub.value
              ? `sub:${String(feature.attributes[sub.byField] ?? '')}`
              : raw;
          return key === ruleFilter;
        });
      }
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      entries = entries.filter(({ feature }) => {
        if (nameOf(feature).toLowerCase().includes(q)) return true;
        const desc = consolidate?.descField
          ? String(feature.attributes[consolidate.descField] ?? '')
          : '';
        return desc.toLowerCase().includes(q);
      });
    }

    entries.sort((a, b) => {
      if (sortKey === 'name')
        return nameOf(a.feature).localeCompare(nameOf(b.feature), undefined, { numeric: true });
      if (sortKey === 'spaces' && spacesField) {
        const sa = a.feature.attributes[spacesField];
        const sb = b.feature.attributes[spacesField];
        if (sa == null && sb == null) return 0;
        if (sa == null) return 1;
        if (sb == null) return -1;
        return Number(sb) - Number(sa);
      }
      const ra = a.feature.attributes[rendererField] || '';
      const rb = b.feature.attributes[rendererField] || '';
      return (
        String(ra).localeCompare(String(rb)) ||
        nameOf(a.feature).localeCompare(nameOf(b.feature), undefined, { numeric: true })
      );
    });

    return { filteredEntries: entries, consolidatedCount, consolidatedBreakdown };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features, legendFilter, search, sortKey, symbology, rendererField, spacesField, nameField, consolidate, ruleSymbology, ruleFilter]);

  if (features.length === 0) return <div className="feature-list-empty">Loading...</div>;

  // Legend-filtering to on-street leaves only the consolidated group — the
  // breakdown chips ARE the results then, so open them instead of "No matches".
  const onlyConsolidated =
    filteredEntries.length === 0 && consolidatedCount > 0 && !search.trim() && ruleFilter == null;

  const activeChip =
    ruleFilter != null ? consolidatedBreakdown.find((b) => b.value === ruleFilter) : undefined;
  const heading = activeChip
    ? `${filteredEntries.length} ${activeChip.label} space${filteredEntries.length === 1 ? '' : 's'}`
    : consolidate && consolidatedCount > 0
      ? filteredEntries.length === 0
        ? consolidate.label
        : `${filteredEntries.length} lots & garages`
      : 'All Locations';

  return (
    <div className="feature-list">
      <h4 className="feature-list-heading">{heading}</h4>
      <div className="feature-list-controls">
        <input
          className="feature-list-search"
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="feature-list-sort"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
        >
          <option value="name">Name</option>
          {spacesField && <option value="spaces">Spaces</option>}
          <option value="restriction">Type</option>
        </select>
      </div>
      {consolidate && consolidatedCount > 0 && (() => {
        // Stays expanded while a spotlight filter is active.
        const expanded = onStreetOpen || ruleFilter != null || onlyConsolidated;
        return (
          <div className="feature-list-consolidated">
            <button
              type="button"
              className="feature-list-consolidated-header"
              onClick={() => setOnStreetOpen((o) => !o)}
              aria-expanded={expanded}
            >
              <span className="feature-list-consolidated-caret">{expanded ? '▾' : '▸'}</span>
              <span className="feature-list-item-name">{consolidate.label}</span>
              <span className="feature-list-consolidated-total">{consolidatedCount} spaces</span>
            </button>
            {expanded && consolidatedBreakdown.length > 0 && (
              <ul className="feature-list-breakdown">
                {consolidatedBreakdown.map(({ value, label, count }) => {
                  // Subdivided chips ("sub:...") inherit the parent rule's color.
                  const symValue = value.startsWith('sub:')
                    ? consolidate.subdivide?.value ?? value
                    : value;
                  const sym = ruleSymbology?.find((s) => s.value === symValue);
                  const active = ruleFilter === value;
                  const dimmed = ruleFilter != null && !active;
                  const swatch = sym
                    ? `rgb(${sym.color[0]}, ${sym.color[1]}, ${sym.color[2]})`
                    : '#8aa5b8';
                  return (
                    <li key={value || 'other'}>
                      <button
                        type="button"
                        className={`feature-list-breakdown-chip${active ? ' feature-list-breakdown-chip-active' : ''}${dimmed ? ' feature-list-breakdown-chip-dimmed' : ''}`}
                        onClick={() => onRuleFilterToggle?.(value)}
                        title={
                          active
                            ? 'Show all on-street spaces on the map'
                            : `Show only ${label} spaces on the map`
                        }
                      >
                        <span
                          className="feature-list-breakdown-swatch"
                          style={{ background: swatch }}
                        />
                        <span className="feature-list-breakdown-label">{label}</span>
                        <span className="feature-list-breakdown-count">{count}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {expanded && (
              <span className="feature-list-consolidated-note">
                {ruleFilter != null
                  ? 'Spotlighting these spaces on the map.'
                  : consolidatedBreakdown.length > 0
                    ? 'Tap a time limit to spotlight those spaces on the map.'
                    : consolidate.note}
              </span>
            )}
          </div>
        );
      })()}
      {ruleFilter != null && (
        <button
          type="button"
          className="feature-list-back"
          onClick={() => onRuleFilterToggle?.(ruleFilter)}
        >
          ← Back to all locations
        </button>
      )}
      {filteredEntries.length === 0 ? (
        !onlyConsolidated && <div className="feature-list-empty">No matches</div>
      ) : (
        <ul className="feature-list-items">
          {filteredEntries.map(({ feature, originalIndex }) => {
            const attrs = feature.attributes;
            const name = nameOf(feature) || `Area ${originalIndex + 1}`;
            const restriction = attrs[rendererField] || '';
            const sym = symOf(attrs);
            const spaces = spacesField ? attrs[spacesField] : null;
            const info = idField ? areaInfo?.[String(attrs[idField] ?? '')] : undefined;
            // Same-named on-street segments are told apart by their location text.
            const locDesc =
              consolidate?.descField && ruleFilter != null
                ? String(attrs[consolidate.descField] ?? '').trim()
                : '';

            return (
              <li
                key={attrs.OBJECTID}
                className={`feature-list-item ${originalIndex === selectedIndex ? 'feature-list-item-active' : ''}`}
                onClick={() => onSelect(originalIndex)}
              >
                <div className="feature-list-item-main">
                  {sym && <span className="feature-list-swatch" style={swatchStyle(sym)} />}
                  <span className="feature-list-item-name">{name}</span>
                </div>
                <div className="feature-list-item-meta">
                  {locDesc || info?.availability || sym?.label || restriction}
                  {/* 0/null capacity means "never inventoried" (all on-street
                      permit zones), not "no spaces" — say nothing instead. */}
                  {Number(spaces) > 0 && ` · ${Math.round(Number(spaces))} spaces`}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
