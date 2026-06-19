import { useEffect, useRef, useState } from 'react';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js';
import type { RelatedRulesConfig } from '../config/types';

export type RuleRow = Record<string, unknown>;

/**
 * Queries the related ParkingRule table for the selected parking area.
 * `ruleWhere` (set per audience tab) further narrows to that group's rules so
 * each audience map shows only the rules relevant to it.
 */
export function useRelatedRules(
  config: RelatedRulesConfig | undefined,
  areaId: string | number | null | undefined,
  ruleWhere?: string
): RuleRow[] {
  const [rules, setRules] = useState<RuleRow[]>([]);
  const tableRef = useRef<FeatureLayer | null>(null);

  // Create the standalone table layer once per config.
  useEffect(() => {
    if (!config) {
      tableRef.current = null;
      return;
    }
    tableRef.current = new FeatureLayer({ url: config.url, outFields: ['*'] });
    return () => {
      tableRef.current = null;
    };
  }, [config]);

  useEffect(() => {
    const table = tableRef.current;
    if (!config || !table || areaId == null || areaId === '') {
      setRules([]);
      return;
    }
    let cancelled = false;

    const idValue = typeof areaId === 'number' ? areaId : `'${String(areaId).replace(/'/g, "''")}'`;
    const clauses = [`${config.keyField} = ${idValue}`];
    if (ruleWhere && ruleWhere.trim()) clauses.push(`(${ruleWhere})`);

    // Chain queryFeatures off load() with native .then so the FeatureSet is
    // flattened — layer.when(cb) does not flatten a promise returned by cb.
    table
      .load()
      .then(() => {
        const query = table.createQuery();
        query.where = clauses.join(' AND ');
        query.outFields = ['*'];
        query.returnGeometry = false;
        if (config.orderByFields?.length) query.orderByFields = config.orderByFields;
        return table.queryFeatures(query);
      })
      .then((result) => {
        if (!cancelled) setRules(result.features.map((f) => f.attributes));
      })
      .catch(() => {
        if (!cancelled) setRules([]);
      });

    return () => {
      cancelled = true;
    };
  }, [config, areaId, ruleWhere]);

  return rules;
}
