import type { ShowHistoryRow } from '../lib/history-core';
import { toMMDDYY } from '../lib/phishnet/search';
import { getReport } from '../lib/stats';
import type { TrendBucket, TrendSong } from '../lib/stats-core';
import { ShowHistoryStrip } from './show-history-strip';
import { SongRow } from './song-row';
import { StatBand } from './stat-band';
import { StatCard } from './stat-card';
import { SectionNav, type SectionNavItem } from './section-nav';

const SECTIONS: SectionNavItem[] = [
  { id: 'most-heard', label: 'Most-heard songs' },
  { id: 'bust-outs', label: 'Bust-outs' },
  { id: 'never-heard', label: 'Never-heard songs' },
  { id: 'setlist-trends', label: 'Setlist trends' },
  { id: 'venues', label: 'Venues' },
];

const MOST_HEARD_LIMIT = 8;
const NEVER_HEARD_LIMIT = 20;
const VENUES_LIMIT = 10;
const BUST_OUTS_LIMIT = 20;

function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

function moreLabel(count: number, singular: string): string {
  return `\u2026and ${count} more ${singular}${count === 1 ? '' : 's'}`;
}

function ModuleEmpty({ children }: { children: string }) {
  return <p className="stat-card__empty">{children}</p>;
}

function BustOutRow({
  song,
  gap,
  date,
  venue,
}: {
  song: string;
  gap: number;
  date: string;
  venue: string;
}) {
  return (
    <div className="bust-row">
      <div className="bust-row__main">
        <span className="bust-row__title">{song}</span>
        <span className="bust-row__gap">{gap}-show gap</span>
      </div>
      <span className="bust-row__show">
        {date}
        {venue ? ` \u00B7 ${venue}` : ''}
      </span>
    </div>
  );
}

function TrendRow({ label, entries }: { label: string; entries: TrendSong[] }) {
  const top = entries[0];
  return (
    <div className="trend-row">
      <span className="trend-row__label">{label}</span>
      {top ? (
        <span className="trend-row__value">
          <span className="trend-row__name">{top.song}</span>{' '}
          <span className="trend-row__count">&times;{top.count}</span>
        </span>
      ) : (
        <span className="trend-row__empty">None yet</span>
      )}
    </div>
  );
}

