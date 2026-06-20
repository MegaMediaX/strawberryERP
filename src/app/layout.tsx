import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted (vendored woff2) so production image builds never fetch Google
// Fonts — that network call fails on locked-down VPS/CI builds.
const sans = localFont({
  src: "./fonts/plus-jakarta-sans.woff2",
  variable: "--font-geist-sans",
  display: "swap",
  weight: "200 800",
});

const mono = localFont({
  src: "./fonts/jetbrains-mono.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  weight: "100 800",
});

export const metadata: Metadata = {
  title: "LebTech Partner Platform",
  description: "White-label reseller CRM, invoicing, commissions, and communication platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
