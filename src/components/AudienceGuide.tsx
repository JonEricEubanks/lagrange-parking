import type { SymbologyEntry, AudienceGuideContent, ApplyLink } from '../config/types';
import { PermitInfo } from './PermitInfo';
import { Legend } from './Legend';

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
  /** Closes the mobile bottom sheet (grip tap); unused on desktop. */
  onClose?: () => void;
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
  onClose,
  onGoToTab,
}: AudienceGuideProps) {
  const applyLink = guide?.apply ?? apply;
  const showGuide = !!guide?.who;

  return (
    <aside className={`legend-sidebar audience-guide ${isOpen ? 'legend-sidebar-open' : ''}`}>
      <button className="guide-sheet-handle" onClick={onClose} aria-label="Close guide">
        <span className="guide-sheet-grip" />
      </button>
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

      {/* Drawer copy of the legend — shown on mobile/tablet only; desktop uses the right rail. */}
      <Legend
        className="guide-legend-drawer"
        title={legendTitle}
        symbology={symbology}
        presentValues={presentValues}
        activeFilter={activeFilter}
        onFilterToggle={onFilterToggle}
      />
    </aside>
  );
}
