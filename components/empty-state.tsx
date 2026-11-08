import { BrandMark } from './brand-mark';
import { AddShowPicker } from './add-show-picker';

/**
 * Empty Report state (DESIGN.md §empty-state): a dashed hairline well with the
 * headline, one explanatory line, and a single primary button that opens the
 * add-show picker. Shown only when the Phan has no Shows, so no recorded ids
 * need marking.
 */
export function EmptyState() {
  return (
    <div className="empty">
      <div className="empty-well">
        <BrandMark size={52} className="empty-well__donut" />
        <div className="empty-well__big">Add your first show.</div>
        <p>Nothing on the wall yet — add a show and we&rsquo;ll start the portrait.</p>
        <AddShowPicker triggerLabel="Add your first show" triggerClassName="btn-primary" />
      </div>
    </div>
  );
}
