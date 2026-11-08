import Link from 'next/link';
import { AddShowPicker } from './add-show-picker';

interface ShowHistoryStripProps {
  /** Number of recorded Shows. */
  count: number;
  /** Earliest Show date, pre-formatted `MM/DD/YY` by the caller. */
  since: string;
  /** phish.net show ids already recorded, for the picker's duplicate marks. */
  showIds: string[];
}

/**
 * Compact Show-history summary on the Report (DESIGN.md §show-history-strip):
 * "N shows · since … · + add". The "N shows · since …" part links to the full
 * `/history` surface; "+ add" opens the picker.
 */
export function ShowHistoryStrip({ count, since, showIds }: ShowHistoryStripProps) {
  return (
    <div className="history-strip">
      <Link className="history-strip__link" href="/history">
        <span className="history-strip__n">{count}</span> show{count === 1 ? '' : 's'}
        <span className="history-strip__sep">&middot;</span>
        <span className="history-strip__lbl">since {since}</span>
      </Link>
      <AddShowPicker
        triggerLabel="+ add"
        triggerClassName="history-strip__add"
        recordedShowIds={showIds}
      />
    </div>
  );
}
