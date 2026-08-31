export function FeatureNavigator({
  currentIndex,
  totalCount,
  onPrev,
  onNext,
}: {
  currentIndex: number;
  totalCount: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalCount === 0) return null;

  const display = currentIndex >= 0 ? currentIndex + 1 : 0;

  return (
    <div className="feature-navigator">
      <button className="nav-arrow" onClick={onPrev} aria-label="Previous lot">
        &#9664;
      </button>
      <span className="nav-counter">
        {display} of {totalCount}
      </span>
      <button className="nav-arrow" onClick={onNext} aria-label="Next lot">
        &#9654;
      </button>
    </div>
  );
}
