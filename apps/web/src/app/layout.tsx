import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { GTProvider } from "gt-next";
import { RootProvider } from "fumadocs-ui/provider/next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/query-provider";
import "./globals.css";

const title = "OfferKit";
const description = "Self-hostable open-source promotion engine";
const ogImage = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "OfferKit promotion engine dashboard illustration",
};

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env["OFFERKIT_PUBLIC_URL"] ?? "http://localhost:3000"),
  title,
  description,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title,
    description,
    type: "website",
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [ogImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <GTProvider>
          <RootProvider theme={{ enabled: false }}>
            <QueryProvider>
              <TooltipProvider delay={300}>{children}</TooltipProvider>
              <Toaster richColors position="top-right" />
            </QueryProvider>
          </RootProvider>
        </GTProvider>
      </body>
    </html>
  );
}
