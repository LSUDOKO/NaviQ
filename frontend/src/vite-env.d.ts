/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the deployed backend, e.g. https://naviq-api.up.railway.app. Unset in local dev. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
