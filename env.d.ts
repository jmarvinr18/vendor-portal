/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API base URL. Defaults to `/api/v1`, served through the Vite / nginx proxy. */
  readonly VITE_APP_API_URL?: string
  /** Sent as X-Vendor-Id until real authentication exists. Development only. */
  readonly VITE_VENDOR_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
