import type { ParkingProfile } from '../config/types';
import type { TemplateView } from './App';

const CARDS: { id: TemplateView; title: string; tag: string; desc: string; icon: string }[] = [
  {
    id: 'finder',
    title: 'Guided Finder',
    tag: 'Answer one question',
    desc: 'Tell us who you are and instantly see where you can park and the rules that apply. Easiest on a phone.',
    icon: '🧭',
  },
  {
    id: 'directory',
    title: 'Parking Directory',
    tag: 'Scan every lot',
    desc: 'A searchable, filterable list of every parking area, with a map alongside. Great for browsing quickly.',
    icon: '🗂️',
  },
  {
    id: 'explorer',
    title: 'Map Explorer',
    tag: 'Browse the full map',
    desc: 'An interactive map with a tab for each group, a legend you can filter, and full lot details.',
    icon: '🗺️',
  },
];

export function HomePage({
  profile,
  onChoose,
}: {
  profile: ParkingProfile;
  onChoose: (view: TemplateView) => void;
}) {
  const base = import.meta.env.BASE_URL;
  return (
    <div className="home">
      <header className="home-hero">
        <img className="home-logo" src={base + profile.branding.logo} alt={profile.community} />
        <div className="home-hero-text">
          <h1 className="home-title">{profile.community}</h1>
          <p className="home-subtitle">{profile.title}</p>
        </div>
      </header>

      <main className="home-main">
        <p className="home-lead">Choose how you’d like to find parking</p>
        <div className="home-cards">
          {CARDS.map((c) => (
            <button key={c.id} className="home-card" onClick={() => onChoose(c.id)}>
              <span className="home-card-icon" aria-hidden="true">{c.icon}</span>
              <span className="home-card-tag">{c.tag}</span>
              <span className="home-card-title">{c.title}</span>
              <span className="home-card-desc">{c.desc}</span>
              <span className="home-card-go">Open →</span>
            </button>
          ))}
        </div>
        <p className="home-note">
          These are draft layouts for review — open each and let us know which works best.
        </p>
      </main>

      <footer className="home-footer">
        <img src={base + profile.branding.mgpLogo} alt="Municipal GIS Partners" className="home-mgp-logo" />
        <span>Powered by Municipal GIS Partners</span>
      </footer>
    </div>
  );
}
