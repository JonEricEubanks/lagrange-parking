import { useMemo, useState } from 'react';
import type Graphic from '@arcgis/core/Graphic.js';
import type { SymbologyEntry, LayerFields } from '../config/types';

type SortKey = 'name' | 'spaces' | 'restriction';

export function FeatureList({
  features,
  selectedIndex,
  onSelect,
  symbology,
  legendFilter,
  layerFields,
}: {
  features: Graphic[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  symbology?: SymbologyEntry[];
  legendFilter?: string | null;
  layerFields: LayerFields;
}) {
  const { nameField, rendererField, spacesField } = layerFields;
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');

  const nameOf = (g: Graphic): string =>
    String(g.attributes[nameField] ?? g.attributes.AREANAME ?? '');

  const symMap = useMemo(() => {
    const map = new Map<string, SymbologyEntry>();
    if (symbology) for (const s of symbology) map.set(s.value, s);
    return map;
  }, [symbology]);

  const defaultSym = symMap.get('_default');

  const filteredEntries = useMemo(() => {
    let entries = features.map((feature, originalIndex) => ({ feature, originalIndex }));

    if (legendFilter != null) {
      const knownValues = symbology
        ? symbology.filter((s) => s.value !== '_default').map((s) => s.value)
        : [];
      entries = entries.filter(({ feature }) => {
        const val = feature.attributes[rendererField] ?? '';
        if (legendFilter === '_default') return !knownValues.includes(val);
        return val === legendFilter;
      });
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      entries = entries.filter(({ feature }) => nameOf(feature).toLowerCase().includes(q));
    }

    entries.sort((a, b) => {
      if (sortKey === 'name') return nameOf(a.feature).localeCompare(nameOf(b.feature));
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
      return String(ra).localeCompare(String(rb));
    });

    return entries;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features, legendFilter, search, sortKey, symbology, rendererField, spacesField, nameField]);

  if (features.length === 0) return <div className="feature-list-empty">Loading...</div>;

  return (
    <div className="feature-list">
      <h4 className="feature-list-heading">All Locations</h4>
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
      {filteredEntries.length === 0 ? (
        <div className="feature-list-empty">No matches</div>
      ) : (
        <ul className="feature-list-items">
          {filteredEntries.map(({ feature, originalIndex }) => {
            const attrs = feature.attributes;
            const name = nameOf(feature) || `Area ${originalIndex + 1}`;
            const restriction = attrs[rendererField] || '';
            const sym = symMap.get(restriction) || defaultSym;
            const spaces = spacesField ? attrs[spacesField] : null;
            const symColor = sym?.color;

            return (
              <li
                key={attrs.OBJECTID}
                className={`feature-list-item ${originalIndex === selectedIndex ? 'feature-list-item-active' : ''}`}
                onClick={() => onSelect(originalIndex)}
              >
                <div className="feature-list-item-main">
                  {symColor && (
                    <span
                      className="feature-list-swatch"
                      style={{
                        backgroundColor: `rgba(${symColor[0]}, ${symColor[1]}, ${symColor[2]}, ${symColor[3]})`,
                      }}
                    />
                  )}
                  <span className="feature-list-item-name">{name}</span>
                </div>
                <div className="feature-list-item-meta">
                  {sym?.label ?? restriction}
                  {spaces != null && ` · ${Math.round(Number(spaces))} spaces`}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
