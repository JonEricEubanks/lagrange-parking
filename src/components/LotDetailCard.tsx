import { useEffect, useState } from 'react';
import type Graphic from '@arcgis/core/Graphic.js';
import type Point from '@arcgis/core/geometry/Point.js';
import type Polygon from '@arcgis/core/geometry/Polygon.js';
import SpatialReference from '@arcgis/core/geometry/SpatialReference.js';
import * as projectOperator from '@arcgis/core/geometry/operators/projectOperator.js';
import type {
  AreaExhibit,
  AreaInfo,
  FieldDef,
  SymbologyEntry,
  LayerFields,
  RelatedRulesConfig,
  WalkTimeStep,
  WalkTimeRouteInfo,
} from '../config/types';
import { areaDisplayName, classifySymbology, swatchStyle } from '../config/lots';
import type { RuleRow } from '../hooks/useRelatedRules';

function formatValue(value: unknown, format?: string): string {
  if (value == null || value === '') return '--';
  if (format === 'boolean') return Number(value) === 1 ? 'Yes' : 'No';
  if (format === 'integer') return String(Math.round(Number(value)));
  if (format === 'duration') {
    // GIS codes like "2HOURS" / "15MIN" / "ANYTIME" → friendly text.
    const raw = String(value).trim().toUpperCase();
    if (raw === 'ANYTIME') return 'No time limit';
    const m = raw.match(/^(\d+)\s*(MIN|HOURS?)$/);
    if (m) {
      const n = Number(m[1]);
      const unit = m[2].startsWith('MIN') ? 'minute' : 'hour';
      return `${n} ${unit}${n === 1 ? '' : 's'}`;
    }
  }
  return String(value);
}

function formatHour(x: number): string {
  const h = Math.floor(x);
  const m = Math.round((x - h) * 60);
  const h12 = ((h + 11) % 12) + 1;
  const ampm = h >= 12 ? 'pm' : 'am';
  return m ? `${h12}:${String(m).padStart(2, '0')} ${ampm}` : `${h12} ${ampm}`;
}

/** Live open/closed state from the profile-authored windows and the clock. */
function openStatus(
  hours: NonNullable<AreaInfo['hours']>,
  now = new Date()
): { open: boolean; text: string } {
  const h = now.getHours() + now.getMinutes() / 60;
  // Village-wide overnight ban trumps any lot's own window.
  if (h >= 2 && h < 6) return { open: false, text: 'No parking 2–6 am' };
  const today = hours.filter((w) => w.days.includes(now.getDay()));
  if (today.some((w) => h >= w.from && h < w.to)) return { open: true, text: 'Open now' };
  const next = today.filter((w) => w.from > h).sort((a, b) => a.from - b.from)[0];
  if (next) return { open: false, text: `Opens at ${formatHour(next.from)}` };
  return { open: false, text: 'Closed today' };
}

