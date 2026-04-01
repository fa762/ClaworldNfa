'use client';

import { PipBoyNav } from './PipBoyNav';
import { PipBoyStatusBar } from './PipBoyStatusBar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { KeyboardNav } from './KeyboardNav';

/**
 * LayoutShell — 标准 CRT 终端框架
 */
export function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="terminal-backdrop">
        <div className="hw-frame">
          {/* Top bezel */}
          <div className="hw-top-bezel">
            <div className="hw-screw-dot" />
            <div className="hw-model-label">CLAW TERMINAL — MODEL NFA-578</div>
            <div className="hw-leds">
              <span className="hw-led hw-led-green" />
              <span className="hw-led hw-led-amber" />
            </div>
            <div className="hw-screw-dot" />
          </div>

          {/* CRT screen */}
          <div className="hw-screen-housing">
            <div className="crt-viewport">
              <div className="crt-barrel">
                <div className="crt-glow-overlay" />
                <div className="crt-scanlines" />
                <div className="crt-glass" />
                <div className="crt-screen">
                  <div className="crt-content">
                    <PipBoyNav />
                    <main className="flex-1 overflow-y-auto min-h-0">
                      <ErrorBoundary>{children}</ErrorBoundary>
                    </main>
                    <PipBoyStatusBar />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom bezel */}
          <div className="hw-bottom-bezel">
            <div className="hw-screw-dot" />
            <div className="hw-vents">
              <span /><span /><span /><span /><span /><span /><span /><span />
            </div>
            <div className="hw-serial">SN:CCU-2026-888</div>
            <div className="hw-screw-dot" />
          </div>
        </div>
      </div>

      <KeyboardNav />
    </>
  );
}
