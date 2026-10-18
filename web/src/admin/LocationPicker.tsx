import { Map as MapLibreMap, Marker, type MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { loadProvinces, normalizeAdcode } from "../lib/geo";
import { CHINA_MAX_BOUNDS, CHINA_VIEW_BOUNDS, LOCAL_STYLE, MAP_STYLE_URL } from "../map/mapStyle";
import { Modal } from "../components/Modal";

function PickerMap({
  initial,
  onPick,
}: {
  initial?: { lng: number; lat: number } | null;
  onPick: (coords: { lng: number; lat: number }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = new MapLibreMap({
      container,
      style: MAP_STYLE_URL || LOCAL_STYLE,
      center: initial ? [initial.lng, initial.lat] : [104.2, 35.6],
      zoom: initial ? 9.5 : 3.6,
      minZoom: 2.8,
      maxZoom: 18,
      maxBounds: CHINA_MAX_BOUNDS,
      renderWorldCopies: false,
      attributionControl: MAP_STYLE_URL ? { compact: true } : false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    mapRef.current = map;

    map.on("style.load", () => {
      if (!map.getSource("picker-provinces")) {
        loadProvinces()
          .then((collection) => {
            if (!mapRef.current || map.getSource("picker-provinces")) return;
            map.addSource("picker-provinces", {
              type: "geojson",
              data: {
                type: "FeatureCollection",
                features: collection.features.map((feature) => ({
                  ...feature,
                  properties: {
                    ...feature.properties,
                    adcode: normalizeAdcode(feature.properties?.adcode),
                  },
                })),
              },
            });
            map.addLayer({
              id: "picker-provinces-fill",
              type: "fill",
              source: "picker-provinces",
              paint: { "fill-color": "#f8f7f5", "fill-opacity": 0.88 },
            });
            map.addLayer({
              id: "picker-provinces-line",
              type: "line",
              source: "picker-provinces",
              paint: { "line-color": "#c6d0dd", "line-width": 0.8 },
            });
          })
          .catch(() => {
            // Coordinates can still be picked on the blank background.
          });
      }
    });

    if (!initial) {
      map.fitBounds(CHINA_VIEW_BOUNDS, {
        padding: 30,
        duration: 0,
        maxZoom: 4.8,
      });
    }

    if (initial) {
      const element = document.createElement("div");
      element.className = "picker-marker";
      markerRef.current = new Marker({ element, anchor: "center" })
        .setLngLat([initial.lng, initial.lat])
        .addTo(map);
    }

    map.on("click", (event: MapMouseEvent) => {
      const { lng, lat } = event.lngLat;
      onPick({ lng, lat });
      if (!markerRef.current) {
        const element = document.createElement("div");
        element.className = "picker-marker";
        markerRef.current = new Marker({ element, anchor: "center" })
          .setLngLat([lng, lat])
          .addTo(map);
      } else {
        markerRef.current.setLngLat([lng, lat]);
      }
    });

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // The picker is mounted per dialog opening; initial is intentionally captured once.
  }, []);

  return <div className="picker-map" ref={containerRef} />;
}

export function LocationPicker({
  open,
  initial,
  onClose,
  onConfirm,
}: {
  open: boolean;
  initial?: { lng: number; lat: number } | null;
  onClose: () => void;
  onConfirm: (coords: { lng: number; lat: number }) => void;
}) {
  const [coords, setCoords] = useState<{ lng: number; lat: number } | null>(initial ?? null);

  return (
    <Modal
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose} type="button">
            取消
          </button>
          <button
            className="btn btn--primary"
            disabled={!coords}
            onClick={() => {
              if (coords) onConfirm(coords);
            }}
            type="button"
          >
            使用此位置
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      size="lg"
      subtitle="点击地图定位，坐标采用 WGS84。"
      title="在地图上选点"
    >
      <div className="picker">
        <PickerMap initial={initial} onPick={setCoords} />
        <div className="picker__readout">
          <span>经度</span>
          <strong>{coords ? coords.lng.toFixed(6) : "—"}</strong>
          <span>纬度</span>
          <strong>{coords ? coords.lat.toFixed(6) : "—"}</strong>
        </div>
        <p className="picker__hint">滚轮缩放地图，单击放置标点。确定后仍可在表单中微调经纬度。</p>
      </div>
    </Modal>
  );
}
