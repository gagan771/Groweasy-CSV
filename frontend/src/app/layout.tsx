import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ThemeToggle from "@/components/ThemeToggle";
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
  title: "GrowEasy CSV Importer",
  description: "AI-powered CSV import tool for GrowEasy CRM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100" suppressHydrationWarning>
        {/* Top nav bar with theme toggle */}
        <nav className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/80 px-6 py-3 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-950/80">
          <span className="text-sm font-semibold tracking-tight text-gray-700 dark:text-gray-300">
            GrowEasy CSV Importer
          </span>
          <ThemeToggle />
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
