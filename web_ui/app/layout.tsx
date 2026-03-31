import "./globals.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NexusSite AI",
  description: "AI-powered site building platform",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900">{children}</body>
    </html>
  );
}
