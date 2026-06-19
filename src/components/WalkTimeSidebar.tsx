import type { WalkTimeStep, WalkTimeRouteInfo } from '../config/types';

interface WalkTimeSidebarProps {
  step: WalkTimeStep;
  routeInfo: WalkTimeRouteInfo | null;
  errorMessage: string | null;
  onReset: () => void;
}

const STEPS = [
  { key: 'set-start', label: 'Set starting point' },
  { key: 'set-end', label: 'Set destination' },
  { key: 'solving', label: 'Calculate route' },
] as const;

function stepIndex(step: WalkTimeStep): number {
  if (step === 'set-start') return 0;
  if (step === 'set-end') return 1;
  return 2;
}

export function WalkTimeSidebar({ step, routeInfo, errorMessage, onReset }: WalkTimeSidebarProps) {
  const currentIdx = stepIndex(step);

  return (
    <aside className="detail-panel walk-time-sidebar">
      <div className="walk-time-header">Walk Time Calculator</div>

      <div className="walk-time-steps">
        {STEPS.map((s, i) => {
          const done = i < currentIdx || step === 'result';
          const active = i === currentIdx && step !== 'result' && step !== 'error';

          return (
            <div key={s.key} className={`walk-step ${done ? 'walk-step-done' : ''} ${active ? 'walk-step-active' : ''}`}>
              <span className="walk-step-circle">
                {done ? '\u2713' : i + 1}
              </span>
              <span className="walk-step-label">{s.label}</span>
            </div>
          );
        })}
      </div>

      {step === 'set-start' && (
        <div className="walk-time-instruction">
          Click the map to set your starting point.
        </div>
      )}

      {step === 'set-end' && (
        <div className="walk-time-instruction">
          Now click your destination.
        </div>
      )}

      {step === 'solving' && (
        <div className="walk-time-instruction">
          Calculating route...
        </div>
      )}

      {step === 'result' && routeInfo && (
        <div className="walk-time-result">
          <div className="walk-result-row">
            <span className="walk-result-label">Walking Time</span>
            <span className="walk-result-value">{routeInfo.totalMinutes} min</span>
          </div>
          <div className="walk-result-row">
            <span className="walk-result-label">Distance</span>
            <span className="walk-result-value">{routeInfo.totalMiles} mi</span>
          </div>
        </div>
      )}

      {step === 'error' && (
        <div className="walk-time-error">
          {errorMessage || 'An error occurred.'}
        </div>
      )}

      {(step === 'result' || step === 'error' || step === 'set-end') && (
        <button className="walk-reset-btn" onClick={onReset}>
          Reset
        </button>
      )}
    </aside>
  );
}
