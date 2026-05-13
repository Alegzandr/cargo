import { ImageResponse } from 'next/og';

const BG = '#0d1014';
const HAIRLINE = '#262c35';
const INK = '#ebeef3';
const MUTED = '#9ca3ae';
const ACCENT = '#f97316';

export const OG_SIZE = { width: 1200, height: 630 } as const;

// Inlined `public/cargo.svg` (Twemoji package). next/og renders over satori,
// which can't reliably resolve emoji glyphs in this environment — Discord's
// preview was substituting 📦 with a system-font fallback. Per CLAUDE.md the
// mark is the SVG, not the codepoint.
const CARGO_MARK_DATA_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">' +
      '<path fill="#a57939" d="M32 8.4L18 4.2 4 8.4 4 27.6 18 31.8 32 27.6z"/>' +
      '<path fill="#c1694f" d="M18 4.2 4 8.4l14 4.2 14-4.2z"/>' +
      '<path fill="#8a4b38" d="M4 27.6 18 31.8 18 12.6 4 8.4z"/>' +
      '<path fill="#a57939" d="M32 27.6 18 31.8 18 12.6 32 8.4z" opacity=".85"/>' +
      '<path fill="#3b2e26" d="M12 6.3v6.3l4 1.2v-6.3z"/>' +
      '<path fill="#3b2e26" d="M20 13.8 28 11.4v-3.6L20 10.2z" opacity=".7"/>' +
      '</svg>',
  );

export function renderBrandOG({
  title,
  subtitle,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
}): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: BG,
          backgroundImage: `radial-gradient(circle at 85% 15%, rgba(249,115,22,0.18) 0%, transparent 55%)`,
          color: INK,
          fontFamily: 'sans-serif',
          padding: 80,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: ACCENT,
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 32,
            left: 32,
            right: 32,
            bottom: 32,
            border: `1px solid ${HAIRLINE}`,
            borderRadius: 18,
            display: 'flex',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={CARGO_MARK_DATA_URI} width={88} height={88} alt="" style={{ display: 'flex' }} />
          <div style={{ fontSize: 60, fontWeight: 600, letterSpacing: -1, display: 'flex' }}>Cargo</div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
            marginTop: 'auto',
            marginBottom: 40,
          }}
        >
          {eyebrow ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontSize: 26,
                color: ACCENT,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 2,
              }}
            >
              <div style={{ width: 10, height: 10, borderRadius: 999, background: ACCENT, display: 'flex' }} />
              <div style={{ display: 'flex' }}>{eyebrow}</div>
            </div>
          ) : null}
          <div
            style={{
              fontSize: 76,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 980,
              display: 'flex',
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                fontSize: 32,
                color: MUTED,
                maxWidth: 980,
                lineHeight: 1.35,
                display: 'flex',
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            color: MUTED,
            fontSize: 22,
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: 999, background: ACCENT, display: 'flex' }} />
          <div style={{ display: 'flex' }}>Encrypted at rest · 1-hour links · Discord sign-in</div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
