import { useEffect, useMemo, useState } from 'react';
import type MapView from '@arcgis/core/views/MapView.js';
import type Graphic from '@arcgis/core/Graphic.js';
import type { LayerFields, ParkingProfile, TabDef } from '../../config/types';
import { useParkingLayer } from '../../hooks/useParkingLayer';
import { useSelectedLot } from '../../hooks/useSelectedLot';
import { useAudienceAreaIds } from '../../hooks/useAudienceAreaIds';
import { useSubzoneAreaIds } from '../../hooks/useSubzoneAreaIds';
import { useRelatedRules } from '../../hooks/useRelatedRules';
import { areaDisplayName, explicitAreaWhere } from '../../config/lots';
import { MapPanel } from '../MapPanel';
import { LotDetailCard } from '../LotDetailCard';
import { PermitInfo } from '../PermitInfo';

function TopBar({
  profile,
  onHome,
  crumb,
  onChange,
  title,
}: {
  profile: ParkingProfile;
  onHome?: () => void;
  crumb?: string;
  onChange?: () => void;
  /** Overrides the community name in the header (the picker uses a longer title). */
  title?: string;
}) {
  return (
    <header className="tpl-topbar">
      <div className="tpl-topbar-left">
        {onHome && (
          <button className="header-home-btn" onClick={onHome} aria-label="All views">
            ←
          </button>
        )}
        <img
          className="tpl-topbar-logo"
          src={import.meta.env.BASE_URL + profile.branding.logo}
          alt={profile.community}
        />
        <span className="tpl-topbar-title">
          {title ?? profile.community}
          {crumb && <span className="tpl-crumb"> · {crumb}</span>}
        </span>
      </div>
      {onChange && (
        <button className="tpl-change-btn" onClick={onChange}>
          ← Go Back
        </button>
      )}
    </header>
  );
}

