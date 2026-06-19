import { useCallback, useEffect, useMemo, useState } from 'react';
import type MapView from '@arcgis/core/views/MapView.js';
import type Point from '@arcgis/core/geometry/Point.js';
import type { LayerFields, ParkingProfile } from '../config/types';
import { useParkingLayer } from '../hooks/useParkingLayer';
import { useSelectedLot } from '../hooks/useSelectedLot';
import { useRelatedRules } from '../hooks/useRelatedRules';
import { useAudienceAreaIds } from '../hooks/useAudienceAreaIds';
import { useWalkRoute } from '../hooks/useWalkRoute';
import { Header } from './Header';
import { TabBar } from './TabBar';
import { AudienceGuide } from './AudienceGuide';
import { MapPanel } from './MapPanel';
import { DetailPanel } from './DetailPanel';

const and = (...parts: (string | undefined | null)[]) =>
  parts.filter((p) => p && p.trim()).map((p) => `(${p})`).join(' AND ');

export function ParkingApp({ profile, onHome }: { profile: ParkingProfile; onHome?: () => void }) {
  const { layer: featureLayer, setDefinitionExpression } = useParkingLayer(profile);

  const layerFields: LayerFields = useMemo(
    () => ({
      nameField: profile.layer.nameField,
      rendererField: profile.layer.rendererField,
      idField: profile.layer.idField,
      spacesField: profile.layer.spacesField,
    }),
    [profile.layer]
  );
  const rField = profile.layer.rendererField;

  const visibleTabs = useMemo(
    () => profile.tabs.filter((t) => t.id !== 'walk-time'),
    [profile.tabs]
  );

  const [activeTab, setActiveTab] = useState(() => visibleTabs[0]?.id ?? '');
  const [mapView, setMapView] = useState<MapView | null>(null);
  const [legendFilter, setLegendFilter] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(true);
  const [walkMode, setWalkMode] = useState(false);

  const activeTabDef = useMemo(
    () => profile.tabs.find((t) => t.id === activeTab),
    [profile.tabs, activeTab]
  );

  // Audience membership is derived from the rules (reliable PERMITZONE), not the
  // source HAS* flags — so no hosted-data edit is needed for the tabs to be correct.
  const audienceIds = useAudienceAreaIds(profile.relatedRules, activeTabDef?.ruleWhere);

  const memberFilter = useMemo(() => {
    // Prefer precise rules-derived membership; fall back to the HAS* flag so the
    // map always shows lots even while the rules query loads (or if it fails).
    if (audienceIds && audienceIds.length > 0) {
      const idField = profile.layer.idField ?? 'AREAID';
      const list = audienceIds.map((v) => `'${v.replace(/'/g, "''")}'`).join(',');
      return `${idField} IN (${list})`;
    }
    return activeTabDef?.where ?? '';
  }, [activeTabDef, audienceIds, profile.layer.idField]);

  // Filter that defines the current audience/tab feature set (no legend filter).
  const listWhere = useMemo(
    () => and(profile.layer.baseWhere, memberFilter) || '1=1',
    [profile.layer.baseWhere, memberFilter]
  );

  // Legend filter clause built off the renderer field.
  const legendWhere = useMemo(() => {
    if (!legendFilter) return '';
    if (legendFilter === '_default') {
      const known = profile.symbology
        .filter((s) => s.value !== '_default')
        .map((s) => `'${s.value}'`)
        .join(', ');
      return `${rField} NOT IN (${known}) OR ${rField} IS NULL`;
    }
    return `${rField} = '${legendFilter}'`;
  }, [legendFilter, profile.symbology, rField]);

  // What the map actually draws: base AND tab AND legend.
  const mapWhere = useMemo(() => and(listWhere, legendWhere) || '1=1', [listWhere, legendWhere]);

  const lot = useSelectedLot(featureLayer, listWhere, layerFields.nameField);

  // Legend is data-driven: only the renderer values actually present in the
  // current lots appear (never an empty entry, never a hidden in-use color).
  const presentValues = useMemo(() => {
    const set = new Set<string>();
    for (const f of lot.allFeatures) {
      const v = f.attributes[rField];
      if (v != null && v !== '') set.add(String(v));
    }
    return set;
  }, [lot.allFeatures, rField]);

  // Apply profile branding to CSS variables so the theme is profile-driven.
  useEffect(() => {
    const b = profile.branding;
    const root = document.documentElement.style;
    root.setProperty('--lf-midnight', b.midnight);
    root.setProperty('--lf-primary', b.primary);
    root.setProperty('--lf-secondary', b.secondary);
    root.setProperty('--lf-green-gray', b.greenGray);
    root.setProperty('--lf-border', b.greenGray);
    root.setProperty('--lf-light-gray', b.lightGray);
    root.setProperty('--lf-white', b.white);
    root.setProperty('--font-header', b.fontHeader);
    root.setProperty('--font-body', b.fontBody);
  }, [profile.branding]);

  // Push the composed filter to the layer whenever it changes / the layer appears.
  useEffect(() => {
    if (featureLayer) setDefinitionExpression(mapWhere);
  }, [featureLayer, mapWhere, setDefinitionExpression]);

  // Related rules for the selected lot, narrowed to the active audience.
  const selectedAreaId = layerFields.idField
    ? lot.selectedFeature?.attributes?.[layerFields.idField]
    : undefined;
  const rules = useRelatedRules(profile.relatedRules, selectedAreaId, activeTabDef?.ruleWhere);

  const walkRoute = useWalkRoute(mapView, walkMode);
  const walkEnabled = !!profile.enableWalkTime;

  const handleTabClick = useCallback((tabId: string) => {
    setActiveTab(tabId);
    setLegendFilter(null);
  }, []);

  // Zoom to the current audience's lots whenever the (non-legend) filter changes.
  useEffect(() => {
    if (!mapView || !featureLayer || listWhere === '1=0') return;
    let cancelled = false;
    featureLayer
      .queryExtent({ where: listWhere })
      .then((result) => {
        if (!cancelled && result.extent) {
          mapView.goTo(result.extent.expand(1.4), { duration: 600 }).catch(() => {});
        }
      })
      .catch(() => {
        /* keep current view */
      });
    return () => {
      cancelled = true;
    };
  }, [listWhere, mapView, featureLayer]);

  const handleFeatureClick = useCallback(
    (graphic: Parameters<typeof lot.selectByClick>[0]) => {
      lot.selectByClick(graphic);
      setDetailOpen(true);
    },
    [lot]
  );

  const handleSelectIndex = useCallback(
    (index: number) => {
      lot.selectByIndex(index);
      setDetailOpen(true);
    },
    [lot]
  );

  const handleFilterToggle = useCallback(
    (value: string) => {
      const newFilter = legendFilter === value ? null : value;
      setLegendFilter(newFilter);
      setLegendOpen(false);

      // Clear selection if it no longer matches the filter
      if (newFilter !== null && lot.selectedFeature) {
        const sel = lot.selectedFeature.attributes[rField] ?? '';
        const known = profile.symbology.filter((s) => s.value !== '_default').map((s) => s.value);
        const matches = newFilter === '_default' ? !known.includes(sel) : sel === newFilter;
        if (!matches) lot.clear();
      }
    },
    [legendFilter, profile.symbology, rField, lot]
  );

  const handleWalkHere = useCallback(
    (centroid: Point) => {
      setWalkMode(true);
      setTimeout(() => walkRoute.setDestination(centroid), 50);
    },
    [walkRoute]
  );

  const handleWalkCancel = useCallback(() => {
    walkRoute.reset();
    setWalkMode(false);
  }, [walkRoute]);

  return (
    <div className={`parking-app ${detailOpen ? 'detail-visible' : ''}`}>
      <Header profile={profile} onHome={onHome} />
      <TabBar tabs={visibleTabs} activeTab={activeTab} onTabClick={handleTabClick} />
      <div className="content-area">
        {legendOpen && (
          <div className="legend-mobile-backdrop" onClick={() => setLegendOpen(false)} />
        )}
        <AudienceGuide
          heading={activeTabDef?.label}
          guide={activeTabDef?.guide}
          fallback={profile.welcome}
          apply={profile.apply}
          legendTitle={profile.legendTitle}
          symbology={profile.symbology}
          presentValues={presentValues}
          activeFilter={legendFilter}
          onFilterToggle={handleFilterToggle}
          isOpen={legendOpen}
        />
        <div className="map-panel-wrapper">
          <MapPanel
            profile={profile}
            featureLayer={featureLayer}
            selectedFeature={lot.selectedFeature}
            onFeatureClick={handleFeatureClick}
            walkTimeMode={walkMode}
            onMapClick={walkRoute.handleMapClick}
            onViewReady={setMapView}
          />
          {walkMode && walkRoute.step === 'set-start' && (
            <div className="walk-map-toast">
              Click the map to set your starting walk location
            </div>
          )}
        </div>
        <div className={`detail-panel-container ${detailOpen ? 'detail-panel-container-open' : ''}`}>
          <button
            className="detail-panel-toggle"
            onClick={() => setDetailOpen((o) => !o)}
            aria-label={detailOpen ? 'Collapse details' : 'Expand details'}
          >
            <span className="detail-panel-toggle-bar" />
          </button>
          <DetailPanel
            allFeatures={lot.allFeatures}
            selectedFeature={lot.selectedFeature}
            currentIndex={lot.currentIndex}
            totalCount={lot.totalCount}
            fields={profile.fields.display}
            symbology={profile.symbology}
            layerFields={layerFields}
            rules={rules}
            ruleConfig={profile.relatedRules}
            ruleSymbology={profile.ruleSymbology}
            welcome={profile.welcome}
            legendFilter={legendFilter}
            onPrev={lot.prev}
            onNext={lot.next}
            onSelectIndex={handleSelectIndex}
            onWalkHere={walkEnabled ? handleWalkHere : undefined}
            walkMode={walkMode}
            walkStep={walkRoute.step}
            walkRouteInfo={walkRoute.routeInfo}
            walkErrorMessage={walkRoute.errorMessage}
            onWalkReset={walkRoute.reset}
            onWalkCancel={handleWalkCancel}
            lastUpdated={profile.lastUpdated}
          />
        </div>
      </div>
      <button className="legend-mobile-toggle" onClick={() => setLegendOpen((o) => !o)}>
        Legend
      </button>
    </div>
  );
}
