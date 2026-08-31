// Shared audience classification — mirrors scripts/add_audience_field.py.
// PERMITZONE-first: the zone code is reliable; RULETYPE is a noisy fallback.

export type Audience =
  | 'RESIDENT'
  | 'COMMUTER'
  | 'STUDENT'
  | 'EMPLOYEE'
  | 'VISITOR'
  | 'RESTRICTED'
  | 'OTHER';

const RESIDENT_ZONES = new Set(['A', 'B', 'C', 'D', '2A', '5A', '9A']);
const COMMUTER_ZONES = new Set(['E', 'G']);
const STUDENT_ZONES = new Set(['H']);
const EMPLOYEE_ZONES = new Set(['CBD', 'WBD']);

export function ruleAudience(ruletype?: string, permitzone?: string, userclass?: string): Audience {
  const rt = (ruletype || '').toUpperCase();
  const pz = (permitzone || '').toUpperCase();
  const uc = (userclass || '').toUpperCase();
  if (uc === 'VISITOR') return 'VISITOR';
  if (RESIDENT_ZONES.has(pz)) return 'RESIDENT';
  if (COMMUTER_ZONES.has(pz)) return 'COMMUTER';
  if (STUDENT_ZONES.has(pz)) return 'STUDENT';
  if (EMPLOYEE_ZONES.has(pz)) return 'EMPLOYEE';
  if (rt === 'OVERNIGHT_RESIDENT' || rt === 'DAYTIME_RESIDENT') return 'RESIDENT';
  if (rt === 'COMMUTER_DECAL') return 'COMMUTER';
  if (rt === 'CBD_DECAL' || rt === 'BUSINESS_DECAL') return 'EMPLOYEE';
  if (rt === 'NO_PARKING') return 'RESTRICTED';
  return 'OTHER';
}
