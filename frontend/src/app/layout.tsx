import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import AppRouteShell from "@/components/AppRouteShell";
import GlobalLumaErrorSuppressor from "@/components/GlobalLumaErrorSuppressor";

export const metadata: Metadata = {
  title: "gigHood | AI Income Protection for Gig Workers",
  description:
    "Parametric income protection platform with project website, worker app, and admin surface.",
  icons: {
    icon: "/icon.jpg?v=3",
    shortcut: "/icon.jpg?v=3",
    apple: "/icon.jpg?v=3",
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body suppressHydrationWarning>
        <GlobalLumaErrorSuppressor />
        <div className="app-glow" />
        <Providers>
          <AppRouteShell>{children}</AppRouteShell>
        </Providers>
      </body>
    </html>
  );
}
