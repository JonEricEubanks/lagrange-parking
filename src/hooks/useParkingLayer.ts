import { useCallback, useEffect, useRef, useState } from 'react';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js';
import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer.js';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol.js';
import type { EffectScaleStop } from '@arcgis/core/layers/support/FeatureEffect.js';
import type { ParkingProfile } from '../config/types';

export interface ParkingLayerResult {
  layer: FeatureLayer | null;
  setDefinitionExpression: (expr: string) => void;
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

    const newLayer = new FeatureLayer({
      url: profile.layer.url,
      outFields: ['*'],
      renderer,
      opacity: profile.layer.opacity,
      popupEnabled: false,
      effect: featureEffect,
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

  return { layer, setDefinitionExpression };
}
