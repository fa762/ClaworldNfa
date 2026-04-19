import type { Metadata, Viewport } from "next";

import "./globals.css";

import { AppShell } from "@/components/layout/AppShell";
import { ActiveCompanionProvider } from "@/components/lobster/useActiveCompanion";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { I18nProvider } from "@/lib/i18n";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffb45c",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.clawnfaterminal.xyz"),
  applicationName: "Clawworld",
  manifest: "/manifest.webmanifest",
  title: "Clawworld",
  description: "Raise your lobster companion on BNB Chain.",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Clawworld",
  },
  openGraph: {
    title: "Clawworld",
    description: "Your lobster companion on BNB Chain.",
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
      <body>
        <WalletProvider>
          <I18nProvider>
            <ActiveCompanionProvider>
              <AppShell>{children}</AppShell>
            </ActiveCompanionProvider>
          </I18nProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
