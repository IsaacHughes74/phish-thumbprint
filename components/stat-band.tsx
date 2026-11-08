import type { Report } from '../lib/stats-core';

interface StatBandProps {
  statBand: Report['statBand'];
}

interface TicketCellProps {
  side: 'left' | 'right';
  value: number;
  label: string;
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

/** A faint, deterministic ticket number ("N° 412") — decorative only. */
function ticketNumber(value: number): string {
  return `N\u00B0 ${String(value % 1000).padStart(3, '0')}`;
}

function TicketCell({ side, value, label }: TicketCellProps) {
  return (
    <div
      className={`stat-band__cell stat-band__cell--stub-${side}`}
    >
      <div className="stat-band__stub">
        <span className="stat-band__tno" aria-hidden="true">
          {ticketNumber(value)}
        </span>
        <span className="stat-band__barcode" aria-hidden="true" />
      </div>
      <div className="stat-band__body">
        <div className="stat-band__numeral">{formatNumber(value)}</div>
        <div className="stat-band__label">{label}</div>
      </div>
    </div>
  );
}

/**
 * The report's hero numeric cluster (DESIGN.md §stat-band): four concert-ticket
 * cells (shows · songs heard live · unique songs · venues), each with a stub
 * strip, perforation, faint ticket number, dim barcode, and a varied hand-cut
 * tilt. Announced to screen readers as a single summary (EXPERIENCE.md §stat-band).
 */
export function StatBand({ statBand }: StatBandProps) {
  const { shows, heardLive, uniqueSongs, venues } = statBand;
  const summary = `${shows} shows, ${heardLive} songs heard live, ${uniqueSongs} unique songs, ${venues} venues`;

  return (
    <section className="stat-band" aria-label={summary}>
      <TicketCell side="left" value={shows} label="shows" />
      <TicketCell side="right" value={heardLive} label="songs heard live" />
      <TicketCell side="left" value={uniqueSongs} label="unique songs" />
      <TicketCell side="right" value={venues} label="venues" />
    </section>
  );
}
