import type { SymbologyEntry } from '../config/types';
import { swatchStyle } from '../config/lots';

interface LegendProps {
  title?: string;
  symbology: SymbologyEntry[];
  /** Renderer values actually present in the loaded lots — drives the legend. */
  presentValues: Set<string>;
  activeFilter?: string | null;
  onFilterToggle?: (value: string) => void;
  className?: string;
}

export function Legend({
  title = 'Legend',
  symbology,
  presentValues,
  activeFilter = null,
  onFilterToggle,
  className = '',
}: LegendProps) {
  const knownValues = new Set(symbology.filter((s) => s.value !== '_default').map((s) => s.value));
  const hasUnknown = [...presentValues].some((v) => !knownValues.has(v));
  // Only show legend entries that actually occur in the current lots.
  const entries = symbology.filter((s) => {
    if (s.value === '_default') return hasUnknown;
    if (s.match) return true; // match-based entries always represent real map colors
    return presentValues.has(s.value);
  });

  return (
    <div className={`guide-legend ${className}`}>
      <div className="legend-header">
        <h3 className="legend-title">{title}</h3>
        {activeFilter !== null && onFilterToggle && (
          <button className="legend-show-all" onClick={() => onFilterToggle(activeFilter)}>
            Show All
          </button>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="legend-empty-note">No areas to show for this group yet.</p>
      ) : (
        <ul className="legend-list">
          {entries.map((s) => {
            const isActive = activeFilter === s.value;
            const isDimmed = activeFilter !== null && !isActive;
            return (
              <li
                key={s.value}
                className={`legend-item ${onFilterToggle ? 'legend-item-clickable' : ''} ${isActive ? 'legend-item-active' : ''} ${isDimmed ? 'legend-item-dimmed' : ''}`}
                onClick={() => onFilterToggle?.(s.value)}
              >
                <span className="legend-swatch" style={swatchStyle(s)} />
                <span className="legend-label" title={s.tooltip}>
                  {s.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {onFilterToggle && entries.length > 0 && (
        <p className="legend-filter-hint">Click a color to filter the map</p>
      )}
    </div>
  );
}
