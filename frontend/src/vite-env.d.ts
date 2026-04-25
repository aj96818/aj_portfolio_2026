/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VARIANT?: string;
  readonly VITE_DATA_SOURCE?: "static_json" | "postgres_api" | "llm_api";
  readonly VITE_FEATURE_FULL_DATA?: string;
  readonly VITE_FEATURE_LLM?: string;
  readonly VITE_FEATURE_STRIPE?: string;
  readonly VITE_BASE_PATH?: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.css";
declare module "plotly.js-dist-min";
declare module "react-plotly.js/factory.js";
