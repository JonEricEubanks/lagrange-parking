import { useCallback, useEffect, useMemo, useState } from 'react';
import type MapView from '@arcgis/core/views/MapView.js';
import type Point from '@arcgis/core/geometry/Point.js';
import type { LayerFields, ParkingProfile } from '../config/types';
import { useParkingLayer } from '../hooks/useParkingLayer';
import { useSelectedLot } from '../hooks/useSelectedLot';
import { useRelatedRules } from '../hooks/useRelatedRules';
import { useAudienceAreaIds } from '../hooks/useAudienceAreaIds';
import { useSubzoneAreaIds } from '../hooks/useSubzoneAreaIds';
import { useWalkRoute } from '../hooks/useWalkRoute';
import { explicitAreaWhere, symbologyFilterWhere } from '../config/lots';
import { Header } from './Header';
import { TabBar } from './TabBar';
import { AudienceGuide } from './AudienceGuide';
import { MapPanel } from './MapPanel';
import { DetailPanel } from './DetailPanel';
import { Legend } from './Legend';

const and = (...parts: (string | undefined | null)[]) =>
  parts.filter((p) => p && p.trim()).map((p) => `(${p})`).join(' AND ');

export function ParkingApp({ profile, onHome }: { profile: ParkingProfile; onHome?: () => void }) {
  const { layer: featureLayer, setDefinitionExpression, setBasemapMode, setSubzoneMode } = useParkingLayer(profile);

  const layerFields: LayerFields = useMemo(
    () => ({
      nameField: profile.layer.nameField,
      rendererField: profile.layer.rendererField,
      idField: profile.layer.idField,
      spacesField: profile.layer.spacesField,
      nameOverrides: profile.nameOverrides,
    }),
    [profile.layer, profile.nameOverrides]
  );
  const rField = profile.layer.rendererField;

  const visibleTabs = useMemo(
    () => profile.tabs.filter((t) => t.id !== 'walk-time'),
    [profile.tabs]
  );

  const [activeTab, setActiveTab] = useState(() => visibleTabs[0]?.id ?? '');
  const [mapView, setMapView] = useState<MapView | null>(null);
  const [legendFilter, setLegendFilter] = useState<string | null>(null);
  const [ruleFilter, setRuleFilter] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(true);
  const [walkMode, setWalkMode] = useState(false);

  const activeTabDef = useMemo(
    () => profile.tabs.find((t) => t.id === activeTab),
    [profile.tabs, activeTab]
  );

  // Tabs that carry the Village's own lot list use it verbatim; the rest fall
  // back to membership derived from the rules (reliable PERMITZONE) rather than
  // the source HAS* flags, so no hosted-data edit is needed for them to be right.
  const explicitWhere = explicitAreaWhere(profile, activeTabDef);
  const audienceIds = useAudienceAreaIds(
    profile.relatedRules,
    explicitWhere ? undefined : activeTabDef?.ruleWhere
  );

  const memberFilter = useMemo(() => {
    if (explicitWhere) return explicitWhere;
    // Prefer precise rules-derived membership; fall back to the HAS* flag so the
    // map always shows lots even while the rules query loads (or if it fails).
    if (audienceIds && audienceIds.length > 0) {
      const idField = profile.layer.idField ?? 'AREAID';
      const list = audienceIds.map((v) => `'${v.replace(/'/g, "''")}'`).join(',');
      return `${idField} IN (${list})`;
    }
    return activeTabDef?.where ?? '';
  }, [activeTabDef, explicitWhere, audienceIds, profile.layer.idField]);

  // Filter that defines the current audience/tab feature set (no legend filter).
  const listWhere = useMemo(
    () => and(profile.layer.baseWhere, memberFilter) || '1=1',
    [profile.layer.baseWhere, memberFilter]
  );

  // Legend filter clause — uses match conditions when present (e.g. AREAID-based entries).
  const legendWhere = useMemo(() => {
    if (!legendFilter) return '';
    if (legendFilter === '_default') {
      const known = profile.symbology
        .filter((s) => s.value !== '_default')
        .map((s) => `'${s.value}'`)
        .join(', ');
      return `${rField} NOT IN (${known}) OR ${rField} IS NULL`;
    }
    return symbologyFilterWhere(profile.symbology, legendFilter, rField) ?? `${rField} = '${legendFilter}'`;
  }, [legendFilter, profile.symbology, rField]);

  // Spotlight filter from the on-street breakdown chips (e.g. only 2 Hour spaces).
  // Subdivided chips (e.g. "Metered 12 Hour") carry a `sub:` prefix and match on
  // the subdivide byField instead of the renderer field.
  const ruleFilterWhere = useMemo(() => {
    if (!ruleFilter || !profile.consolidateList) return '';
    const { field, values, subdivide } = profile.consolidateList;
    const list = values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');
    const esc = (s: string) => s.replace(/'/g, "''");
    if (subdivide && ruleFilter.startsWith('sub:')) {
      return `${field} IN (${list}) AND ${subdivide.byField} = '${esc(ruleFilter.slice(4))}'`;
    }
    return `${field} IN (${list}) AND ${rField} = '${esc(ruleFilter)}'`;
  }, [ruleFilter, profile.consolidateList, rField]);

  // What the map actually draws: base AND tab AND legend AND spotlight.
  const mapWhere = useMemo(
    () => and(listWhere, legendWhere, ruleFilterWhere) || '1=1',
    [listWhere, legendWhere, ruleFilterWhere]
  );

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
  const exhibit = selectedAreaId ? profile.areaExhibits?.[String(selectedAreaId)] : undefined;

  // Subzones (designated areas within a lot) — drawn when the active tab opts in
  // and a lot is selected; the lot polygons swap to outline-only so the bands read.
  const showSubzones = !!activeTabDef?.showSubzones;
  const subzoneIds = useSubzoneAreaIds(profile.subzones, showSubzones);
  // Tab-gated designated-space overlays (e.g. Lot 5 CBD employee rows) get the
  // same outline-only lot treatment as the subzone bands.
  const lotHasGatedOverlay =
    selectedAreaId != null &&
    (profile.overlayLayers ?? []).some(
      (ol) =>
        ol.showForAreaId === String(selectedAreaId) &&
        (ol.showForTabIds ? ol.showForTabIds.includes(activeTab) : showSubzones)
    );
  useEffect(() => {
    setSubzoneMode((showSubzones || lotHasGatedOverlay) && selectedAreaId != null);
  }, [showSubzones, lotHasGatedOverlay, selectedAreaId, setSubzoneMode]);
  const lotHasSubzones =
    showSubzones && selectedAreaId != null && !!subzoneIds?.includes(String(selectedAreaId));
  const subzoneNote = selectedAreaId
    ? (activeTabDef?.lotSubzoneNotes?.[String(selectedAreaId)] ??
        (lotHasSubzones ? profile.subzones?.note : undefined))
    : undefined;
  const cardNote = selectedAreaId
    ? (activeTabDef?.lotNotes?.[String(selectedAreaId)] ?? activeTabDef?.note)
    : activeTabDef?.note;

  const walkRoute = useWalkRoute(mapView, walkMode);
  const walkEnabled = !!profile.enableWalkTime;

  const handleTabClick = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      setLegendFilter(null);
      setRuleFilter(null);
      // Switching views resets any lot selection so the full list is shown.
      lot.clear();
    },
    [lot]
  );

  // Zoom to the current audience's lots whenever the (non-legend) filter changes.
  const zoomToAll = useCallback(() => {
    if (!mapView || !featureLayer || listWhere === '1=0') return () => {};
    let cancelled = false;
    featureLayer
      .queryExtent({ where: listWhere })
      .then((result) => {
        if (!cancelled && result.extent) {
          mapView.goTo(result.extent.expand(1.1), { duration: 600 }).catch(() => {});
        }
      })
      .catch(() => {
        /* keep current view */
      });
    return () => {
      cancelled = true;
    };
  }, [listWhere, mapView, featureLayer]);

  useEffect(() => zoomToAll(), [zoomToAll]);

  // Back to all locations: drop the selection and return the map to the full view.
  const handleClearSelection = useCallback(() => {
    lot.clear();
    zoomToAll();
  }, [lot, zoomToAll]);

  const handleFeatureClick = useCallback(
    (graphic: Parameters<typeof lot.selectByClick>[0]) => {
      lot.selectByClick(graphic);
      setDetailOpen(true);
    },
    [lot]
  );

  const handleSelectIndex = useCallback(
    (index: number) => {
      // Selecting a lot ends any on-street spotlight so the lot is visible on the map.
      setRuleFilter(null);
      lot.selectByIndex(index);
      setDetailOpen(true);
    },
    [lot]
  );

  const handleFilterToggle = useCallback(
    (value: string) => {
      const newFilter = legendFilter === value ? null : value;
      setLegendFilter(newFilter);
      setRuleFilter(null);
      setLegendOpen(false);

      // Clear selection if it no longer matches the filter; "Show All" (toggle
      // off) resets the selection too so the full list comes back.
      if (newFilter === null) {
        lot.clear();
      } else if (lot.selectedFeature) {
        const sel = lot.selectedFeature.attributes[rField] ?? '';
        const known = profile.symbology.filter((s) => s.value !== '_default').map((s) => s.value);
        const matches = newFilter === '_default' ? !known.includes(sel) : sel === newFilter;
        if (!matches) lot.clear();
      }
    },
    [legendFilter, profile.symbology, rField, lot]
  );

  const handleRuleFilterToggle = useCallback(
    (value: string) => {
      const next = ruleFilter === value ? null : value;
      setRuleFilter(next);
      // Lots are hidden while spotlighting on-street spaces, so drop any selection.
      if (next !== null && lot.selectedFeature) lot.clear();
    },
    [ruleFilter, lot]
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
          onClose={() => setLegendOpen(false)}
          onGoToTab={handleTabClick}
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
            onHomeReset={zoomToAll}
            onBasemapChange={setBasemapMode}
            subzonesEnabled={showSubzones}
            selectedAreaId={selectedAreaId}
            selectedHasSubzones={lotHasSubzones}
            activeTabId={activeTab}
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
          {/* Desktop-only legend at the top of the right rail; mobile keeps the drawer copy. */}
          <Legend
            className="detail-rail-legend"
            title={profile.legendTitle}
            symbology={profile.symbology}
            presentValues={presentValues}
            activeFilter={legendFilter}
            onFilterToggle={handleFilterToggle}
          />
          <DetailPanel
            allFeatures={lot.allFeatures}
            selectedFeature={lot.selectedFeature}
            currentIndex={lot.currentIndex}
            fields={profile.fields.display}
            symbology={profile.symbology}
            layerFields={layerFields}
            rules={rules}
            ruleConfig={profile.relatedRules}
            ruleSymbology={profile.ruleSymbology}
            exhibit={exhibit}
            welcome={profile.welcome}
            legendFilter={legendFilter}
            areaInfo={profile.areaInfo}
            cardNote={cardNote}
            subzoneNote={subzoneNote}
            showDirections={profile.showDirections}
            consolidateList={profile.consolidateList}
            ruleFilter={ruleFilter}
            onRuleFilterToggle={handleRuleFilterToggle}
            onSelectIndex={handleSelectIndex}
            onClearSelection={handleClearSelection}
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
