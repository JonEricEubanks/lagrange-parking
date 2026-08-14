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
  /** When true, swaps lot polygons to outline-only so subzone bands read clearly. */
  setSubzoneMode: (active: boolean) => void;
}

export function useParkingLayer(profile: ParkingProfile | null): ParkingLayerResult {
  const [layer, setLayer] = useState<FeatureLayer | null>(null);
  const layerRef = useRef<FeatureLayer | null>(null);
  const rendererRef = useRef<UniqueValueRenderer | null>(null);

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

    // Map labels render from Esri's hosted font service — web fonts (Nunito
    // Sans) 404 there, so use Arial Bold (confirmed hosted) for a strong,
    // legible lot label over the light-canvas basemap.
    const makeLabelSymbol = (xoffset = 0, yoffset = 0) =>
      new TextSymbol({
        color: [0, 48, 108, 1],
        haloColor: [255, 255, 255, 0.95],
        haloSize: 1.8,
        xoffset,
        yoffset,
        font: { size: 11, family: 'Arial', weight: 'bold' },
      });

    const deconfliction = profile.layer.labelDeconfliction ?? 'none';
    const baseLabelClass = (where?: string, xoffset = 0, yoffset = 0) =>
      new LabelClass({
        labelExpressionInfo: { expression: nameExpression },
        labelPlacement: 'always-horizontal',
        deconflictionStrategy: deconfliction,
        where,
        symbol: makeLabelSymbol(xoffset, yoffset),
      });

    // Lot 2 label offset — nudges it above the adjacent Harris Ave label
    const lot2Field = idField ?? 'AREAID';
    const labelClasses = [
      baseLabelClass(`${lot2Field} = 'LOT2'`, 0, 14),
      baseLabelClass(`${lot2Field} <> 'LOT2'`),
    ];

    const newLayer = new FeatureLayer({
      url: profile.layer.url,
      outFields: ['*'],
      renderer,
      opacity: profile.layer.opacity,
      popupEnabled: false,
      effect: featureEffect,
      labelingInfo: labelClasses,
      labelsVisible: true,
      // Apply the experience-wide filter (e.g. USERCLASS = 'PERMIT') up front so
      // the layer never flashes the full inventory before the tab filter lands.
      definitionExpression: profile.layer.baseWhere || undefined,
    });

    layerRef.current = newLayer;
    rendererRef.current = renderer;
    setLayer(newLayer);

    return () => {
      layerRef.current = null;
      rendererRef.current = null;
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

      const updated = (target.labelingInfo ?? []).map((lc) => {
        const relabelled = lc.clone();
        const prev = lc.symbol as TextSymbol;
        relabelled.symbol = new TextSymbol({
          color: aerial ? [255, 255, 255, 1] : [0, 48, 108, 1],
          haloColor: aerial ? [0, 0, 0, 0.85] : [255, 255, 255, 0.95],
          haloSize: aerial ? 2 : 1.8,
          xoffset: prev?.xoffset,
          yoffset: prev?.yoffset,
          font: { size: 11, family: 'Arial', weight: 'bold' },
        });
        return relabelled;
      });
      if (updated.length) target.labelingInfo = updated;
    },
    [profile]
  );

  const setSubzoneMode = useCallback(
    (active: boolean) => {
      const target = layerRef.current;
      if (!target || !profile) return;
      if (active) {
        // Bright green outline frames the lot boundary against the aerial subzone bands
        const makeOutlineOnly = () =>
          new SimpleFillSymbol({
            color: [0, 0, 0, 0],
            outline: {
              color: [34, 193, 203, 1],
              width: 3,
            },
          });
        const categories = profile.symbology.filter((s) => s.value !== '_default');
        const defaultEntry = profile.symbology.find((s) => s.value === '_default');
        target.renderer = new UniqueValueRenderer({
          field: profile.layer.rendererField,
          uniqueValueInfos: categories.map((s) => ({
            value: s.value,
            label: s.label,
            symbol: makeOutlineOnly(),
          })),
          defaultSymbol: defaultEntry ? makeOutlineOnly() : undefined,
          defaultLabel: defaultEntry?.label ?? 'Other',
        });
      } else if (rendererRef.current) {
        target.renderer = rendererRef.current;
      }
    },
    [profile]
  );

  return { layer, setDefinitionExpression, setBasemapMode, setSubzoneMode };
}
