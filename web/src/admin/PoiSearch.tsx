import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api";
import type { PoiCandidate } from "../types";
import { Field, FormAlert } from "./FormBits";
import { Spinner } from "../components/Spinner";

export function PoiSearch({ cityCode, cityName, initialQuery, disabled, onSelect, onCityCenter, onUnauthorized }: {
  cityCode: string;
  cityName: string;
  initialQuery: string;
  disabled: boolean;
  onSelect: (poi: PoiCandidate) => void;
  onCityCenter?: () => void;
  onUnauthorized: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<PoiCandidate[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  const search = async () => {
    if (!cityCode || !query.trim() || loading || disabled) return;
    const request = new AbortController();
    controller.current?.abort();
    controller.current = request;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const response = await api.searchPoi(query.trim(), cityCode, request.signal);
      if (!request.signal.aborted) setResults(response.places);
    } catch (reason) {
      if (request.signal.aborted) return;
      if (reason instanceof ApiError && reason.status === 401) onUnauthorized();
      else setError(reason instanceof Error ? reason.message : "地点搜索失败，请重试");
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  };

  return (
    <div className="poi-search">
      <Field htmlFor="poi-keywords" label="搜索具体地点" hint={cityCode ? `搜索范围：${cityName}` : "先选择省份和城市"}>
        <div className="poi-search__input">
          <input id="poi-keywords" value={query} maxLength={80} disabled={disabled || !cityCode}
            placeholder="输入景点、餐厅或地址"
            onChange={(event) => {
              controller.current?.abort();
              setLoading(false);
              setQuery(event.target.value);
              setResults(null);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void search();
              }
            }} />
          <button className="btn btn--soft" type="button" disabled={disabled || !cityCode || !query.trim() || loading}
            onClick={() => void search()}>
            {loading ? <Spinner size={14} label="正在搜索" /> : null}
            {loading ? "搜索中" : "搜索"}
          </button>
        </div>
      </Field>
      <div aria-live="polite">
        {error ? <FormAlert message={error} /> : null}
        {results?.length === 0 ? <p className="field__hint">没有找到匹配地点，请换个关键词，或使用城市中心。</p> : null}
        {selected ? <p className="field__hint">已选择：{selected}</p> : null}
      </div>
      {results && results.length > 0 ? (
        <ul className="poi-search__results" aria-label="候选地点">
          {results.map((poi) => (
            <li key={poi.id}>
              <button type="button" disabled={disabled} onClick={() => {
                onSelect(poi);
                setSelected(poi.name);
                setResults(null);
              }}>
                <strong>{poi.name}</strong>
                <span>{[poi.district, poi.address].filter(Boolean).join(" · ") || cityName}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {onCityCenter ? <button className="btn btn--ghost btn--sm" type="button" disabled={disabled}
        onClick={() => { onCityCenter(); setSelected("城市中心"); }}>使用城市中心</button> : null}
      <p className="field__hint">地点数据 © 高德地图</p>
    </div>
  );
}
