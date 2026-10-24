const beaconExtensionId =
  process.env.BENEFITBEACON_EXTENSION_ID ?? "plomaimococndcdnfdkndpljkchddkfg";

const beaconExtensionOrigin = `chrome-extension://${beaconExtensionId}`;

function isBeaconExtension(request: Request): boolean {
  return request.headers.get("origin") === beaconExtensionOrigin;
}

export function withExtensionCors(request: Request, response: Response): Response {
  if (!isBeaconExtension(request)) return response;
  response.headers.set("Access-Control-Allow-Origin", beaconExtensionOrigin);
  response.headers.append("Vary", "Origin");
  return response;
}

export function extensionPreflight(request: Request): Response {
  if (!isBeaconExtension(request)) {
    return new Response("Forbidden", { status: 403 });
  }
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": beaconExtensionOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    },
  });
}
