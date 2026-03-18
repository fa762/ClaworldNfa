import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'CLAW WORLD TERMINAL';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
          color: '#33FF66',
          position: 'relative',
        }}
      >
        {/* Vignette */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)',
          }}
        />

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textShadow: '0 0 20px rgba(51,255,102,0.8), 0 0 40px rgba(51,255,102,0.4)',
              marginBottom: 16,
            }}
          >
            CLAW WORLD
          </div>
          <div
            style={{
              fontSize: 24,
              color: '#1a6b2d',
              letterSpacing: '0.3em',
              marginBottom: 40,
            }}
          >
            T E R M I N A L
          </div>
          <div
            style={{
              fontSize: 18,
              color: '#1a6b2d',
              textAlign: 'center',
              maxWidth: 600,
            }}
          >
            BSC 链上去中心化 AI 龙虾养成终端
          </div>
          <div
            style={{
              marginTop: 32,
              fontSize: 14,
              color: '#0f3d1a',
            }}
          >
            ═══════════════════════════════════════
          </div>
        </div>

        {/* Scanlines */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 3px)',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
