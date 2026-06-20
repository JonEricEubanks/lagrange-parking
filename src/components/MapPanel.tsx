import { useEffect, useRef } from 'react';
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
  overlayVisibility?: Record<string, boolean>;
}

export function MapPanel({
  profile,
  featureLayer,
  selectedFeature,
  onFeatureClick,
  walkTimeMode = false,
  onMapClick,
  onViewReady,
  overlayVisibility,
}: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapView | null>(null);
  const highlightRef = useRef<ResourceHandle | null>(null);
  const layerViewRef = useRef<FeatureLayerView | null>(null);
  const overlayLayersRef = useRef(new globalThis.Map<string, FeatureLayer>());

  // Refs to avoid stale closures in the click handler
  const walkTimeModeRef = useRef(walkTimeMode);
  const onMapClickRef = useRef(onMapClick);
  const onFeatureClickRef = useRef(onFeatureClick);

  walkTimeModeRef.current = walkTimeMode;
  onMapClickRef.current = onMapClick;
  onFeatureClickRef.current = onFeatureClick;

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
    const basemapTile = new TileLayer({ url: profile.basemap.tileUrl });

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
    const overlays = (profile.overlayLayers ?? []).map((ol) => {
      const fillColor = ol.fillColor ?? [0, 0, 0, 0];
      const layer = new FeatureLayerModule({
        url: ol.url,
        title: ol.title,
        renderer: new SimpleRenderer({
          symbol: new SimpleFillSymbol({
            color: [fillColor[0], fillColor[1], fillColor[2], fillColor[3] * 255],
            outline: {
              color: [ol.color[0], ol.color[1], ol.color[2], ol.color[3] * 255],
              width: ol.outlineWidth,
            },
          }),
        }),
        popupEnabled: false,
      });
      overlayMap.set(ol.url, layer);
      return layer;
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

      const labelingInfo = rl.labelField
        ? [
            new LabelClass({
              labelExpressionInfo: { expression: `$feature.${rl.labelField}` },
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
      });
    });

    const map = new Map({
      layers: [basemapTile, dynamicLayer, ...overlays, ...referenceLayers, featureLayer],
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
    view.ui.add(home, 'top-left');

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
      view.destroy();
      viewRef.current = null;
      layerViewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureLayer]);

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

    highlightRef.current = layerViewRef.current.highlight(selectedFeature);

    if (selectedFeature.geometry) {
      viewRef.current
        .goTo({ target: selectedFeature.geometry, zoom: viewRef.current.zoom }, { duration: 400 })
        .catch(() => {
          /* goTo interrupted by another navigation — ignore */
        });
    }
  }, [selectedFeature]);

  return <div ref={containerRef} className="map-panel" />;
}
