// Global type definitions for missing modules

declare module "virtual:pwa-register" {
  export function registerSW(options?: unknown): unknown;
}

// Global environment variables
declare module "@env" {
  export const VITE_CONNECT_BASE_URL: string;
  export const VITE_MAPBOX_API_KEY: string;
  export const VITE_STRIPE_PRICE_ID_MONTHLY: string;
  export const VITE_STRIPE_PRICE_ID_ANNUAL: string;
}

interface ImportMetaEnv {
  readonly VITE_CONNECT_BASE_URL?: string;
  readonly VITE_MAPBOX_API_KEY?: string;
  readonly VITE_STRIPE_PRICE_ID_MONTHLY?: string;
  readonly VITE_STRIPE_PRICE_ID_ANNUAL?: string;
  /** 3D mascot model URL (BRD-001). Set by the beta deployment only; empty = off. */
  readonly VITE_MASCOT_3D_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Utility types for the project
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// JSX namespace for SolidJS
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: unknown;
  }
}

export {};