export function GuidedFinder({
  profile,
  onHome,
}: {
  profile: ParkingProfile;
  onHome?: () => void;
}) {
  const { layer, setDefinitionExpression, setBasemapMode } = useParkingLayer(profile);
  const tabs = useMemo(() => profile.tabs.filter((t) => t.id !== 'walk-time'), [profile.tabs]);
  const [chosen, setChosen] = useState<TabDef | null>(tabs.length === 1 ? tabs[0] : null);
  const [mapView, setMapView] = useState<MapView | null>(null);
  // Mobile only: the results panel is a bottom sheet that can collapse to give
  // the map (nearly) the full screen. Starts collapsed so the map leads; tapping
  // a lot (or the handle) expands it. Ignored by the desktop layout.
  const [sheetCollapsed, setSheetCollapsed] = useState(true);

  const idField = profile.layer.idField ?? 'AREAID';
  // Only fall back to the rules-derived lookup for tabs without an explicit list.
  const explicitWhere = explicitAreaWhere(profile, chosen);
  const audienceIds = useAudienceAreaIds(
    profile.relatedRules,
    explicitWhere ? undefined : chosen?.ruleWhere
  );

  const memberFilter = useMemo(() => {
    if (!chosen) return '1=0';
    // The Village's own lot list wins: "map should only show the following lots".
    if (explicitWhere) return explicitWhere;
    // Otherwise prefer precise rules-derived membership, falling back to the HAS*
    // flag so lots always show while the rules query loads (or if it fails).
    if (audienceIds && audienceIds.length > 0) {
      const list = audienceIds.map((v) => `'${v.replace(/'/g, "''")}'`).join(',');
      return `${idField} IN (${list})`;
    }
    return chosen.where ?? '';
  }, [chosen, explicitWhere, audienceIds, idField]);

  const listWhere = useMemo(
    () =>
      [profile.layer.baseWhere, memberFilter]
        .filter((p) => p && p.trim())
        .map((p) => `(${p})`)
        .join(' AND ') || '1=1',
    [profile.layer.baseWhere, memberFilter]
  );

  const lot = useSelectedLot(layer, listWhere, profile.layer.nameField);

  useEffect(() => {
    if (layer) setDefinitionExpression(listWhere);
  }, [layer, listWhere, setDefinitionExpression]);

  // Selecting a lot (tap on map / list) opens the sheet so its details show on mobile.
  const selectByClick = (g: Graphic) => {
    setSheetCollapsed(false);
    lot.selectByClick(g);
  };
  const selectByIndex = (i: number) => {
    setSheetCollapsed(false);
    lot.selectByIndex(i);
  };

  useEffect(() => {
    if (!mapView || !layer || listWhere === '1=0') return;
    let cancelled = false;
    layer
      .queryExtent({ where: listWhere })
      .then((r) => {
        if (!cancelled && r.extent) mapView.goTo(r.extent.expand(1.4), { duration: 600 }).catch(() => {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [listWhere, mapView, layer]);

  const layerFields: LayerFields = {
    nameField: profile.layer.nameField,
    rendererField: profile.layer.rendererField,
    idField: profile.layer.idField,
    spacesField: profile.layer.spacesField,
    nameOverrides: profile.nameOverrides,
  };
  const selectedAreaId = profile.layer.idField
    ? lot.selectedFeature?.attributes?.[profile.layer.idField]
    : undefined;
  const rules = useRelatedRules(profile.relatedRules, selectedAreaId, chosen?.ruleWhere);
  const apply = chosen?.guide?.apply ?? profile.apply;
  const exhibit = selectedAreaId ? profile.areaExhibits?.[String(selectedAreaId)] : undefined;

  // Which lots actually have designated areas drawn. Only permitted areas are
  // mapped, so "no subzones" is ambiguous — see useSubzoneAreaIds.
  const showSubzones = !!chosen?.showSubzones;
  const subzoneIds = useSubzoneAreaIds(profile.subzones, showSubzones);
  const lotHasSubzones =
    showSubzones && selectedAreaId != null && !!subzoneIds?.includes(String(selectedAreaId));
  const nameOf = (attrs: Record<string, unknown> | undefined) =>
    areaDisplayName(attrs, profile.layer.nameField, profile.layer.idField, profile.nameOverrides);

  // "Between 2 a.m. and 6 a.m. park in the designated overnight areas" is only
  // useful if you can get to that page from here.
  const goToTab = (tabId: string) => {
    const next = tabs.find((t) => t.id === tabId);
    if (!next) return;
    lot.clear();
    setSheetCollapsed(true);
    setChosen(next);
  };

  if (!chosen) {
    return (
      <div className="finder">
        <TopBar profile={profile} onHome={onHome} title={profile.picker?.brandTitle} />
        <div className="finder-picker">
          <h1 className="finder-q">{profile.picker?.heading ?? 'Who are you?'}</h1>
          <p className="finder-sub">
            {profile.picker?.sub ?? 'Pick the option that fits you to see where you can park.'}
          </p>
          {profile.picker?.image?.src ? (
            <img
              className="finder-hero"
              src={import.meta.env.BASE_URL + profile.picker.image.src}
              alt={profile.picker.image.alt ?? ''}
            />
          ) : (
            profile.picker?.image?.placeholder && (
              <div className="finder-hero finder-hero--placeholder">
                {profile.picker.image.placeholder}
              </div>
            )
          )}
          <div className={`finder-choices finder-choices--${tabs.length}`}>
            {tabs.map((t) => (
              <button key={t.id} className="finder-choice" onClick={() => setChosen(t)}>
                <span className="finder-choice-title">{t.label}</span>
                {t.guide?.who && <span className="finder-choice-desc">{t.guide.who}</span>}
                <span className="finder-choice-go">Show my parking →</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="finder finder-result">
      <TopBar
        profile={profile}
        onHome={onHome}
        crumb={chosen.label}
        onChange={tabs.length > 1 ? () => { setChosen(null); lot.clear(); } : undefined}
      />
      <div className="finder-body">
        <div className="finder-map">
          <MapPanel
            profile={profile}
            featureLayer={layer}
            selectedFeature={lot.selectedFeature}
            onFeatureClick={selectByClick}
            onViewReady={setMapView}
            onBasemapChange={setBasemapMode}
            subzonesEnabled={showSubzones}
            selectedAreaId={selectedAreaId}
            selectedHasSubzones={lotHasSubzones}
          />
        </div>
        <aside
          className={`finder-results${lot.selectedFeature ? ' finder-results--detail' : ''}${
            sheetCollapsed ? ' finder-results--collapsed' : ''
          }`}
        >
          <button
            className="sheet-handle"
            onClick={() => setSheetCollapsed((c) => !c)}
            aria-label={sheetCollapsed ? 'Expand panel' : 'Collapse panel'}
            aria-expanded={!sheetCollapsed}
          >
            <span className="sheet-handle-grip" aria-hidden="true" />
            <span className="sheet-handle-label">
              {sheetCollapsed
                ? lot.selectedFeature
                  ? nameOf(lot.selectedFeature.attributes)
                  : `${lot.totalCount} place${lot.totalCount === 1 ? '' : 's'} to park`
                : 'Hide'}
            </span>
          </button>
          <h2 className="finder-results-title">{chosen.label}</h2>
          {chosen.guide?.who && <p className="finder-results-intro">{chosen.guide.who}</p>}
          {apply && (
            <a className="guide-apply-btn" href={apply.url} target="_blank" rel="noopener noreferrer">
              {apply.label}
            </a>
          )}
          {lot.selectedFeature ? (
            <>
              <button className="finder-back" onClick={() => lot.clear()}>
                ← All {chosen.label.toLowerCase()} parking
              </button>
              <LotDetailCard
                feature={lot.selectedFeature}
                fields={profile.fields.display}
                symbology={profile.symbology}
                layerFields={layerFields}
                rules={rules}
                ruleConfig={profile.relatedRules}
                ruleSymbology={profile.ruleSymbology}
                exhibit={exhibit}
                subzoneNote={lotHasSubzones ? profile.subzones?.note : undefined}
              />
            </>
          ) : (
            <>
              <h3 className="finder-results-h">
                {lot.totalCount} place{lot.totalCount === 1 ? '' : 's'} to park
              </h3>
              <ul className="finder-list">
                {lot.allFeatures.map((f, i) => (
                  <li key={f.attributes.OBJECTID}>
                    <button className="finder-list-item" onClick={() => selectByIndex(i)}>
                      <span className="finder-list-name">{nameOf(f.attributes)}</span>
                      <span className="finder-list-go">›</span>
                    </button>
                  </li>
                ))}
              </ul>
              <PermitInfo guide={chosen.guide} onGoToTab={goToTab} />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
