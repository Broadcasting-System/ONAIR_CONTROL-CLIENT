import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Orbitron } from "next/font/google";
import localFont from "next/font/local";
import Providers from "@/components/providers/Providers";
import Splash from "@/components/common/Splash";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
});

const mbcFont = localFont({
  src: "../../public/fonts/MBC 1961 OTF M.otf",
  variable: "--font-mbc",
});

const woojuFont = localFont({
  src: "../../public/fonts/HakgyoansimWoojuR.otf",
  variable: "--font-wooju",
});

// 폰: 화면 끝(노치·홈 막대)까지 쓰고 safe-area 로 비켜 앉는다. 입력 칸을 눌러도 확대되지 않게
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: "ONAIR Control",
  description: "BSSM Broadcast Remote Control",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${orbitron.variable} ${mbcFont.variable} ${woojuFont.variable} antialiased`}
      >
        <Providers>{children}</Providers>
        <Splash />
      </body>
    </html>
  );
}
