import { useEffect, useRef, useState } from 'react';
import Map from '@arcgis/core/Map.js';
import MapView from '@arcgis/core/views/MapView.js';
import TileLayer from '@arcgis/core/layers/TileLayer.js';
import MapImageLayer from '@arcgis/core/layers/MapImageLayer.js';
import FeatureLayerModule from '@arcgis/core/layers/FeatureLayer.js';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol.js';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer.js';
import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer.js';
import TextSymbol from '@arcgis/core/symbols/TextSymbol.js';
import LabelClass from '@arcgis/core/layers/support/LabelClass.js';
import Home from '@arcgis/core/widgets/Home.js';
import Locate from '@arcgis/core/widgets/Locate.js';
import type Point from '@arcgis/core/geometry/Point.js';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer.js';
import type FeatureLayerView from '@arcgis/core/views/layers/FeatureLayerView.js';
import type Graphic from '@arcgis/core/Graphic.js';
import type { ResourceHandle } from '@arcgis/core/core/Handles.js';
import type { ParkingProfile } from '../config/types';

interface MapPanelProps {
  profile: ParkingProfile;
  featureLayer: FeatureLayer | null;
  selectedFeature: Graphic | null;
  onFeatureClick: (graphic: Graphic) => void;
  walkTimeMode?: boolean;
  onMapClick?: (mapPoint: Point) => void;
  onViewReady?: (view: MapView) => void;
  /** Overrides the map Home button — e.g. zoom to the current audience's lots. */
  onHomeReset?: () => void;
  overlayVisibility?: Record<string, boolean>;
  /** Reports the active basemap so the parking layer's owner can restyle it. */
  onBasemapChange?: (aerial: boolean) => void;
  /** Draw `profile.subzones` on this page (set per audience tab). */
  subzonesEnabled?: boolean;
  /** Area id of the selected lot — the subzone layer filters to it. */
  selectedAreaId?: string | number | null;
  /** Whether that lot actually has designated areas drawn. */
  selectedHasSubzones?: boolean;
  /** Id of the active audience tab — gates overlays with `showForTabIds`. */
  activeTabId?: string;
}

