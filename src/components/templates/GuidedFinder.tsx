import { useEffect, useMemo, useState } from 'react';
import type MapView from '@arcgis/core/views/MapView.js';
import type Graphic from '@arcgis/core/Graphic.js';
import type { LayerFields, ParkingProfile, TabDef } from '../../config/types';
import { useParkingLayer } from '../../hooks/useParkingLayer';
import { useSelectedLot } from '../../hooks/useSelectedLot';
import { useAudienceAreaIds } from '../../hooks/useAudienceAreaIds';
import { useRelatedRules } from '../../hooks/useRelatedRules';
import { MapPanel } from '../MapPanel';
import { LotDetailCard } from '../LotDetailCard';

function TopBar({
  profile,
  onHome,
  crumb,
  onChange,
}: {
  profile: ParkingProfile;
  onHome?: () => void;
  crumb?: string;
  onChange?: () => void;
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
          {profile.community}
          {crumb && <span className="tpl-crumb"> · {crumb}</span>}
        </span>
      </div>
      {onChange && (
        <button className="tpl-change-btn" onClick={onChange}>
          Change
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
  const { layer, setDefinitionExpression } = useParkingLayer(profile);
  const tabs = useMemo(() => profile.tabs.filter((t) => t.id !== 'walk-time'), [profile.tabs]);
  const [chosen, setChosen] = useState<TabDef | null>(tabs.length === 1 ? tabs[0] : null);
  const [mapView, setMapView] = useState<MapView | null>(null);

  const idField = profile.layer.idField ?? 'AREAID';
  const audienceIds = useAudienceAreaIds(profile.relatedRules, chosen?.ruleWhere);

  const memberFilter = useMemo(() => {
    if (!chosen) return '1=0';
    // Prefer precise rules-derived membership; fall back to the HAS* flag so lots
    // always show while the rules query loads (or if it fails).
    if (audienceIds && audienceIds.length > 0) {
      const list = audienceIds.map((v) => `'${v.replace(/'/g, "''")}'`).join(',');
      return `${idField} IN (${list})`;
    }
    return chosen.where ?? '';
  }, [chosen, audienceIds, idField]);

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
  };
  const selectedAreaId = profile.layer.idField
    ? lot.selectedFeature?.attributes?.[profile.layer.idField]
    : undefined;
  const rules = useRelatedRules(profile.relatedRules, selectedAreaId, chosen?.ruleWhere);
  const apply = chosen?.guide?.apply ?? profile.apply;

  if (!chosen) {
    return (
      <div className="finder">
        <TopBar profile={profile} onHome={onHome} />
        <div className="finder-picker">
          <h1 className="finder-q">Who are you?</h1>
          <p className="finder-sub">Pick the option that fits you to see where you can park.</p>
          <div className="finder-choices">
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
            onFeatureClick={(g: Graphic) => lot.selectByClick(g)}
            onViewReady={setMapView}
          />
        </div>
        <aside className="finder-results">
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
                    <button className="finder-list-item" onClick={() => lot.selectByIndex(i)}>
                      <span className="finder-list-name">
                        {String(f.attributes[profile.layer.nameField] ?? 'Parking area')}
                      </span>
                      <span className="finder-list-go">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
