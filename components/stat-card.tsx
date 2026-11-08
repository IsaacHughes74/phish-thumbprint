import type { ReactNode } from 'react';

interface StatCardProps {
  id: string;
  title: string;
  sub?: string;
  children: ReactNode;
}

/**
 * One report module (DESIGN.md §stat-card): raised fill, hairline border,
 * `rounded.lg`, uppercase heading, optional sublabel, then ranked content.
 * The `id` is the section anchor the sticky section-nav targets.
 */
export function StatCard({ id, title, sub, children }: StatCardProps) {
  return (
    <section className="stat-card" id={id}>
      <h2 className="stat-card__title">{title}</h2>
      {sub ? <p className="stat-card__sub">{sub}</p> : null}
      {children}
    </section>
  );
}
