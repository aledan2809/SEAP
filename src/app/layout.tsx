import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ClientToaster } from "@/components/client-toaster";
import { SEAPConsentGate } from "@/components/consent/SEAPConsentGate";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SEAP Assistant - Monitorizare Licitații",
  description: "Aplicație pentru monitorizarea și analiza licitațiilor de pe SEAP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md">
          Sari la conținut
        </a>
        <ThemeProvider>
          {children}
          <ClientToaster />
          <SEAPConsentGate />
        </ThemeProvider>
      </body>
    </html>
  );
}
