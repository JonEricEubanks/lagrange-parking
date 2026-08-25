import { useCallback, useMemo } from 'react';
import type Graphic from '@arcgis/core/Graphic.js';
import type Point from '@arcgis/core/geometry/Point.js';
import type {
  AreaExhibit,
  AreaInfo,
  FieldDef,
  SymbologyEntry,
  LayerFields,
  ParkingProfile,
  RelatedRulesConfig,
  WalkTimeStep,
  WalkTimeRouteInfo,
} from '../config/types';
import type { RuleRow } from '../hooks/useRelatedRules';
import { areaDisplayName, matchesLegendFilter } from '../config/lots';
import { FeatureNavigator } from './FeatureNavigator';
import { LotDetailCard } from './LotDetailCard';
import { FeatureList } from './FeatureList';

interface DetailPanelProps {
  allFeatures: Graphic[];
  selectedFeature: Graphic | null;
  currentIndex: number;
  fields: FieldDef[];
  symbology: SymbologyEntry[];
  layerFields: LayerFields;
  rules?: RuleRow[];
  ruleConfig?: RelatedRulesConfig;
  ruleSymbology?: SymbologyEntry[];
  exhibit?: AreaExhibit;
  welcome?: { heading: string; body: string; hint?: string };
  legendFilter?: string | null;
  areaInfo?: Record<string, AreaInfo>;
  cardNote?: string;
  subzoneNote?: string;
  showDirections?: boolean;
  consolidateList?: ParkingProfile['consolidateList'];
  ruleFilter?: string | null;
  onRuleFilterToggle?: (value: string) => void;
  onSelectIndex: (index: number) => void;
  onClearSelection?: () => void;
  onWalkHere?: (centroid: Point) => void;
  walkMode?: boolean;
  walkStep?: WalkTimeStep;
  walkRouteInfo?: WalkTimeRouteInfo | null;
  walkErrorMessage?: string | null;
  onWalkReset?: () => void;
  onWalkCancel?: () => void;
  lastUpdated?: string;
}

export function DetailPanel({
  allFeatures,
  selectedFeature,
  currentIndex,
  fields,
  symbology,
  layerFields,
  rules,
  ruleConfig,
  ruleSymbology,
  exhibit,
  welcome,
  legendFilter,
  areaInfo,
  cardNote,
  subzoneNote,
  showDirections,
  consolidateList,
  ruleFilter,
  onRuleFilterToggle,
  onSelectIndex,
  onClearSelection,
  onWalkHere,
  walkMode,
  walkStep,
  walkRouteInfo,
  walkErrorMessage,
  onWalkReset,
  onWalkCancel,
  lastUpdated,
}: DetailPanelProps) {
  // The set of features the prev/next arrows page through: same features the
  // list shows (legend filter applied, consolidated on-street spaces skipped),
  // in the same name order.
  const navIndices = useMemo(() => {
    const { nameField, idField, rendererField, nameOverrides } = layerFields;
    let entries = allFeatures.map((feature, index) => ({ feature, index }));
    if (legendFilter != null) {
      entries = entries.filter(({ feature }) =>
        matchesLegendFilter(feature.attributes, symbology, rendererField, legendFilter)
      );
    }
    if (consolidateList) {
      const { field, values } = consolidateList;
      entries = entries.filter(
        ({ feature }) => !values.includes(String(feature.attributes[field] ?? ''))
      );
    }
    entries.sort((a, b) =>
      areaDisplayName(a.feature.attributes, nameField, idField, nameOverrides).localeCompare(
        areaDisplayName(b.feature.attributes, nameField, idField, nameOverrides),
        undefined,
        { numeric: true }
      )
    );
    return entries.map((e) => e.index);
  }, [allFeatures, legendFilter, symbology, layerFields, consolidateList]);

  const navPos = navIndices.indexOf(currentIndex);

  const handlePrev = useCallback(() => {
    if (navIndices.length === 0) return;
    const target = navPos > 0 ? navIndices[navPos - 1] : navIndices[navIndices.length - 1];
    onSelectIndex(target);
  }, [navIndices, navPos, onSelectIndex]);

  const handleNext = useCallback(() => {
    if (navIndices.length === 0) return;
    const target =
      navPos >= 0 && navPos < navIndices.length - 1 ? navIndices[navPos + 1] : navIndices[0];
    onSelectIndex(target);
  }, [navIndices, navPos, onSelectIndex]);

  return (
    <aside className="detail-panel">
      {selectedFeature && (
        <FeatureNavigator
          currentIndex={navPos}
          totalCount={navIndices.length}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      )}

      {selectedFeature ? (
        <>
          {onClearSelection && (
            <button type="button" className="detail-back" onClick={onClearSelection}>
              ← Back to all locations
            </button>
          )}
          <LotDetailCard
            feature={selectedFeature}
            fields={fields}
            symbology={symbology}
            layerFields={layerFields}
            rules={rules}
            ruleConfig={ruleConfig}
            ruleSymbology={ruleSymbology}
            exhibit={exhibit}
            areaInfo={
              layerFields.idField
                ? areaInfo?.[String(selectedFeature.attributes[layerFields.idField] ?? '')]
                : undefined
            }
            cardNote={cardNote}
            subzoneNote={subzoneNote}
            showDirections={showDirections}
            onWalkHere={!walkMode ? onWalkHere : undefined}
            walkMode={walkMode}
            walkStep={walkStep}
            walkRouteInfo={walkRouteInfo}
            walkErrorMessage={walkErrorMessage}
            onWalkReset={onWalkReset}
            onWalkCancel={onWalkCancel}
          />
        </>
      ) : allFeatures.length === 0 ? (
        <div className="detail-welcome">
          <p>Loading…</p>
        </div>
      ) : (
        welcome?.hint && (
          <div className="detail-welcome">
            <p className="detail-welcome-hint">{welcome.hint}</p>
          </div>
        )
      )}

      <FeatureList
        features={allFeatures}
        selectedIndex={currentIndex}
        onSelect={onSelectIndex}
        symbology={symbology}
        legendFilter={legendFilter}
        layerFields={layerFields}
        areaInfo={areaInfo}
        consolidate={consolidateList}
        ruleSymbology={ruleSymbology}
        ruleFilter={ruleFilter}
        onRuleFilterToggle={onRuleFilterToggle}
      />

      {lastUpdated && (
        <div className="detail-last-updated">
          Data updated{' '}
          {new Date(lastUpdated + 'T00:00:00').toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      )}
    </aside>
  );
}
