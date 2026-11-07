export interface BrandMarkProps {
  size?: number;
  className?: string;
}

/**
 * Single-tone donut placeholder mark (DESIGN.md §Components — brand-mark): a
 * plain ring with a hole, no color detail. Ring color comes from CSS via
 * `currentColor`; geometry matches mockups/landing.html.
 */
export function BrandMark({ size = 30, className }: BrandMarkProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="21" fill="none" stroke="currentColor" strokeWidth="11" />
    </svg>
  );
}
