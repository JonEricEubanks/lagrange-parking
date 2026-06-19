import { useEffect, useState } from 'react';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js';
import type { RelatedRulesConfig } from '../config/types';
import type { RuleRow } from './useRelatedRules';

/** One-shot load of every rule row, grouped by area key — for the Directory template. */
export function useAllRules(config: RelatedRulesConfig | undefined): Map<string, RuleRow[]> {
  const [byArea, setByArea] = useState<Map<string, RuleRow[]>>(new Map());

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    const table = new FeatureLayer({ url: config.url, outFields: ['*'] });
    // NB: chain queryFeatures off load() with native .then so the FeatureSet is
    // flattened. layer.when(cb) does NOT flatten a promise returned by cb, so
    // res.features would be undefined and the grouping silently produced an
    // empty map (no audience badges, every filter matched nothing).
    table
      .load()
      .then(() => {
        const q = table.createQuery();
        q.where = '1=1';
        q.outFields = ['*'];
        q.returnGeometry = false;
        if (config.orderByFields?.length) q.orderByFields = config.orderByFields;
        return table.queryFeatures(q);
      })
      .then((res) => {
        if (cancelled) return;
        const map = new Map<string, RuleRow[]>();
        for (const f of res.features) {
          const key = String(f.attributes[config.keyField]);
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(f.attributes);
        }
        setByArea(map);
      })
      .catch(() => {
        if (!cancelled) setByArea(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [config]);

  return byArea;
}
