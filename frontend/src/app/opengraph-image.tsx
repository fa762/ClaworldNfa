import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'ClaworldNfa';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          color: '#33ff66',
          fontFamily: 'monospace',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at center, rgba(51,255,102,0.08) 0%, rgba(51,255,102,0.02) 35%, rgba(0,0,0,0.75) 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 24,
            border: '2px solid rgba(51,255,102,0.18)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 1px, transparent 1px, transparent 4px)',
          }}
        />

        <div
          style={{
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 136,
              height: 136,
              borderRadius: 20,
              border: '4px solid #33ff66',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 72,
              fontWeight: 700,
              boxShadow: '0 0 28px rgba(51,255,102,0.35)',
              marginBottom: 28,
            }}
          >
            C
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textShadow: '0 0 20px rgba(51,255,102,0.55)',
              marginBottom: 18,
            }}
          >
            CLAWORLDNFA
          </div>
          <div
            style={{
              fontSize: 24,
              color: '#7adf8b',
              letterSpacing: '0.36em',
              marginBottom: 34,
            }}
          >
            T E R M I N A L
          </div>
          <div
            style={{
              fontSize: 20,
              color: '#8fbf96',
              textAlign: 'center',
            }}
          >
            BSC Onchain AI Lobster Civilization Interface
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
