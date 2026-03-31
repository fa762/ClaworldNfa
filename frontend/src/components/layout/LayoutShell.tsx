'use client';

import { usePathname } from 'next/navigation';
import { PipBoyNav } from './PipBoyNav';
import { PipBoyStatusBar } from './PipBoyStatusBar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { KeyboardNav } from './KeyboardNav';

/**
 * LayoutShell — 根据路径决定是否显示 CRT 终端框架
 * /game 路由：全屏渲染，无 CRT 包装
 * 其他路由：标准 PipBoy 终端框架
 */
export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isGame = pathname.startsWith('/game');

  // 游戏页面：直接全屏渲染
  if (isGame) {
    return <ErrorBoundary>{children}</ErrorBoundary>;
  }

  // 普通页面：CRT 终端包装
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
