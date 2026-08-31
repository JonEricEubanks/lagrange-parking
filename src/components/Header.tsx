import { useState } from 'react';
import type { ParkingProfile } from '../config/types';
import { InfoModal } from './InfoModal';

export function Header({ profile, onHome }: { profile: ParkingProfile; onHome?: () => void }) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <>
      <header className="app-header">
        <div className="header-left">
          {onHome && (
            <button
              className="header-home-btn"
              onClick={onHome}
              title="All views"
              aria-label="Back to all views"
            >
              ←
            </button>
          )}
          <img
            src={import.meta.env.BASE_URL + profile.branding.logo}
            alt={profile.community}
            className="header-logo"
          />
          <div className="header-titles">
            <span className="header-title">{profile.community}</span>
            <span className="header-subtitle">{profile.title}</span>
          </div>
        </div>
        <button
          className="header-info-btn"
          onClick={() => setShowInfo(true)}
          title="About this application"
          aria-label="About this application"
        >
          i
        </button>
      </header>
      {showInfo && <InfoModal profile={profile} onClose={() => setShowInfo(false)} />}
    </>
  );
}
