import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://mightymak.vercel.app"),
  title: "MightyMak.ai — Your AI Video Studio",
  description:
    "Plan the concept, cast your characters, and produce scroll-stopping video with native audio — cheap drafts to iterate, full 1080p when it counts. One studio, every video managed.",
  openGraph: {
    title: "MightyMak.ai — Your AI Video Studio",
    description:
      "Plan it, cast it, make it — AI video with consistent characters, from draft to 1080p production.",
    url: "/",
    siteName: "MightyMak.ai",
    images: [{ url: "/generated/hero-neon-city.png", width: 1280, height: 720 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MightyMak.ai — Your AI Video Studio",
    description: "Your AI video studio, one prompt away.",
    images: ["/generated/hero-neon-city.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
