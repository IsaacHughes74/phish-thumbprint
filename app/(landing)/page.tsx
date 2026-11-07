import { BrandMark } from '../../components/brand-mark';
import { SignInButton } from '../../components/sign-in-button';

/**
 * Landing surface (EXPERIENCE.md — IA: unauthenticated entry). Exact copy from
 * mockups/landing.html (golden example): topbar, hero, sign-in button, legal.
 * The donate footer lives in the root layout so it is present on every surface.
 */
export default function LandingPage() {
  return (
    <div className="screen">
      <header className="topbar">
        <BrandMark size={30} className="brand-mark" />
        <span className="brand-wordmark">Phish Thumbprint</span>
      </header>

      <main className="hero">
        <BrandMark size={72} className="brand-mark brand-mark--hero" />
        <h1>Your thumbprint on Phish.</h1>
        <p className="hero__pitch">Drawn from your shows.</p>
        <SignInButton />
        <p className="hero__legal">
          Free and non-commercial. Built on the Phish.net setlist archive. Apple sign-in only —
          your history stays yours.
        </p>
      </main>
    </div>
  );
}
