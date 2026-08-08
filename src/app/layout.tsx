import type { Metadata, Viewport } from "next";
// Removed next/font/google to test if it's causing the hang
// const poppins = ...
// const inter = ...
import { CartProvider } from "@/features/cart/CartContext";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#800020",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  title: "Bikaji - QR Smart Ordering System",
  description: "Enterprise-grade digital dining and instant ordering for Bikaji Premium Indian Dining.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Bikaji Dining",
  },
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/apple-touch-icon.png",
  },
  formatDetection: {
    telephone: false,
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
      className={`h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <CartProvider>
          {children}
          <PWAInstallPrompt />
        </CartProvider>
      </body>
    </html>
  );
}
