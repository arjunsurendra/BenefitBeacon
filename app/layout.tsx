import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    metadataBase: new URL(origin),
    title: "BenefitBeacon — Your Sunnyvale benefits guide",
    description: "Talk with BenefitBeacon to find Sunnyvale benefit programs, understand your options, and take the next step.",
    applicationName: "BenefitBeacon",
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [{ url: "/benefitbeacon-logo-v1-64.png", sizes: "64x64", type: "image/png" }],
      apple: [{ url: "/benefitbeacon-logo-v1-192.png", sizes: "192x192", type: "image/png" }],
    },
    openGraph: {
      title: "BenefitBeacon",
      description: "A conversational guide to benefits available to Sunnyvale residents.",
      type: "website",
      url: origin,
      images: [{ url: `${origin}/og-sunnyvale-guide.png`, width: 1730, height: 909, alt: "BenefitBeacon — your Sunnyvale benefits guide." }],
    },
    twitter: { card: "summary_large_image", title: "BenefitBeacon", description: "Your Sunnyvale benefits guide.", images: [`${origin}/og-sunnyvale-guide.png`] },
  };
}

export const viewport: Viewport = { themeColor: "#17212b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
