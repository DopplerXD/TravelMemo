import type { LngLatBoundsLike, StyleSpecification } from "maplibre-gl";

export const CHINA_VIEW_BOUNDS: LngLatBoundsLike = [
  [73.2, 18.1],
  [135.2, 53.7],
];

export const CHINA_MAX_BOUNDS: LngLatBoundsLike = [
  [69, 2],
  [140, 56],
];

/**
 * 主控后续可配置 VITE_MAP_STYLE_URL 接入街道底图。
 * 未配置时只使用本地行政区矢量数据，不请求任何远程底图或图片。
 */
export const MAP_STYLE_URL = (import.meta.env.VITE_MAP_STYLE_URL ?? "").trim();

export const LOCAL_STYLE: StyleSpecification = {
  version: 8,
  name: "TravelMemo · 本地行政区底图",
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#e8eef4" },
    },
  ],
};
