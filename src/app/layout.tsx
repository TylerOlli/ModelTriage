import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// Get site URL from environment, with fallback chain
const getSiteUrl = () => {
  // 1. Explicit env var
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  
  // 2. Vercel auto-provided URL (production)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // 3. Fallback (TODO: Update this to your actual domain)
  return "https://modeltriage.com";
};

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "ModelTriage",
  description: "Right LLM, every time.",
  metadataBase: new URL(siteUrl),
  
  // Open Graph
  openGraph: {
    title: "ModelTriage",
    description: "Right LLM, every time.",
    url: siteUrl,
    siteName: "ModelTriage",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ModelTriage - Right LLM, every time.",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  
  // Twitter
  twitter: {
    card: "summary_large_image",
    title: "ModelTriage",
    description: "Right LLM, every time.",
    images: ["/og-image.png"],
  },
  
  // Icons
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  
  // Manifest
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
