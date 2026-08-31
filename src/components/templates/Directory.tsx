import { useEffect, useMemo, useState } from 'react';
import type MapView from '@arcgis/core/views/MapView.js';
import type Graphic from '@arcgis/core/Graphic.js';
import type { LayerFields, ParkingProfile } from '../../config/types';
import { useParkingLayer } from '../../hooks/useParkingLayer';
import { useSelectedLot } from '../../hooks/useSelectedLot';
import { useAllRules } from '../../hooks/useAllRules';
import { ruleAudience, type Audience } from '../../config/audience';
import { areaDisplayName } from '../../config/lots';
import { MapPanel } from '../MapPanel';
import { LotDetailCard } from '../LotDetailCard';

const AUD_LABEL: Partial<Record<Audience, string>> = {
  RESIDENT: 'Residents',
  COMMUTER: 'Commuter',
  STUDENT: 'LTHS Students',
  EMPLOYEE: 'Employees',
  VISITOR: 'Visitor',
};
const AUD_ORDER: Audience[] = ['RESIDENT', 'COMMUTER', 'STUDENT', 'EMPLOYEE', 'VISITOR'];

export function Directory({ profile, onHome }: { profile: ParkingProfile; onHome?: () => void }) {
  const { layer, setDefinitionExpression, setBasemapMode } = useParkingLayer(profile);
  const base = profile.layer.baseWhere ?? '1=1';
  const lot = useSelectedLot(layer, base, profile.layer.nameField);
  const rulesByArea = useAllRules(profile.relatedRules);
  const [mapView, setMapView] = useState<MapView | null>(null);
  const [search, setSearch] = useState('');
  const [chip, setChip] = useState('all');

  const idField = profile.layer.idField ?? 'AREAID';
  const nameField = profile.layer.nameField;
  const facilityField = profile.layer.rendererField;

  useEffect(() => {
    if (layer) setDefinitionExpression(base);
  }, [layer, base, setDefinitionExpression]);

  useEffect(() => {
    if (!mapView || !layer) return;
    let cancelled = false;
    layer
      .queryExtent({ where: base })
      .then((r) => {
        if (!cancelled && r.extent) mapView.goTo(r.extent.expand(1.2), { duration: 500 }).catch(() => {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mapView, layer, base]);

  // audience set per area, from its rules
  const areaAud = useMemo(() => {
    const m = new Map<string, Set<Audience>>();
    rulesByArea.forEach((rules, aid) => {
      const s = new Set<Audience>();
      for (const r of rules) {
        s.add(ruleAudience(r.RULETYPE as string, r.PERMITZONE as string, r.USERCLASS as string));
      }
      m.set(aid, s);
    });
    return m;
  }, [rulesByArea]);

  const chips = useMemo(
    () =>
      profile.tabs
        .filter((t) => t.id !== 'walk-time' && t.audience?.length)
        .map((t) => ({ id: t.id, label: t.label, aud: new Set(t.audience as string[]) })),
    [profile.tabs]
  );

  const cards = useMemo(() => {
    let items = lot.allFeatures.map((f, i) => ({ f, i }));
    if (chip !== 'all') {
      const c = chips.find((x) => x.id === chip);
      if (c) {
        items = items.filter(({ f }) => {
          const a = areaAud.get(String(f.attributes[idField]));
          return a && [...c.aud].some((x) => a.has(x as Audience));
        });
      }
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(({ f }) =>
        areaDisplayName(f.attributes, nameField, idField, profile.nameOverrides)
          .toLowerCase()
          .includes(q)
      );
    }
    return items;
  }, [lot.allFeatures, chip, chips, areaAud, idField, search, nameField, profile.nameOverrides]);

  const layerFields: LayerFields = {
    nameField,
    rendererField: facilityField,
    idField: profile.layer.idField,
    spacesField: profile.layer.spacesField,
    nameOverrides: profile.nameOverrides,
  };
  const selectedAreaId = lot.selectedFeature?.attributes?.[idField];
  const selectedRules = selectedAreaId ? rulesByArea.get(String(selectedAreaId)) ?? [] : [];
  const selectedExhibit = selectedAreaId
    ? profile.areaExhibits?.[String(selectedAreaId)]
    : undefined;
  const nameOf = (attrs: Record<string, unknown>) =>
    areaDisplayName(attrs, nameField, idField, profile.nameOverrides);

  const badgesFor = (g: Graphic) => {
    const a = areaAud.get(String(g.attributes[idField]));
    if (!a) return [];
    return AUD_ORDER.filter((x) => a.has(x) && AUD_LABEL[x]);
  };

  return (
    <div className="directory">
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
            <span className="tpl-crumb"> · Parking Directory</span>
          </span>
        </div>
      </header>

      <div className="dir-controls">
        <input
          className="dir-search"
          type="text"
          placeholder="Search parking areas…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {chips.length > 0 && (
          <div className="dir-chips">
            <button
              className={`dir-chip ${chip === 'all' ? 'dir-chip-active' : ''}`}
              onClick={() => setChip('all')}
            >
              All
            </button>
            {chips.map((c) => (
              <button
                key={c.id}
                className={`dir-chip ${chip === c.id ? 'dir-chip-active' : ''}`}
                onClick={() => setChip(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="dir-body">
        <div className="dir-cards">
          <div className="dir-count">
            {cards.length} parking area{cards.length === 1 ? '' : 's'}
          </div>
          {cards.map(({ f, i }) => {
            const selected = i === lot.currentIndex;
            return (
              <button
                key={f.attributes.OBJECTID}
                className={`dir-card ${selected ? 'dir-card-active' : ''}`}
                onClick={() => lot.selectByIndex(i)}
              >
                <div className="dir-card-top">
                  <span className="dir-card-name">{nameOf(f.attributes)}</span>
                  <span className="dir-card-facility">{String(f.attributes[facilityField] ?? '')}</span>
                </div>
                <div className="dir-card-badges">
                  {badgesFor(f).map((a) => (
                    <span key={a} className={`dir-badge dir-badge-${a.toLowerCase()}`}>
                      {AUD_LABEL[a]}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
          {cards.length === 0 && <p className="dir-empty">No parking areas match.</p>}
        </div>

        <div className="dir-detail">
          <div className="dir-map">
            <MapPanel
              profile={profile}
              featureLayer={layer}
              selectedFeature={lot.selectedFeature}
              onFeatureClick={(g: Graphic) => lot.selectByClick(g)}
              onViewReady={setMapView}
              onBasemapChange={setBasemapMode}
            />
          </div>
          <div className="dir-detail-panel">
            {lot.selectedFeature ? (
              <LotDetailCard
                feature={lot.selectedFeature}
                fields={profile.fields.display}
                symbology={profile.symbology}
                layerFields={layerFields}
                rules={selectedRules}
                ruleConfig={profile.relatedRules}
                ruleSymbology={profile.ruleSymbology}
                exhibit={selectedExhibit}
              />
            ) : (
              <p className="dir-hint">Select a parking area to see who can park there and the rules.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
