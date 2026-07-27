import type Graphic from '@arcgis/core/Graphic.js';
import type Point from '@arcgis/core/geometry/Point.js';
import type {
  AreaExhibit,
  FieldDef,
  SymbologyEntry,
  LayerFields,
  RelatedRulesConfig,
  WalkTimeStep,
  WalkTimeRouteInfo,
} from '../config/types';
import type { RuleRow } from '../hooks/useRelatedRules';
import { FeatureNavigator } from './FeatureNavigator';
import { LotDetailCard } from './LotDetailCard';
import { FeatureList } from './FeatureList';

interface DetailPanelProps {
  allFeatures: Graphic[];
  selectedFeature: Graphic | null;
  currentIndex: number;
  totalCount: number;
  fields: FieldDef[];
  symbology: SymbologyEntry[];
  layerFields: LayerFields;
  rules?: RuleRow[];
  ruleConfig?: RelatedRulesConfig;
  ruleSymbology?: SymbologyEntry[];
  exhibit?: AreaExhibit;
  welcome?: { heading: string; body: string; hint?: string };
  legendFilter?: string | null;
  onPrev: () => void;
  onNext: () => void;
  onSelectIndex: (index: number) => void;
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
  totalCount,
  fields,
  symbology,
  layerFields,
  rules,
  ruleConfig,
  ruleSymbology,
  exhibit,
  welcome,
  legendFilter,
  onPrev,
  onNext,
  onSelectIndex,
  onWalkHere,
  walkMode,
  walkStep,
  walkRouteInfo,
  walkErrorMessage,
  onWalkReset,
  onWalkCancel,
  lastUpdated,
}: DetailPanelProps) {
  return (
    <aside className="detail-panel">
      <FeatureNavigator
        currentIndex={currentIndex}
        totalCount={totalCount}
        onPrev={onPrev}
        onNext={onNext}
      />

      {selectedFeature ? (
        <LotDetailCard
          feature={selectedFeature}
          fields={fields}
          symbology={symbology}
          layerFields={layerFields}
          rules={rules}
          ruleConfig={ruleConfig}
          ruleSymbology={ruleSymbology}
          exhibit={exhibit}
          onWalkHere={!walkMode ? onWalkHere : undefined}
          walkMode={walkMode}
          walkStep={walkStep}
          walkRouteInfo={walkRouteInfo}
          walkErrorMessage={walkErrorMessage}
          onWalkReset={onWalkReset}
          onWalkCancel={onWalkCancel}
        />
      ) : allFeatures.length === 0 ? (
        <div className="detail-welcome">
          <p>Loading…</p>
        </div>
      ) : (
        <div className="detail-welcome">
          {welcome?.heading && <p className="detail-welcome-heading">{welcome.heading}</p>}
          {welcome?.body && <p>{welcome.body}</p>}
          {welcome?.hint && <p className="detail-welcome-hint">{welcome.hint}</p>}
        </div>
      )}

      <FeatureList
        features={allFeatures}
        selectedIndex={currentIndex}
        onSelect={onSelectIndex}
        symbology={symbology}
        legendFilter={legendFilter}
        layerFields={layerFields}
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