export function LotDetailCard({
  feature,
  fields,
  symbology,
  layerFields,
  rules,
  ruleConfig,
  ruleSymbology,
  exhibit,
  areaInfo,
  subzoneNote,
  cardNote,
  showDirections,
  onWalkHere,
  walkMode,
  walkStep,
  walkRouteInfo,
  walkErrorMessage,
  onWalkReset,
  onWalkCancel,
}: {
  feature: Graphic;
  fields: FieldDef[];
  symbology: SymbologyEntry[];
  layerFields: LayerFields;
  rules?: RuleRow[];
  ruleConfig?: RelatedRulesConfig;
  ruleSymbology?: SymbologyEntry[];
  /** Diagram of the designated spaces inside this lot, when one exists. */
  exhibit?: AreaExhibit;
  /** Profile-authored availability and time-limit info for this lot. */
  areaInfo?: AreaInfo;
  /**
   * The "park only in the highlighted areas" rule. Only passed for lots that
   * actually have designated areas drawn — on a lot without them it would read
   * as "you cannot park here at all".
   */
  subzoneNote?: string;
  /** Tab-level or lot-specific note (e.g. daytime guidance, level restrictions). */
  cardNote?: string;
  /** Show a "Get directions" link to the lot in the user's maps app. */
  showDirections?: boolean;
  onWalkHere?: (centroid: Point) => void;
  walkMode?: boolean;
  walkStep?: WalkTimeStep;
  walkRouteInfo?: WalkTimeRouteInfo | null;
  walkErrorMessage?: string | null;
  onWalkReset?: () => void;
  onWalkCancel?: () => void;
}) {
  const attrs = feature.attributes;
  const lotName = areaDisplayName(
    attrs,
    layerFields.nameField,
    layerFields.idField,
    layerFields.nameOverrides
  );
  const restriction = attrs[layerFields.rendererField] || '';

  const symMatch =
    classifySymbology(attrs, symbology) ||
    symbology.find((s) => s.value === restriction) ||
    symbology.find((s) => s.value === '_default');
  const friendlyLabel = symMatch?.label ?? (restriction || '--');
  const symColor = symMatch?.color ?? [0, 0, 0, 0];
  const borderColor = `rgba(${symColor[0]}, ${symColor[1]}, ${symColor[2]}, ${symColor[3]})`;

  // A `hideZero` field drops out entirely when it has no usable value, so an
  // un-inventoried area doesn't advertise "Spaces 0".
  const shown = fields.filter((f) => !(f.hideZero && !Number(attrs[f.field])));
  const mainFields = shown.filter((f) => f.section !== 'detail');
  const detailFields = shown.filter((f) => f.section === 'detail');

  const ruleLabel = (r: RuleRow): string => {
    if (!ruleConfig) return 'Rule';
    const code = String(r[ruleConfig.labelField] ?? '');
    return (ruleSymbology?.find((s) => s.value === code)?.label ?? code) || 'Rule';
  };

  // Does this row put anything on screen besides its heading?
  const hasDetail = (row: RuleRow): boolean =>
    !!ruleConfig &&
    (ruleConfig.display.some((f) => formatValue(row[f.field], f.format) !== '--') ||
      // An apply link is content too — never drop a row that carries one.
      (!!ruleConfig.purchaseUrlField && !!row[ruleConfig.purchaseUrlField]));

  // The hosted ParkingRule table carries bare rows — same rule type, no
  // enforcement window and no duration — alongside a fully populated row for the
  // same permit. Those render as a heading with nothing under it, so drop a
  // detail-less row when another row for the same permit type does have detail.
  // A bare row that is the only one of its type is kept, so a lot never loses
  // its sole rule.
  const visibleRules = (rules ?? []).filter((r, i, all) => {
    if (!ruleConfig || hasDetail(r)) return true;
    const label = ruleLabel(r);
    return !all.some((o, j) => j !== i && ruleLabel(o) === label && hasDetail(o));
  });

  const centroid = (feature.geometry as Polygon)?.centroid ?? null;
  const status = areaInfo?.hours ? openStatus(areaInfo.hours) : null;

  // The hosted layer is in a state-plane projection, so lat/lng for the
  // directions link has to be projected out of it.
  const [destination, setDestination] = useState<string | null>(null);
  useEffect(() => {
    setDestination(null);
    if (!showDirections || !centroid) return;
    if (centroid.latitude != null && centroid.longitude != null) {
      setDestination(`${centroid.latitude.toFixed(6)},${centroid.longitude.toFixed(6)}`);
      return;
    }
    let cancelled = false;
    (async () => {
      if (!projectOperator.isLoaded()) await projectOperator.load();
      const pt = projectOperator.execute(centroid, SpatialReference.WGS84) as Point | null;
      if (!cancelled && pt) setDestination(`${pt.y.toFixed(6)},${pt.x.toFixed(6)}`);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feature, showDirections]);

  return (
    <div className="lot-detail-card" style={{ borderLeft: `5px solid ${borderColor}` }}>
      <div className="lot-card-header">
        <span className="lot-card-name">{lotName}</span>
        <span className="lot-card-restriction">
          <span
            className="lot-card-restriction-swatch"
            style={symMatch ? swatchStyle(symMatch) : { backgroundColor: borderColor }}
          />
          {friendlyLabel}
        </span>
      </div>

      {status && (
        <span className={`lot-card-open-badge ${status.open ? 'is-open' : 'is-closed'}`}>
          {status.text}
        </span>
      )}

      {/* Only the marked areas inside this lot are permitted, and the map shows
          which. Stated in words because "no green here" is not something a
          visitor should have to infer. */}
      {subzoneNote && <p className="lot-card-subzone-note">{subzoneNote}</p>}
      {cardNote && <p className="lot-card-tab-note">{cardNote}</p>}

      {mainFields.length > 0 && (
        <table className="lot-card-table">
          <tbody>
            {mainFields.map((f) => (
              <tr key={f.field}>
                <td className="lot-card-label">{f.label}</td>
                <td className="lot-card-value">{formatValue(attrs[f.field], f.format)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Related parking rules — filtered per audience by the caller */}
      {areaInfo && (
        <div className="lot-card-rules">
          <h4 className="lot-card-details-heading">Public parking</h4>
          <div className="rule-row">
            <div className="rule-row-detail">
              <span className="rule-row-detail-label">Availability:</span> {areaInfo.availability}
            </div>
            <div className="rule-row-detail">
              <span className="rule-row-detail-label">Time limit:</span> {areaInfo.timeLimit}
            </div>
          </div>
        </div>
      )}
      {ruleConfig && !areaInfo && visibleRules.length > 0 && (
        <div className="lot-card-rules">
          <h4 className="lot-card-details-heading">Parking rules</h4>
          {visibleRules.map((r, i) => {
            const url = ruleConfig.purchaseUrlField
              ? (r[ruleConfig.purchaseUrlField] as string | undefined)
              : undefined;
            return (
              <div key={i} className="rule-row">
                <div className="rule-row-title">{ruleLabel(r)}</div>
                {ruleConfig.display.map((f) => {
                  const v = formatValue(r[f.field], f.format);
                  if (v === '--') return null;
                  return (
                    <div key={f.field} className="rule-row-detail">
                      <span className="rule-row-detail-label">{f.label}:</span> {v}
                    </div>
                  );
                })}
                {url && (
                  <a className="rule-apply-btn" href={url} target="_blank" rel="noopener noreferrer">
                    How to apply
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Some permits are only valid in specific spaces inside a lot — show the
          Village's designated-space diagram rather than trying to describe it. */}
      {exhibit && (
        <figure className="lot-card-exhibit">
          <h4 className="lot-card-details-heading">Designated spaces</h4>
          <a href={import.meta.env.BASE_URL + exhibit.image} target="_blank" rel="noopener noreferrer">
            <img
              className="lot-card-exhibit-img"
              src={import.meta.env.BASE_URL + exhibit.image}
              alt={exhibit.caption ?? `Designated parking spaces in ${lotName}`}
            />
          </a>
          {(exhibit.caption || exhibit.credit) && (
            <figcaption className="lot-card-exhibit-caption">
              {exhibit.caption}
              {exhibit.credit && <span className="lot-card-exhibit-credit">{exhibit.credit}</span>}
            </figcaption>
          )}
        </figure>
      )}


      {detailFields.length > 0 && (
        <>
          <h4 className="lot-card-details-heading">Details</h4>
          {detailFields.map((f) => (
            <div key={f.field} className="lot-card-detail-row">
              <span className="lot-card-detail-label">{f.label}:</span>{' '}
              <strong>{formatValue(attrs[f.field], f.format)}</strong>
            </div>
          ))}
        </>
      )}

      {showDirections && destination && (
        <a
          className="lot-card-directions"
          href={`https://www.google.com/maps/dir/?api=1&destination=${destination}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Get directions ↗
        </a>
      )}

      {/* Walk Here button (only when walk-time is enabled and not already active) */}
      {onWalkHere && centroid && !walkMode && (
        <button className="walk-here-btn" onClick={() => onWalkHere(centroid)}>
          Walk here
        </button>
      )}

      {walkMode && (
        <div className="walk-inline">
          {walkStep === 'set-start' && (
            <div className="walk-inline-prompt">Click the map to set your starting location</div>
          )}
          {walkStep === 'set-end' && <div className="walk-inline-prompt">Now click your destination</div>}
          {walkStep === 'solving' && <div className="walk-inline-prompt">Calculating route...</div>}
          {walkStep === 'result' && walkRouteInfo && (
            <div className="walk-inline-result">
              <div className="walk-inline-result-row">
                <span className="walk-inline-result-label">Walk Time</span>
                <span className="walk-inline-result-value">{walkRouteInfo.totalMinutes} min</span>
              </div>
              <div className="walk-inline-result-row">
                <span className="walk-inline-result-label">Distance</span>
                <span className="walk-inline-result-value">{walkRouteInfo.totalMiles} mi</span>
              </div>
            </div>
          )}
          {walkStep === 'error' && (
            <div className="walk-inline-error">{walkErrorMessage || 'An error occurred.'}</div>
          )}
          <div className="walk-inline-actions">
            {(walkStep === 'result' || walkStep === 'error') && onWalkReset && (
              <button className="walk-inline-action" onClick={onWalkReset}>
                Retry
              </button>
            )}
            {onWalkCancel && (
              <button className="walk-inline-action walk-inline-cancel" onClick={onWalkCancel}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
