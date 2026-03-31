import "./globals.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NexusSite-AI Demo",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="text-gray-900 antialiased">
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
