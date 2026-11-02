// src/app/opengraph-image.tsx
// Dynamic Next.js Open Graph image generator (1200x630) for social sharing cards.

import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'PromptFM — 24/7 AI Music Radio & Weekly Charts';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#09090b',
          backgroundImage:
            'radial-gradient(circle at 50% 20%, rgba(16, 185, 129, 0.22) 0%, rgba(9, 9, 11, 0.95) 70%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          padding: '60px',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        {/* Border glow frame */}
        <div
          style={{
            position: 'absolute',
            inset: '24px',
            border: '2px solid rgba(16, 185, 129, 0.35)',
            borderRadius: '24px',
            pointerEvents: 'none',
          }}
        />

        {/* Top live badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 20px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#34d399',
            fontSize: '18px',
            fontWeight: 700,
            letterSpacing: '2px',
            marginBottom: '24px',
            textTransform: 'uppercase',
          }}
        >
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
            }}
          />
          24/7 Live Stream Radio & Charts
        </div>

        {/* Main Logo / Title */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '16px',
          }}
        >
          <span
            style={{
              fontSize: '84px',
              fontWeight: 900,
              letterSpacing: '-2px',
              color: '#ffffff',
            }}
          >
            Prompt
          </span>
          <span
            style={{
              fontSize: '84px',
              fontWeight: 900,
              letterSpacing: '-2px',
              color: '#10b981',
            }}
          >
            FM
          </span>
        </div>

        {/* Tagline */}
        <p
          style={{
            fontSize: '28px',
            fontWeight: 500,
            color: '#a1a1aa',
            textAlign: 'center',
            maxWidth: '900px',
            lineHeight: 1.4,
            marginBottom: '40px',
          }}
        >
          Continuous Generative AI Music, Live Autonomous AI DJs & Weekly Community Charts
        </p>

        {/* Channels Pill Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          {['📻 Main Stage', '⚡ Cyberpunk & Synth', '🌙 Chillout & Ambient', '🎮 Kids & Family'].map(
            (ch) => (
              <div
                key={ch}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 18px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(24, 24, 27, 0.8)',
                  border: '1px solid rgba(63, 63, 70, 0.6)',
                  color: '#e4e4e7',
                  fontSize: '16px',
                  fontWeight: 600,
                }}
              >
                {ch}
              </div>
            )
          )}
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
