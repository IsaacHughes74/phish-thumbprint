/**
 * The only authentication control on the Landing surface (DESIGN.md —
 * sign-in-button): cream fill, navy text, full radius. Rendered but
 * non-functional in Story 1; Story 2 wires the Apple sign-in flow.
 */
export function SignInButton() {
  return (
    <button type="button" className="signin" aria-label="Sign in with Apple">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16.5 12.4c0-1.9 1.5-2.8 1.6-2.9-1-.1-2-.6-2.5-.6-1 0-1.3.6-2.1.6-.8 0-1.1-.6-1.9-.6-.9 0-1.8.6-2.2 1.5-.9 1.6-.2 3.8.7 5.1.4.6.9 1.3 1.5 1.3.6 0 .9-.4 1.6-.4s.9.4 1.6.4 1.1-.6 1.5-1.2c.4-.7.6-1.3.6-1.4-.1 0-1.2-.5-1.2-1.8zM14.9 7.4c.5-.6.8-1.4.7-2.2-.7 0-1.5.5-2 1-.4.5-.8 1.3-.7 2.1.8 0 1.5-.4 2-.9z" />
      </svg>
      Sign in with Apple
    </button>
  );
}
