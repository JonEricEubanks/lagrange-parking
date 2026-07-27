import type { AudienceGuideContent } from '../config/types';

/**
 * The permit-wide information panel: everything that applies to *every* lot on
 * a permit page (hours, eligibility, limits), grouped into short labelled
 * sections rather than one long bullet run. This is what a permit holder
 * actually needs to read — per-lot attributes only matter once they pick a lot.
 */
export function PermitInfo({
  guide,
  onGoToTab,
}: {
  guide?: AudienceGuideContent;
  onGoToTab?: (tabId: string) => void;
}) {
  if (!guide) return null;
  const { sections, seeAlso, pending } = guide;
  if (!sections?.length && !seeAlso && !pending) return null;

  const base = import.meta.env.BASE_URL;

  return (
    <div className="permit-info">
      {sections && sections.length > 0 && (
        <>
          <h3 className="permit-info-h">What you need to know</h3>
          {sections.map((section) => (
            <section key={section.title} className="permit-info-section">
              <h4 className="permit-info-title">{section.title}</h4>
              <ul className="permit-info-list">
                {section.bullets.map((bullet, i) => (
                  <li key={i}>
                    {bullet.text}
                    {bullet.items && bullet.items.length > 0 && (
                      <ul className="permit-info-sublist">
                        {bullet.items.map((item, k) => (
                          <li key={k}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      {seeAlso && onGoToTab && (
        <div className="permit-info-seealso">
          {seeAlso.text && <p className="permit-info-seealso-text">{seeAlso.text}</p>}
          <button
            type="button"
            className="permit-info-seealso-btn"
            onClick={() => onGoToTab(seeAlso.tabId)}
          >
            {seeAlso.label} →
          </button>
        </div>
      )}

      {pending && (
        <aside className="permit-info-pending">
          <h4 className="permit-info-pending-title">{pending.title}</h4>
          <p className="permit-info-pending-body">{pending.body}</p>
          {pending.image && (
            <img className="permit-info-pending-img" src={base + pending.image} alt={pending.title} />
          )}
        </aside>
      )}
    </div>
  );
}
