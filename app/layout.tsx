import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rove — Your personal wardrobe",
  description: "Clean, organize, browse, and style your personal wardrobe.",
  other: {
    "codex-preview": "development",
  },
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
