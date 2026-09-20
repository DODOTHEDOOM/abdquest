/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "public" selects the public edition; anything else is the personal one. */
  readonly VITE_EDITION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
