'use client';

import { useEffect, useState } from 'react';

export interface SectionNavItem {
  id: string;
  label: string;
}

interface SectionNavProps {
  sections: SectionNavItem[];
}

/**
 * Sticky section nav on the Report (DESIGN.md §section-nav). Taps jump to the
 * in-page anchors (smooth, reduced-motion-safe); an IntersectionObserver tracks
 * the active section and underlines it with a tilted accent-2 rule. On mobile
 * the anchors become horizontally scrollable chips (CSS `overflow-x: auto`).
 */
export function SectionNav({ sections }: SectionNavProps) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? '');

  useEffect(() => {
    const ids = sections.map((section) => section.id);
    if (ids.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          );
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-64px 0px -60% 0px', threshold: 0 },
    );

    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    }

    return () => observer.disconnect();
  }, [sections]);

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
    const element = document.getElementById(id);
    if (!element) {
      return;
    }
    // Prefer a native jump under reduced motion, smooth scroll otherwise.
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return; // native anchor behavior (instant)
    }
    event.preventDefault();
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(id);
  }

  return (
    <nav
      className="section-nav"
      aria-label="Report sections"
    >
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className={`section-nav__link${
            section.id === activeId ? ' section-nav__link--active' : ''
          }`}
          aria-current={section.id === activeId ? 'true' : undefined}
          onClick={(event) => handleClick(event, section.id)}
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}
