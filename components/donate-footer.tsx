export const MOCKINGBIRD_DONATE_URL = 'https://mbird.org/donate/';

/**
 * Mockingbird Foundation donate link + phish.net attribution
 * (EXPERIENCE.md — donate-footer: present on every surface, never modal).
 */
export function DonateFooter() {
  return (
    <footer className="donate-footer">
      <span className="donate-footer__attr">courtesy Phish.net / Mockingbird Foundation</span>
      <a
        className="donate-footer__donate"
        href={MOCKINGBIRD_DONATE_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        Donate to the Mockingbird Foundation
      </a>
    </footer>
  );
}
