import { useEffect, useState } from 'react';
import { useParkingProfile } from '../hooks/useParkingProfile';
import { HomePage } from './HomePage';
import { ParkingApp } from './ParkingApp';
import { GuidedFinder } from './templates/GuidedFinder';
import { Directory } from './templates/Directory';

export type TemplateView = 'explorer' | 'finder' | 'directory';
type View = 'home' | TemplateView;

function parseHash(): View {
  const h = window.location.hash.replace(/^#\/?/, '');
  return h === 'explorer' || h === 'finder' || h === 'directory' ? h : 'home';
}

export function App() {
  const { profile, loading: profileLoading } = useParkingProfile();
  const [view, setView] = useState<View>(parseHash());

  useEffect(() => {
    const onHash = () => setView(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (v: View) => {
    window.location.hash = v === 'home' ? '' : `/${v}`;
  };
  const home = () => go('home');

  if (profileLoading || !profile) {
    return <div className="loading-screen">Loading…</div>;
  }

  switch (view) {
    case 'explorer':
      return <ParkingApp profile={profile} onHome={home} />;
    case 'finder':
      return <GuidedFinder profile={profile} onHome={home} />;
    case 'directory':
      return <Directory profile={profile} onHome={home} />;
    default:
      return <HomePage profile={profile} onChoose={(v) => go(v)} />;
  }
}
