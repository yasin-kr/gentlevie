const configuredUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
const deploymentHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;

export const siteUrl = new URL(configuredUrl || (deploymentHost ? `https://${deploymentHost}` : "http://localhost:3000")).origin;
export const siteName = "GentleVie";
export const siteDescription = "Stil, yaşam ve gündelik ritüeller üzerine bağımsız bir editoryal bakış. Hayatı biraz yavaşlat.";
export const isPublicProduction = process.env.VERCEL_ENV === "production" || (!process.env.VERCEL_ENV && Boolean(configuredUrl) && new URL(siteUrl).hostname !== "localhost");
