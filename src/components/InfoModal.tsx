import type { ParkingProfile } from '../config/types';

export function InfoModal({ profile, onClose }: { profile: ParkingProfile; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>About</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="modal-body">
          <p>
            <strong>{profile.title}</strong> is an interactive map from the {profile.community} to
            help you find where you can park and what the rules are.
          </p>
          <p>
            Use the tabs to pick the experience that fits you. Click any parking area on the map — or
            choose one from the list — to see who can park there and the rules that apply.
          </p>
          <p>Use the legend on the left to filter by parking type.</p>
          {profile.lastUpdated && (
            <p className="modal-last-updated">
              Data last updated:{' '}
              {new Date(profile.lastUpdated + 'T00:00:00').toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          )}
          <div className="modal-footer">
            <img
              src={import.meta.env.BASE_URL + profile.branding.mgpLogo}
              alt="Municipal GIS Partners"
              className="modal-mgp-logo"
            />
            <span className="modal-attribution">Powered by Municipal GIS Partners</span>
          </div>
        </div>
      </div>
    </div>
  );
}
