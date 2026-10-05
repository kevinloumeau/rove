import type { Metadata, Viewport } from "next";
import { ServiceWorker } from "@/components/service-worker";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rove — Your personal wardrobe",
  description: "Clean, organize, browse, and style your personal wardrobe.",
  applicationName: "Rove",
  appleWebApp: { capable: true, title: "Rove", statusBarStyle: "default" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  // Older iOS versions read this instead of the manifest's display mode.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f3" },
    { media: "(prefers-color-scheme: dark)", color: "#121411" },
  ],
};

// Mirrors the OS color scheme onto <html class="dark"> before first paint, for components that
// style themselves with the `.dark` class rather than the media query.
const colorSchemeScript = `(()=>{try{const m=matchMedia("(prefers-color-scheme: dark)");const s=()=>document.documentElement.classList.toggle("dark",m.matches);s();m.addEventListener("change",s)}catch{}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: colorSchemeScript }} />
        {/* Sent with credentials so the manifest loads through Cloudflare Access. */}
        <link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" />
        <link rel="preload" href="/fonts/anton-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body className="antialiased">
        {children}
        <Toaster position="bottom-center" />
        <ServiceWorker />
      </body>
    </html>
  );
}
