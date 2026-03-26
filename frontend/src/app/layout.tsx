import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PipBoyNav } from "@/components/layout/PipBoyNav";
import { PipBoyStatusBar } from "@/components/layout/PipBoyStatusBar";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { KeyboardNav } from "@/components/layout/KeyboardNav";
import { I18nProvider } from "@/lib/i18n";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://clawnfaterminal.xyz'),
  title: "CLAW WORLD TERMINAL",
  description: "Claw Civilization Universe — BSC 链上去中心化 AI 龙虾养成终端",
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: "CLAW WORLD TERMINAL",
    description: "BSC 链上去中心化 AI 龙虾养成终端",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <WalletProvider>
        <I18nProvider>
          {/* PipBoy Terminal — Pure CSS frame */}
          <div className="terminal-backdrop">
            {/* Hardware frame */}
            <div className="hw-frame">
              {/* Top bezel — model label + indicator LEDs */}
              <div className="hw-top-bezel">
                <div className="hw-screw-dot" />
                <div className="hw-model-label">CLAW TERMINAL — MODEL NFA-578</div>
                <div className="hw-leds">
                  <span className="hw-led hw-led-green" />
                  <span className="hw-led hw-led-amber" />
                </div>
                <div className="hw-screw-dot" />
              </div>

              {/* CRT screen area */}
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

              {/* Bottom bezel — vents + serial */}
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
        </I18nProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
