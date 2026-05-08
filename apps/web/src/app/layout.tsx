import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { GTProvider } from "gt-next";
import { RootProvider } from "fumadocs-ui/provider/next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/query-provider";
import "./globals.css";

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
  title: "open-voucherify",
  description: "Self-hostable open-source promotion engine",
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
          <RootProvider>
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
