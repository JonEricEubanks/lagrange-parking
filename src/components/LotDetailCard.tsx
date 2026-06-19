import type Graphic from '@arcgis/core/Graphic.js';
import type Point from '@arcgis/core/geometry/Point.js';
import type Polygon from '@arcgis/core/geometry/Polygon.js';
import type {
  FieldDef,
  SymbologyEntry,
  LayerFields,
  RelatedRulesConfig,
  WalkTimeStep,
  WalkTimeRouteInfo,
} from '../config/types';
import type { RuleRow } from '../hooks/useRelatedRules';

function formatValue(value: unknown, format?: string): string {
  if (value == null || value === '') return '--';
  if (format === 'boolean') return Number(value) === 1 ? 'Yes' : 'No';
  if (format === 'integer') return String(Math.round(Number(value)));
  return String(value);
}

export function LotDetailCard({
  feature,
  fields,
  symbology,
  layerFields,
  rules,
  ruleConfig,
  ruleSymbology,
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
  onWalkHere?: (centroid: Point) => void;
  walkMode?: boolean;
  walkStep?: WalkTimeStep;
  walkRouteInfo?: WalkTimeRouteInfo | null;
  walkErrorMessage?: string | null;
  onWalkReset?: () => void;
  onWalkCancel?: () => void;
}) {
  const attrs = feature.attributes;
  const lotName = String(attrs[layerFields.nameField] ?? attrs.AREANAME ?? 'Parking Area');
  const restriction = attrs[layerFields.rendererField] || '';

  const symMatch =
    symbology.find((s) => s.value === restriction) ||
    symbology.find((s) => s.value === '_default');
  const friendlyLabel = restriction ? (symMatch?.label ?? restriction) : '--';
  const symColor = symMatch?.color ?? [0, 0, 0, 0];
  const borderColor = `rgba(${symColor[0]}, ${symColor[1]}, ${symColor[2]}, ${symColor[3]})`;

  const mainFields = fields.filter((f) => f.section !== 'detail');
  const detailFields = fields.filter((f) => f.section === 'detail');

  const ruleLabel = (r: RuleRow): string => {
    if (!ruleConfig) return 'Rule';
    const code = String(r[ruleConfig.labelField] ?? '');
    return (ruleSymbology?.find((s) => s.value === code)?.label ?? code) || 'Rule';
  };

  const centroid = (feature.geometry as Polygon)?.centroid ?? null;

  return (
    <div className="lot-detail-card" style={{ borderLeft: `5px solid ${borderColor}` }}>
      <div className="lot-card-header">
        <span className="lot-card-name">{lotName}</span>
        <span className="lot-card-restriction">
          <span
            className="lot-card-restriction-swatch"
            style={{
              backgroundColor: `rgba(${symColor[0]}, ${symColor[1]}, ${symColor[2]}, ${symColor[3]})`,
            }}
          />
          {friendlyLabel}
        </span>
      </div>

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
      {ruleConfig && rules && rules.length > 0 && (
        <div className="lot-card-rules">
          <h4 className="lot-card-details-heading">Parking rules</h4>
          {rules.map((r, i) => {
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
