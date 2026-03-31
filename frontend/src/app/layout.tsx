import type { Metadata, Viewport } from "next";
import "./globals.css";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { I18nProvider } from "@/lib/i18n";
import { LayoutShell } from "@/components/layout/LayoutShell";

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
          <LayoutShell>{children}</LayoutShell>
        </I18nProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
