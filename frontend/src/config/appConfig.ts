type DataSource = "static_json" | "postgres_api" | "llm_api";

const readBooleanFlag = (value: string | undefined, fallback = false) => {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
};

const normalizeBasePath = (value: string) => (value.endsWith("/") ? value : `${value}/`);

export const appConfig = {
  appVariant: import.meta.env.VITE_APP_VARIANT ?? "demo_static",
  dataSource: (import.meta.env.VITE_DATA_SOURCE ?? "static_json") as DataSource,
  basePath: normalizeBasePath(import.meta.env.BASE_URL),
  features: {
    fullTickerUniverse: readBooleanFlag(import.meta.env.VITE_FEATURE_FULL_DATA),
    llmAskData: readBooleanFlag(import.meta.env.VITE_FEATURE_LLM),
    stripeDownloads: readBooleanFlag(import.meta.env.VITE_FEATURE_STRIPE)
  }
};

export function publicAssetPath(path: string) {
  return `${appConfig.basePath}${path.replace(/^\/+/, "")}`;
}
