import type { NextConfig } from 'next';

// Dev-only: allow cross-origin requests/HMR from the tunnel host. Read from an
// env var so the hostname never lives in the committed config. Comma-separated.
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins,
};

export default nextConfig;
