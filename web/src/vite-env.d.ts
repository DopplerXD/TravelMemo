/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * 可选：MapLibre style JSON 地址。未配置时使用本地行政区视图，
   * 并按 /api/map-config 返回的栅格底图叠加街道层级。
   */
  readonly VITE_MAP_STYLE_URL?: string;
  /** 可选：底图样式加载失败时使用的备用样式地址。 */
  readonly VITE_MAP_STYLE_FALLBACK_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
