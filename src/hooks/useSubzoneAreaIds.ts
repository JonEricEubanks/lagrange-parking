import { useEffect, useState } from 'react';
import type { SubzoneConfig } from '../config/types';

/**
 * The distinct area ids that actually have designated subzones drawn.
 *
 * Needed because only *permitted* areas are mapped, which makes "no subzones"
 * ambiguous: it can mean "nothing is permitted inside this lot" or "these have
 * not been digitized yet". Two lots are in the second state today (the Village
 * Hall Garage and Lot 15), so the app must know the difference before telling
 * anyone to "park only in the highlighted areas" — on a lot with no highlights
 * that sentence reads as "you cannot park here at all", which is wrong.
 *
 * Returns null until the query resolves, so callers can hold the message back
 * rather than flash a wrong one.
 */
export function useSubzoneAreaIds(config: SubzoneConfig | undefined, enabled: boolean) {
  const [ids, setIds] = useState<string[] | null>(null);

  const url = config?.url;
  const keyField = config?.keyField;

  useEffect(() => {
    // No synchronous reset here — the hook derives its disabled value on the
    // way out instead, so this effect never sets state during a render pass.
    if (!enabled || !url || !keyField) return;
    let cancelled = false;
    const params = new URLSearchParams({
      where: '1=1',
      outFields: keyField,
      returnGeometry: 'false',
      returnDistinctValues: 'true',
      f: 'json',
    });
    fetch(`${url}/query?${params}`)
      .then((r) => r.json())
      .then((data: { features?: { attributes: Record<string, unknown> }[] }) => {
        if (cancelled) return;
        const found = (data.features ?? [])
          .map((f) => f.attributes?.[keyField])
          .filter((v): v is string | number => v != null)
          .map(String);
        setIds([...new Set(found)]);
      })
      .catch(() => {
        // Leave it null on failure — the map still draws, we just don't assert
        // the "only in the highlighted areas" rule we can no longer verify.
        if (!cancelled) setIds(null);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, url, keyField]);

  return enabled ? ids : null;
}
