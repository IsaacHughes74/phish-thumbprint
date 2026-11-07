import { BrandMark } from './brand-mark';

/**
 * Empty Report state (DESIGN.md §empty-state): a dashed hairline well with the
 * headline, one explanatory line, and a single primary button. The button is
 * inert until Story 3 wires the add-show picker.
 */
export function EmptyState() {
  return (
    <div className="empty">
      <div className="empty-well">
        <BrandMark size={52} className="empty-well__donut" />
        <div className="empty-well__big">Add your first show.</div>
        <p>Nothing on the wall yet — add a show and we&rsquo;ll start the portrait.</p>
        <button type="button" className="btn-primary">
          Add your first show
        </button>
      </div>
    </div>
  );
}
