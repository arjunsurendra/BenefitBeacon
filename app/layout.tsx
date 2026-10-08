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
    title: "BenefitBeacon — Local benefits, clearly explained",
    description: "Discover verified Sunnyvale, Santa Clara County, California, and federal benefits with private AI-assisted intake and auditable eligibility rules.",
    applicationName: "BenefitBeacon",
    manifest: "/manifest.webmanifest",
    icons: { icon: "/og.png", apple: "/og.png" },
    openGraph: {
      title: "BenefitBeacon",
      description: "AI explains. Rules decide. Find verified benefits you may qualify for.",
      type: "website",
      url: origin,
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "BenefitBeacon — AI explains. Rules decide." }],
    },
    twitter: { card: "summary_large_image", title: "BenefitBeacon", description: "AI explains. Rules decide.", images: [`${origin}/og.png`] },
  };
}

export const viewport: Viewport = { themeColor: "#173c35", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
