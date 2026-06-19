import { useEffect, useRef, useState } from 'react';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js';
import type { RelatedRulesConfig } from '../config/types';

/**
 * Derives which areas belong to an audience by querying the related ParkingRule
 * table for the distinct area keys whose rules match `ruleWhere`. This lets the
 * app define tab membership from the (reliable) rule data instead of the source
 * `HAS*` flags — no hosted-data edit required.
 *
 * Returns the area-key list, or `null` while there is no ruleWhere / still loading.
 */
export function useAudienceAreaIds(
  config: RelatedRulesConfig | undefined,
  ruleWhere: string | undefined
): string[] | null {
  const [ids, setIds] = useState<string[] | null>(null);
  const tableRef = useRef<FeatureLayer | null>(null);

  useEffect(() => {
    if (!config) {
      tableRef.current = null;
      return;
    }
    tableRef.current = new FeatureLayer({ url: config.url, outFields: [config.keyField] });
    return () => {
      tableRef.current = null;
    };
  }, [config]);

  useEffect(() => {
    const table = tableRef.current;
    if (!config || !table || !ruleWhere) {
      setIds(null);
      return;
    }
    let cancelled = false;
    setIds(null); // reset so we don't briefly show the previous tab's areas

    table
      .when(() => {
        const query = table.createQuery();
        query.where = ruleWhere;
        query.outFields = [config.keyField];
        query.returnDistinctValues = true;
        query.returnGeometry = false;
        return table.queryFeatures(query);
      })
      .then((res) => {
        if (cancelled) return;
        const vals = [
          ...new Set(
            res.features.map((f) => String(f.attributes[config.keyField])).filter(Boolean)
          ),
        ];
        setIds(vals);
      })
      .catch(() => {
        if (!cancelled) setIds([]);
      });

    return () => {
      cancelled = true;
    };
  }, [config, ruleWhere]);

  return ids;
}
