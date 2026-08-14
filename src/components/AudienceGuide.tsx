import type { SymbologyEntry, AudienceGuideContent, ApplyLink } from '../config/types';
import { swatchStyle } from '../config/lots';
import { PermitInfo } from './PermitInfo';

interface AudienceGuideProps {
  /** Audience/section name shown as the rail heading (e.g. "Residents"). */
  heading?: string;
  guide?: AudienceGuideContent;
  /** Shown when the active tab has no guide (e.g. the public app) — profile.welcome. */
  fallback?: { heading: string; body: string };
  /** Profile-level apply link; a guide's own apply link overrides it. */
  apply?: ApplyLink;
  legendTitle?: string;
  symbology: SymbologyEntry[];
  /** Renderer values actually present in the loaded lots — drives the legend. */
  presentValues: Set<string>;
  activeFilter?: string | null;
  onFilterToggle?: (value: string) => void;
  isOpen?: boolean;
  /** Lets a guide's "see also" pointer switch to another permit tab. */
  onGoToTab?: (tabId: string) => void;
}

export function AudienceGuide({
  heading,
  guide,
  fallback,
  apply,
  legendTitle = 'Legend',
  symbology,
  presentValues,
  activeFilter = null,
  onFilterToggle,
  isOpen,
  onGoToTab,
}: AudienceGuideProps) {
  const knownValues = new Set(symbology.filter((s) => s.value !== '_default').map((s) => s.value));
  const hasUnknown = [...presentValues].some((v) => !knownValues.has(v));
  // Only show legend entries that actually occur in the current lots.
  const entries = symbology.filter((s) =>
    s.value === '_default' ? hasUnknown : presentValues.has(s.value)
  );

  const applyLink = guide?.apply ?? apply;
  const showGuide = !!guide?.who;

  return (
    <aside className={`legend-sidebar audience-guide ${isOpen ? 'legend-sidebar-open' : ''}`}>
      {showGuide ? (
        <div className="guide-section">
          {heading && <h2 className="guide-heading">{heading}</h2>}
          <p className="guide-who">{guide!.who}</p>
          {guide!.note && <p className="guide-note">{guide!.note}</p>}
          {applyLink && (
            <a
              className="guide-apply-btn"
              href={applyLink.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {applyLink.label}
            </a>
          )}
        </div>
      ) : (
        fallback && (
          <div className="guide-section">
            <h2 className="guide-heading">{fallback.heading}</h2>
            <p className="guide-who">{fallback.body}</p>
            {applyLink && (
              <a
                className="guide-apply-btn"
                href={applyLink.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {applyLink.label}
              </a>
            )}
          </div>
        )
      )}

      <PermitInfo guide={guide} onGoToTab={onGoToTab} />

      <div className="guide-legend">
        <h3 className="legend-title">{legendTitle}</h3>
        {activeFilter !== null && onFilterToggle && (
          <button className="legend-show-all" onClick={() => onFilterToggle(activeFilter)}>
            Show All
          </button>
        )}
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
      </div>
    </aside>
  );
}
