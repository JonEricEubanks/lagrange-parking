import { useCallback, useEffect, useRef, useState } from 'react';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js';
import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer.js';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol.js';
import TextSymbol from '@arcgis/core/symbols/TextSymbol.js';
import LabelClass from '@arcgis/core/layers/support/LabelClass.js';
import type { EffectScaleStop } from '@arcgis/core/layers/support/FeatureEffect.js';
import type { ParkingProfile } from '../config/types';

export interface ParkingLayerResult {
  layer: FeatureLayer | null;
  setDefinitionExpression: (expr: string) => void;
  /**
   * Adapt the polygons to the active basemap. Over an aerial they have to be
   * see-through (that is the whole point of the aerial) and their labels
   * light-on-dark, or neither the imagery nor the labels read.
   */
  setBasemapMode: (aerial: boolean) => void;
}

export function useParkingLayer(profile: ParkingProfile | null): ParkingLayerResult {
  const [layer, setLayer] = useState<FeatureLayer | null>(null);
  const layerRef = useRef<FeatureLayer | null>(null);

  useEffect(() => {
    if (!profile) return;

    const outlineColor = profile.layer.outlineColor;
    const outlineWidth = profile.layer.outlineWidth;

    const makeSymbol = (color: [number, number, number, number]) =>
      new SimpleFillSymbol({
        color: [color[0], color[1], color[2], color[3] * 255],
        outline: {
          color: [outlineColor[0], outlineColor[1], outlineColor[2], outlineColor[3] * 255],
          width: outlineWidth,
        },
      });

    const categories = profile.symbology.filter((s) => s.value !== '_default');
    const defaultEntry = profile.symbology.find((s) => s.value === '_default');

    const renderer = new UniqueValueRenderer({
      field: profile.layer.rendererField,
      uniqueValueInfos: categories.map((s) => ({
        value: s.value,
        label: s.label,
        symbol: makeSymbol(s.color),
      })),
      defaultSymbol: defaultEntry ? makeSymbol(defaultEntry.color) : undefined,
      defaultLabel: defaultEntry?.label ?? 'Other',
    });

    // Build scale-dependent effects
    const featureEffect: EffectScaleStop[] = profile.effects.map((e) => ({
      scale: e.scale,
      value: e.value,
    }));

    // Label each parking area with its name (e.g. "Lot 11") so the map reads on
    // its own. White halo keeps it legible over the light-canvas basemap.
    // nameOverrides let the Village relabel an area without a hosted-data edit
    // (e.g. "Village Hall Parking Structure" → "VH Garage").
    const overrides = Object.entries(profile.nameOverrides ?? {});
    const idField = profile.layer.idField;
    const nameExpression =
      overrides.length && idField
        ? `When(${overrides
            .map(([id, name]) => `$feature.${idField} == '${id}', '${name.replace(/'/g, "\\'")}'`)
            .join(', ')}, $feature.${profile.layer.nameField})`
        : `$feature.${profile.layer.nameField}`;

    const labelClass = new LabelClass({
      labelExpressionInfo: { expression: nameExpression },
      labelPlacement: 'always-horizontal',
      deconflictionStrategy: 'static',
      // Map labels render from Esri's hosted font service — web fonts (Nunito
      // Sans) 404 there, so use Arial Bold (confirmed hosted) for a strong,
      // legible lot label over the light-canvas basemap.
      symbol: new TextSymbol({
        color: [0, 48, 108, 1],
        haloColor: [255, 255, 255, 0.95],
        haloSize: 1.8,
        font: { size: 11, family: 'Arial', weight: 'bold' },
      }),
    });

    const newLayer = new FeatureLayer({
      url: profile.layer.url,
      outFields: ['*'],
      renderer,
      opacity: profile.layer.opacity,
      popupEnabled: false,
      effect: featureEffect,
      labelingInfo: [labelClass],
      labelsVisible: true,
      // Apply the experience-wide filter (e.g. USERCLASS = 'PERMIT') up front so
      // the layer never flashes the full inventory before the tab filter lands.
      definitionExpression: profile.layer.baseWhere || undefined,
    });

    layerRef.current = newLayer;
    setLayer(newLayer);

    return () => {
      layerRef.current = null;
      setLayer(null);
    };
  }, [profile]);

  const setDefinitionExpression = useCallback(
    (expr: string) => {
      if (layerRef.current) {
        layerRef.current.definitionExpression = expr;
      }
    },
    []
  );

  const setBasemapMode = useCallback(
    (aerial: boolean) => {
      const target = layerRef.current;
      if (!target || !profile) return;

      target.opacity = aerial
        ? profile.layer.imageryOpacity ?? profile.layer.opacity
        : profile.layer.opacity;

      const existing = target.labelingInfo?.[0];
      if (existing) {
        const relabelled = existing.clone();
        relabelled.symbol = new TextSymbol({
          color: aerial ? [255, 255, 255, 1] : [0, 48, 108, 1],
          haloColor: aerial ? [0, 0, 0, 0.85] : [255, 255, 255, 0.95],
          haloSize: aerial ? 2 : 1.8,
          font: { size: 11, family: 'Arial', weight: 'bold' },
        });
        target.labelingInfo = [relabelled];
      }
    },
    [profile]
  );

  return { layer, setDefinitionExpression, setBasemapMode };
}
