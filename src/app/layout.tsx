import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { AnalyticsTags } from "@/components/analytics-tags";
import "./globals.css";

// Mobile-first: fit the device width and keep pinch-zoom available for
// accessibility (no maximum-scale lock).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://vibvid.ai"),
  title: "VIBVID.AI — AI UGC Ads in Minutes",
  description:
    "Make creator-style UGC video ads with AI. Pick a proven 15-second style, swap in your real product, presenter and lines — render vertical ads with native audio in minutes. From $19/month.",
  openGraph: {
    title: "VIBVID.AI — UGC ads without the creators",
    description:
      "Ten proven 15-second ad styles. Your product, your presenter, your lines — rendered in minutes.",
    url: "/",
    siteName: "VIBVID.AI",
    images: [{ url: "/og/ugc-og.jpg", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VIBVID.AI — UGC ads without the creators",
    description: "Ten proven ad styles. Your product, your presenter, your lines — in minutes.",
    images: ["/og/ugc-og.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable}`}>
      <body className="antialiased">
        {children}
        <Analytics />
        <AnalyticsTags />
      </body>
    </html>
  );
}
