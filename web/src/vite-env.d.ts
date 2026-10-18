/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * 可选：主控接入的街道底图样式地址（MapLibre style JSON URL）。
   * 未配置时使用本地行政区矢量底图，只绘制中国范围。
   */
  readonly VITE_MAP_STYLE_URL?: string;
  /** 可选：底图样式加载失败时使用的备用样式地址。 */
  readonly VITE_MAP_STYLE_FALLBACK_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
