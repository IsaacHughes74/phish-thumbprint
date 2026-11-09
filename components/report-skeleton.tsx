/**
 * Cold-load skeleton (EXPERIENCE.md §Cold load): reserved shapes for the hero,
 * stat-band tickets, show-history strip, section nav, and the card rails, sized
 * to match the resolved Report so the layout doesn't shift when data streams in
 * (streaming guide: skeleton = same size). This is the `<Suspense>` fallback for
 * the Report body.
 */
export function ReportSkeleton() {
  return (
    <div className="report-skeleton" aria-hidden="true">
      <div className="report-skeleton__hero">
        <div className="report-skeleton__title" />
        <div className="report-skeleton__meta" />
      </div>
      <div className="report-skeleton__band">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="report-skeleton__ticket" />
        ))}
      </div>
      <div className="report-skeleton__strip" />
      <div className="report-skeleton__nav">
        {[0, 1, 2, 3, 4, 5, 6].map((index) => (
          <div key={index} className="report-skeleton__chip" />
        ))}
      </div>
      <div className="report-skeleton__grid">
        <div className="report-skeleton__rail">
          <div className="report-skeleton__card" />
          <div className="report-skeleton__card" />
          <div className="report-skeleton__card" />
        </div>
        <div className="report-skeleton__rail">
          <div className="report-skeleton__card" />
          <div className="report-skeleton__card" />
          <div className="report-skeleton__card" />
          <div className="report-skeleton__card" />
        </div>
      </div>
    </div>
  );
}
