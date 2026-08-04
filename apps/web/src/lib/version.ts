const DOCS_ORIGIN = "https://offerkit.dev/docs";

export function getOfferKitVersion() {
  return process.env["OFFERKIT_VERSION"]?.trim() || "edge";
}

export function docsUrlForVersion(version: string | undefined) {
  const normalized = version?.trim();
  if (!normalized || normalized === "edge" || normalized === "main" || normalized === "next") {
    return `${DOCS_ORIGIN}/next`;
  }

  const stable = normalized.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!stable) return DOCS_ORIGIN;

  return `${DOCS_ORIGIN}/v/${stable[1]}.${stable[2]}`;
}