export function MapPanel({
  profile,
  featureLayer,
  selectedFeature,
  onFeatureClick,
  walkTimeMode = false,
  onMapClick,
  onViewReady,
  onHomeReset,
  overlayVisibility,
  onBasemapChange,
  subzonesEnabled = false,
  selectedAreaId = null,
  selectedHasSubzones = false,
  activeTabId,
}: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapView | null>(null);
  const highlightRef = useRef<ResourceHandle | null>(null);
  const layerViewRef = useRef<FeatureLayerView | null>(null);
  const overlayLayersRef = useRef(new globalThis.Map<string, FeatureLayer>());

  // Basemap choice. An aerial helps people orient themselves ("is that my
  // building?"), so the parking polygons go semi-transparent over it and the
  // Important Places fills step aside — otherwise they fight the imagery.
  const imageryUrl = profile.basemap.imageryUrl;
  const startAerial = !!imageryUrl && profile.basemap.default === 'imagery';
  const [aerial, setAerial] = useState(startAerial);
  const canvasTileRef = useRef<TileLayer | null>(null);
  const imageryTileRef = useRef<TileLayer | null>(null);
  const referenceLayersRef = useRef<FeatureLayer[]>([]);
  const subzoneLayerRef = useRef<FeatureLayer | null>(null);
  const gatedOverlaysRef = useRef<{ layer: FeatureLayer; areaId: string; tabIds?: string[] }[]>([]);

  // Refs to avoid stale closures in the click handler
  const walkTimeModeRef = useRef(walkTimeMode);
  const onMapClickRef = useRef(onMapClick);
  const onFeatureClickRef = useRef(onFeatureClick);
  const onHomeResetRef = useRef(onHomeReset);

  walkTimeModeRef.current = walkTimeMode;
  onMapClickRef.current = onMapClick;
  onFeatureClickRef.current = onFeatureClick;
  onHomeResetRef.current = onHomeReset;

  // Set cursor on the ArcGIS view surface — never toggle classes on the container div itself
  useEffect(() => {
    const surface = containerRef.current?.querySelector<HTMLElement>('.esri-view-surface');
    if (surface) {
      surface.style.cursor = walkTimeMode ? 'crosshair' : '';
    }
  }, [walkTimeMode]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || !featureLayer) return;

    // GISC Light Canvas tiled basemap (needs the ArcGIS API key in .env) + the
    // dynamic GISC layer for street-name labels / important places on top.
    // The GISC aerial shares the same tiling scheme, so it drops straight in as
    // an alternate basemap — only one of the two is ever visible.
    const basemapTile = new TileLayer({
      url: profile.basemap.tileUrl,
      visible: !startAerial,
    });
    const imageryTile = imageryUrl
      ? new TileLayer({ url: imageryUrl, visible: startAerial })
      : null;
    canvasTileRef.current = basemapTile;
    imageryTileRef.current = imageryTile;

    const dynamicLayer = new MapImageLayer({
      url: profile.basemap.dynamicUrl,
      // Only include minScale/maxScale when set — passing `undefined` breaks
      // Esri's scale-visibility check and culls every sublayer (blank dynamic layer).
      sublayers: profile.basemap.sublayers.map((s) => ({
        id: s.id,
        title: s.title,
        visible: s.visible,
        ...(s.mapLayerId != null
          ? { source: { type: 'map-layer' as const, mapLayerId: s.mapLayerId } }
          : {}),
        ...(s.definitionExpression ? { definitionExpression: s.definitionExpression } : {}),
        ...(s.minScale != null ? { minScale: s.minScale } : {}),
        ...(s.maxScale != null ? { maxScale: s.maxScale } : {}),
      })),
    });

    // Build overlay layers (e.g., CBD boundary)
    const overlayMap = new globalThis.Map<string, FeatureLayer>();
    const overlaysAbove: FeatureLayer[] = [];
    const overlays = (profile.overlayLayers ?? []).flatMap((ol) => {
      const fillColor = ol.fillColor ?? [0, 0, 0, 0];
      const layer = new FeatureLayerModule({
        url: ol.url,
        title: ol.title,
        renderer: new SimpleRenderer({
          // Alpha is 0–1, same as the subzone layer — do not scale it.
          symbol: new SimpleFillSymbol({
            color: [fillColor[0], fillColor[1], fillColor[2], fillColor[3]],
            outline: {
              color: [ol.color[0], ol.color[1], ol.color[2], ol.color[3]],
              width: ol.outlineWidth,
            },
          }),
        }),
        popupEnabled: false,
        ...(ol.where ? { definitionExpression: ol.where } : {}),
        ...(ol.minScale != null ? { minScale: ol.minScale } : {}),
        ...(ol.showForAreaId ? { visible: false } : {}),
      });
      if (ol.showForAreaId) {
        gatedOverlaysRef.current.push({ layer, areaId: ol.showForAreaId, tabIds: ol.showForTabIds });
      } else {
        overlayMap.set(ol.url, layer);
      }
      if (ol.abovePolygons) {
        overlaysAbove.push(layer);
        return [];
      }
      return [layer];
    });
    overlayLayersRef.current = overlayMap;

    // Reference layers (e.g. Important Places — parks, civic buildings, Metra).
    // Categorized fill + name labels, drawn under the parking polygons. Loaded
    // from the public hosted feature layer so they show at every scale.
    const rgba = (c: [number, number, number, number]) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3]})`;
    const referenceLayers = (profile.referenceLayers ?? []).map((rl) => {
      const renderer = new UniqueValueRenderer({
        field: rl.categoryField,
        uniqueValueInfos: rl.categories.map((c) => ({
          value: c.value,
          symbol: new SimpleFillSymbol({
            color: rgba(c.fill),
            outline: { color: rgba(c.outline), width: 1 },
          }),
        })),
      });

      // Place-name labels are context, not content: keep them small, shorten the
      // long ones and only draw them once zoomed in, so they stop sprawling far
      // outside the polygon they belong to.
      const max = rl.labelMaxLength;
      const nameExpr = max
        ? `IIf(Count($feature.${rl.labelField}) > ${max}, Left($feature.${rl.labelField}, ${max - 1}) + '…', $feature.${rl.labelField})`
        : `$feature.${rl.labelField}`;

      const labelingInfo = rl.labelField
        ? [
            new LabelClass({
              labelExpressionInfo: { expression: nameExpr },
              ...(rl.labelMinScale != null ? { minScale: rl.labelMinScale } : {}),
              symbol: new TextSymbol({
                color: rgba(rl.labelColor ?? [90, 90, 90, 1]),
                haloColor: rgba(rl.labelHaloColor ?? [255, 255, 255, 0.8]),
                haloSize: 1,
                font: {
                  size: rl.labelSize ?? 9,
                  family: 'Arial',
                  style: rl.labelItalic ? 'italic' : 'normal',
                },
              }),
            }),
          ]
        : undefined;

      return new FeatureLayerModule({
        url: rl.url,
        title: rl.title,
        opacity: rl.opacity ?? 1,
        renderer,
        labelingInfo,
        labelsVisible: !!rl.labelField,
        popupEnabled: false,
        minScale: rl.minScale ?? 0,
        // Over imagery these fills/labels are noise — the aerial already shows
        // the parks and civic buildings they stand in for.
        visible: !startAerial,
      });
    });
    referenceLayersRef.current = referenceLayers;

    // Designated sub-lot areas. Created once and kept hidden; the effect below
    // filters it to the selected lot and shows it. `minScale` keeps the bands
    // off the map when zoomed out over the whole downtown, where they'd be
    // illegible clutter rather than guidance.
    const sz = profile.subzones;
    const subzoneLayer = sz
      ? new FeatureLayerModule({
          url: sz.url,
          title: sz.title ?? 'Designated spaces',
          popupEnabled: false,
          visible: false,
          minScale: sz.minScale ?? 0,
          renderer: new SimpleRenderer({
            symbol: new SimpleFillSymbol({
              color: [sz.fill[0], sz.fill[1], sz.fill[2], sz.fill[3]],
              outline: { color: [sz.outline[0], sz.outline[1], sz.outline[2], sz.outline[3]], width: sz.outlineWidth ?? 1.5 },
            }),
          }),
        })
      : null;
    subzoneLayerRef.current = subzoneLayer;

    const map = new Map({
      layers: [
        basemapTile,
        ...(imageryTile ? [imageryTile] : []),
        dynamicLayer,
        ...overlays,
        ...referenceLayers,
        featureLayer,
        // Above the parking polygons — they mark parts of one.
        ...overlaysAbove,
        ...(subzoneLayer ? [subzoneLayer] : []),
      ],
    });

    const ext = profile.extent;
    const view = new MapView({
      container: containerRef.current,
      map,
      extent: {
        xmin: ext.xmin,
        ymin: ext.ymin,
        xmax: ext.xmax,
        ymax: ext.ymax,
        spatialReference: ext.spatialReference,
      },
      popupEnabled: false,
    });



    const home = new Home({ view });
    // Home should return to the app's current fitted view (the visible lots),
    // not the load-time profile extent, which goes stale as tabs/filters change.
    home.goToOverride = (v, params) => {
      if (onHomeResetRef.current) {
        onHomeResetRef.current();
        return Promise.resolve();
      }
      return v.goTo(params.target, params.options);
    };
    view.ui.add(home, 'top-left');

    // "Locate me" — geolocates the visitor and zooms to their spot. Sits with the
    // zoom/home buttons. (Geolocation needs a secure context: https or localhost.)
    const locate = new Locate({ view });
    view.ui.add(locate, 'top-left');

    // Click handler — uses refs so it always sees current mode/callbacks
    view.on('click', async (event) => {
      if (walkTimeModeRef.current && onMapClickRef.current) {
        onMapClickRef.current(event.mapPoint);
        return;
      }

      const resp = await view.hitTest(event, { include: [featureLayer] });
      const hit = resp.results.find(
        (r) => r.type === 'graphic' && r.graphic.layer === featureLayer
      );
      if (hit && hit.type === 'graphic') {
        onFeatureClickRef.current(hit.graphic);
      }
    });

    // Get layer view for highlighting
    view
      .whenLayerView(featureLayer)
      .then((lv) => {
        layerViewRef.current = lv as FeatureLayerView;
      })
      .catch(() => {
        /* layer view not ready (e.g. view destroyed) — ignore */
      });

    viewRef.current = view;
    onViewReady?.(view);

    return () => {
      // view.destroy() destroys view.map, which destroys *all* its layers. The
      // basemap/overlay layers are rebuilt on every mount so that's fine, but the
      // parking featureLayer is shared (owned by useParkingLayer) and reused across
      // remounts — detach it first so it survives. Otherwise the next mount gets a
      // destroyed layer and the SDK fails with "Failed to create layerview".
      map.remove(featureLayer);
      view.destroy();
      viewRef.current = null;
      layerViewRef.current = null;
      canvasTileRef.current = null;
      imageryTileRef.current = null;
      referenceLayersRef.current = [];
      gatedOverlaysRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureLayer]);

  // Swap basemaps, and tell the parking layer's owner to restyle for it.
  useEffect(() => {
    if (canvasTileRef.current) canvasTileRef.current.visible = !aerial;
    if (imageryTileRef.current) imageryTileRef.current.visible = aerial;
    referenceLayersRef.current.forEach((l) => {
      l.visible = !aerial;
    });
    onBasemapChange?.(aerial);
  }, [aerial, featureLayer, onBasemapChange]);

  // Sync overlay layer visibility
  useEffect(() => {
    if (!overlayVisibility) return;
    overlayLayersRef.current.forEach((olLayer: FeatureLayer, url: string) => {
      olLayer.visible = overlayVisibility[url] ?? true;
    });
  }, [overlayVisibility]);

  // Highlight selected feature + zoom
  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.remove();
      highlightRef.current = null;
    }

    if (!selectedFeature || !layerViewRef.current || !viewRef.current) return;

    // Skip the default cyan highlight when subzones or a gated overlay are shown —
    // the designated-area bands are the indicator
    const gatedOverlayShown = (profile.overlayLayers ?? []).some(
      (ol) =>
        !!ol.showForAreaId &&
        selectedAreaId != null &&
        String(selectedAreaId) === ol.showForAreaId &&
        (ol.showForTabIds
          ? !!activeTabId && ol.showForTabIds.includes(activeTabId)
          : subzonesEnabled)
    );
    if (!(subzonesEnabled && selectedHasSubzones) && !gatedOverlayShown) {
      highlightRef.current = layerViewRef.current.highlight(selectedFeature);
    }

    if (selectedFeature.geometry) {
      const view = viewRef.current;
      view.goTo({ target: selectedFeature.geometry }, { duration: 400 }).catch(() => {
        /* goTo interrupted by another navigation — ignore */
      });
    }
  }, [selectedFeature, subzonesEnabled, selectedHasSubzones, selectedAreaId, activeTabId, profile.subzones?.minScale, profile.overlayLayers]);

  // Filter the subzone layer to the selected lot. Hidden whenever the page does
  // not use subzones or nothing is selected — these are "here specifically",
  // not a layer to browse.
  useEffect(() => {
    const layer = subzoneLayerRef.current;
    if (!layer) return;
    const keyField = profile.subzones?.keyField;
    if (!subzonesEnabled || selectedAreaId == null || !keyField) {
      layer.visible = false;
      return;
    }
    const id = String(selectedAreaId).replace(/'/g, "''");
    layer.definitionExpression = `${keyField} = '${id}'`;
    layer.visible = true;
  }, [subzonesEnabled, selectedAreaId, profile.subzones?.keyField]);

  // Selection-gated overlays (e.g. Lot 5 CBD rows) show only while their lot is
  // selected — on the tabs listed in `showForTabIds`, or (when omitted) on any
  // page that uses designated spaces (like the subzone bands).
  useEffect(() => {
    gatedOverlaysRef.current.forEach((g) => {
      const tabOk = g.tabIds ? !!activeTabId && g.tabIds.includes(activeTabId) : subzonesEnabled;
      g.layer.visible = tabOk && selectedAreaId != null && String(selectedAreaId) === g.areaId;
    });
  }, [subzonesEnabled, activeTabId, selectedAreaId, featureLayer]);

  return (
    <>
      <div ref={containerRef} className="map-panel" />
      {imageryUrl && (
        <div className="basemap-toggle" role="group" aria-label="Basemap">
          <button
            type="button"
            className={`basemap-toggle-btn${aerial ? '' : ' basemap-toggle-btn--active'}`}
            aria-pressed={!aerial}
            onClick={() => setAerial(false)}
          >
            Map
          </button>
          <button
            type="button"
            className={`basemap-toggle-btn${aerial ? ' basemap-toggle-btn--active' : ''}`}
            aria-pressed={aerial}
            onClick={() => setAerial(true)}
          >
            {profile.basemap.imageryLabel ?? 'Aerial'}
          </button>
        </div>
      )}
    </>
  );
}
