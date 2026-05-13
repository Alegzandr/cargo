import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

const cspString = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://cdn.discordapp.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const config: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
  images: {
    // Proxy Discord avatars through Next's image optimizer so repeat requests
    // are served from our cache instead of hitting cdn.discordapp.com each time.
    remotePatterns: [{ protocol: 'https', hostname: 'cdn.discordapp.com', pathname: '/avatars/**' }],
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },
  // Mirror tsconfig's `moduleResolution: Bundler` for webpack: let TS sources
  // import siblings with the `.js` extension that NodeNext/ESM requires at
  // runtime. Without this, `import './x.js'` from a .ts file fails to resolve
  // during `next build`.
  webpack: (cfg) => {
    cfg.resolve.extensionAlias = {
      ...(cfg.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return cfg;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Content-Security-Policy', value: cspString },
        ],
      },
    ];
  },
};

export default withNextIntl(config);
