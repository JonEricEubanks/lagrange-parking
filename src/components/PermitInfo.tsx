import React from 'react';
import type { AudienceGuideContent, GuideBullet } from '../config/types';

function renderBulletText(
  bullet: GuideBullet,
  onGoToTab?: (tabId: string) => void
): React.ReactNode {
  const { text, links } = bullet;
  if (!links || links.length === 0) return text;

  const parts: React.ReactNode[] = [];
  let remaining = text;

  for (const link of links) {
    const idx = remaining.indexOf(link.text);
    if (idx === -1) continue;
    if (idx > 0) parts.push(remaining.slice(0, idx));
    if (link.tabId && onGoToTab) {
      parts.push(
        <button
          key={link.text}
          type="button"
          className="permit-info-inline-link"
          onClick={() => onGoToTab(link.tabId!)}
        >
          {link.text}
        </button>
      );
    } else if (link.url) {
      parts.push(
        <a key={link.text} href={link.url} target="_blank" rel="noopener noreferrer">
          {link.text}
        </a>
      );
    }
    remaining = remaining.slice(idx + link.text.length);
  }
  if (remaining) parts.push(remaining);
  return <>{parts}</>;
}

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
                    {renderBulletText(bullet, onGoToTab)}
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