function TrendBucketGroup({
  label,
  buckets,
}: {
  label: string;
  buckets: TrendBucket[];
}) {
  return (
    <div className="trend-group">
      <span className="trend-group__label">{label}</span>
      {buckets.length === 0 ? (
        <span className="trend-row__empty">None yet</span>
      ) : (
        <ul className="trend-group__list">
          {buckets.map((bucket) => (
            <li key={bucket.label} className="trend-group__item">
              <span className="trend-group__name">{bucket.label}</span>
              <span className="trend-group__count">&times;{bucket.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VenueRow({ name, count }: { name: string; count: number }) {
  return (
    <div className="venue-row">
      <span className="venue-row__name">{name}</span>
      <span className="venue-row__count">{count}</span>
    </div>
  );
}

interface ReportBodyProps {
  history: ShowHistoryRow[];
}

/**
 * The Report surface (CAP-3 / FR-9..14): hero, stat-band, sticky section-nav,
 * and the two-rail grid of the five stat-card modules. Server-rendered; derives
 * everything from `getReport` (AD-2), then hands plain data to the client
 * islands (song-row expand, section-nav scroll-spy) as props (AD-1).
 */
export async function ReportBody({ history }: ReportBodyProps) {
  const { report, degraded } = await getReport(history);

  const earliest = history[history.length - 1];
  const since = earliest ? toMMDDYY(earliest.showDate) : null;
  const firstVenue = earliest?.venueLabel ?? null;
  const showCount = report.statBand.shows;

  const maxHeardCount = report.mostHeard[0]?.count ?? 0;
  const showIds = history.map((row) => row.phishnetShowId);

  return (
    <>
      {degraded ? (
        <div className="report-banner" role="status">
          Couldn&rsquo;t load everything &mdash; some stats may be incomplete. Try again.
        </div>
      ) : null}

      <div className="report-hero">
        <h1 className="report-hero__title">
          Hey &mdash; <em>{formatNumber(showCount)} show{showCount === 1 ? '' : 's'}</em>, all of it
          here.
        </h1>
        {since ? (
          <p className="report-hero__meta">
            Since {since}
            {firstVenue ? ` \u00B7 first show ${firstVenue}` : ''}
            {` \u00B7 ${formatNumber(report.statBand.uniqueSongs)} unique songs`}
          </p>
        ) : null}
      </div>

      <StatBand statBand={report.statBand} />

      <ShowHistoryStrip
        count={showCount}
        since={since ?? '—'}
        showIds={showIds}
      />

      <SectionNav sections={SECTIONS} />

      <div className="report-grid">
        <div className="report-grid__main">
          <StatCard id="most-heard" title="Most-heard songs" sub="the songs you've heard most often">
            {report.mostHeard.length === 0 ? (
              <ModuleEmpty>No songs to rank yet &mdash; add a show and we&rsquo;ll start.</ModuleEmpty>
            ) : (
              <>
                {report.mostHeard.slice(0, MOST_HEARD_LIMIT).map((song, index) => (
                  <SongRow
                    key={song.songid}
                    rank={index + 1}
                    song={song.song}
                    count={song.count}
                    maxCount={maxHeardCount}
                    shows={song.shows.map((show) => ({
                      showId: show.showId,
                      date: toMMDDYY(show.showDate),
                      venueLabel: show.venueLabel,
                      count: show.count,
                    }))}
                  />
                ))}
                {report.mostHeard.length > MOST_HEARD_LIMIT ? (
                  <div className="stat-card__more">
                    {moreLabel(report.mostHeard.length - MOST_HEARD_LIMIT, 'song')}
                  </div>
                ) : null}
              </>
            )}
          </StatCard>

          <StatCard id="bust-outs" title="Bust-outs" sub="songs you caught on the night they came back">
            {report.bustOuts.length === 0 ? (
              <ModuleEmpty>No bust-outs in your shows yet.</ModuleEmpty>
            ) : (
              <>
                {report.bustOuts.slice(0, BUST_OUTS_LIMIT).map((bustOut) => (
                  <BustOutRow
                    key={`${bustOut.showId}-${bustOut.songid}`}
                    song={bustOut.song}
                    gap={bustOut.gap}
                    date={toMMDDYY(bustOut.showDate)}
                    venue={bustOut.venueLabel}
                  />
                ))}
                {report.bustOuts.length > BUST_OUTS_LIMIT ? (
                  <div className="stat-card__more">
                    {moreLabel(report.bustOuts.length - BUST_OUTS_LIMIT, 'bust-out')}
                  </div>
                ) : null}
              </>
            )}
          </StatCard>

          <StatCard id="setlist-trends" title="Setlist trends">
            <TrendRow label="Openers" entries={report.trends.openers} />
            <TrendRow label="Closers" entries={report.trends.closers} />
            <TrendRow label="Encores" entries={report.trends.encores} />
            <TrendRow label="Second-set openers" entries={report.trends.secondSetOpeners} />
            <TrendBucketGroup label="Shows by year" buckets={report.trends.showsByYear} />
            <TrendBucketGroup label="Shows by tour" buckets={report.trends.showsByTour} />
          </StatCard>
        </div>

        <div className="report-grid__side">
          <StatCard id="never-heard" title="Never-heard songs" sub="by chaseability">
            {report.neverHeard.length === 0 ? (
              <ModuleEmpty>
                You&rsquo;ve caught everything on your radar &mdash; new bust-outs gap back in
                automatically.
              </ModuleEmpty>
            ) : (
              <>
                <div className="chip-list">
                  {report.neverHeard.slice(0, NEVER_HEARD_LIMIT).map((song, index) => (
                    <span key={song.songid} className="chip">
                      {song.song} <span className="chip__tag">#{index + 1}</span>
                    </span>
                  ))}
                </div>
                {report.neverHeard.length > NEVER_HEARD_LIMIT ? (
                  <div className="stat-card__more">
                    {moreLabel(report.neverHeard.length - NEVER_HEARD_LIMIT, 'song')}
                  </div>
                ) : null}
              </>
            )}
          </StatCard>

          <StatCard id="venues" title="Venues">
            {report.venues.length === 0 ? (
              <ModuleEmpty>No venues yet.</ModuleEmpty>
            ) : (
              <>
                {report.venues.slice(0, VENUES_LIMIT).map((venue) => (
                  <VenueRow key={venue.venueId} name={venue.venue} count={venue.count} />
                ))}
                {report.venues.length > VENUES_LIMIT ? (
                  <div className="stat-card__more">
                    {moreLabel(report.venues.length - VENUES_LIMIT, 'venue')}
                  </div>
                ) : null}
              </>
            )}
          </StatCard>
        </div>
      </div>
    </>
  );
}
