import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono, Outfit } from "next/font/google";

import "./globals.css";

import { AppShell } from "@/components/layout/AppShell";
import { ActiveCompanionProvider } from "@/components/lobster/useActiveCompanion";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { I18nProvider } from "@/lib/i18n";

const headingFont = Outfit({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "600", "700"],
});

const bodyFont = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "700"],
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["500", "700"],
});

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
      <body className={`${headingFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
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
