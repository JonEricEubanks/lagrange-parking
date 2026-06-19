import { useCallback, useEffect, useState } from 'react';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer.js';
import type Graphic from '@arcgis/core/Graphic.js';

export interface SelectedLotState {
  allFeatures: Graphic[];
  selectedFeature: Graphic | null;
  currentIndex: number;
  totalCount: number;
  selectByClick: (graphic: Graphic) => void;
  selectByIndex: (index: number) => void;
  prev: () => void;
  next: () => void;
  clear: () => void;
}

/**
 * Loads the features that make up the current list/feature set. Re-queries
 * whenever `where` changes (e.g. switching audience tabs) so the list always
 * matches what is drawn on the map. Selection resets on a where change.
 */
export function useSelectedLot(
  layer: FeatureLayer | null,
  where: string,
  nameField?: string
): SelectedLotState {
  const [allFeatures, setAllFeatures] = useState<Graphic[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  useEffect(() => {
    if (!layer) return;
    let cancelled = false;

    layer.when(() => {
      const query = layer.createQuery();
      query.where = where && where.trim() ? where : '1=1';
      query.outFields = ['*'];
      query.returnGeometry = true;
      if (nameField) query.orderByFields = [`${nameField} ASC`];

      layer
        .queryFeatures(query)
        .then((result) => {
          if (!cancelled) {
            setAllFeatures(result.features);
            setCurrentIndex(-1);
          }
        })
        .catch(() => {
          // ignore — keep the previous list if the query fails
        });
    });

    return () => {
      cancelled = true;
    };
  }, [layer, where, nameField]);

  const selectByClick = useCallback(
    (graphic: Graphic) => {
      const oid = graphic.attributes.OBJECTID;
      const idx = allFeatures.findIndex((f) => f.attributes.OBJECTID === oid);
      setCurrentIndex(idx >= 0 ? idx : 0);
    },
    [allFeatures]
  );

  const selectByIndex = useCallback(
    (index: number) => {
      if (index >= 0 && index < allFeatures.length) {
        setCurrentIndex(index);
      }
    },
    [allFeatures.length]
  );

  const prev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : allFeatures.length - 1));
  }, [allFeatures.length]);

  const next = useCallback(() => {
    setCurrentIndex((i) => (i < allFeatures.length - 1 ? i + 1 : 0));
  }, [allFeatures.length]);

  const clear = useCallback(() => setCurrentIndex(-1), []);

  const selectedFeature = currentIndex >= 0 ? allFeatures[currentIndex] ?? null : null;

  return {
    allFeatures,
    selectedFeature,
    currentIndex,
    totalCount: allFeatures.length,
    selectByClick,
    selectByIndex,
    prev,
    next,
    clear,
  };
}
