import { useEffect, useState } from 'react';
import { useParkingProfile } from '../hooks/useParkingProfile';
import { ParkingApp } from './ParkingApp';
import { GuidedFinder } from './templates/GuidedFinder';
import { Directory } from './templates/Directory';

export type TemplateView = 'explorer' | 'finder' | 'directory';

/**
 * The Guided Finder is *the* app. The Explorer and Directory were built as
 * review alternatives and stay reachable at #/explorer and #/directory for
 * internal comparison, but nothing links to them — visitors land straight on
 * the finder rather than being asked to pick a layout first.
 */
const DEFAULT_VIEW: TemplateView = 'finder';

function parseHash(): TemplateView {
  const h = window.location.hash.replace(/^#\/?/, '');
  return h === 'explorer' || h === 'directory' || h === 'finder' ? h : DEFAULT_VIEW;
}

export function App() {
  const { profile, loading: profileLoading } = useParkingProfile();
  const [view, setView] = useState<TemplateView>(parseHash());

  useEffect(() => {
    const onHash = () => setView(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (profileLoading || !profile) {
    return <div className="loading-screen">Loading…</div>;
  }

  switch (view) {
    case 'explorer':
      return <ParkingApp profile={profile} />;
    case 'directory':
      return <Directory profile={profile} />;
    default:
      return <GuidedFinder profile={profile} />;
  }
}
