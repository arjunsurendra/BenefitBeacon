import type { NextConfig } from "next";

// Stable ID for the unpacked Beacon Benefit extension on this demo machine.
// Vinext validates the origin hostname separately from Vite's CORS middleware.
const beaconExtensionId =
  process.env.BENEFITBEACON_EXTENSION_ID ?? "plomaimococndcdnfdkndpljkchddkfg";

const nextConfig: NextConfig = {
  allowedDevOrigins: [beaconExtensionId],
};

export default nextConfig;
