import { useEffect, useState } from 'react';
import type { ParkingProfile } from '../config/types';

// Which profile to load is chosen at build time via VITE_PROFILE so a single
// codebase produces two deployable apps (permit + public). Defaults to permit.
const PROFILE_ID = (import.meta.env.VITE_PROFILE as string) || 'lagrange-permit';
const PROFILE_PATH = import.meta.env.BASE_URL + 'profiles/' + PROFILE_ID + '.json';

export function useParkingProfile() {
  const [profile, setProfile] = useState<ParkingProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(PROFILE_PATH)
      .then((r) => r.json())
      .then((data: ParkingProfile) => setProfile(data))
      .catch((err) => console.error('Failed to load profile:', err))
      .finally(() => setLoading(false));
  }, []);

  return { profile, loading };
}
