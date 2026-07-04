import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://bhookabook.netlify.app"),
  title: {
    default: "Bhooka Book — Pakistan's AI Restaurant Concierge",
    template: "%s | Bhooka Book",
  },
  description:
    "Discover restaurants, check live rush forecasts, reserve tables, browse card discounts, and call restaurants to book. Pakistan's smartest dining companion.",
  keywords: ["restaurant", "reservation", "Pakistan", "Karachi", "Lahore", "AI", "dining"],
  authors: [{ name: "Bhooka Book" }],
  openGraph: {
    type: "website",
    locale: "en_PK",
    url: "https://bhookabook.netlify.app",
    siteName: "Bhooka Book",
    title: "Bhooka Book — Pakistan's AI Restaurant Concierge",
    description: "Discover, reserve, and dine smarter with AI-powered restaurant booking.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Bhooka Book" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bhooka Book",
    description: "Pakistan's AI Restaurant Concierge",
    images: ["/og-image.png"],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bhooka Book",
  },
};

export const viewport: Viewport = {
  themeColor: "#FF6B00",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <Toaster position="top-center" richColors />
        </Providers>
      </body>
    </html>
  );
}
