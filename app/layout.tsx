import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rove — Your personal wardrobe",
  description: "Clean, organize, browse, and style your personal wardrobe.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/fonts/anton-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body className="antialiased">
        {children}
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
