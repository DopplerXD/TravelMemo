import { useMemo, useState } from "react";
import { api, ApiError } from "../api";
import type { Place, RouteCity, Trip } from "../types";
import {
  loadCities,
  normalizeAdcode,
  normalizeCenter,
  provinceCodeOfPlace,
} from "../lib/geo";
import { useCities, useProvinces } from "../lib/useGeo";
import { Modal } from "../components/Modal";
import { Spinner } from "../components/Spinner";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  MapPinIcon,
  PlusIcon,
  RouteIcon,
  TrashIcon,
} from "../icons";
import { Field, FormAlert, FormSection } from "./FormBits";

interface PlaceCityOption {
  key: string;
  name: string;
  place: Place;
}

interface CityOption {
  code: string;
  name: string;
  center: [number, number] | null;
}

function routeKey(name: string): string {
  return name.trim().toLowerCase();
}

export function TripEditor({
  trip,
  places,
  onClose,
  onSaved,
  onUnauthorized,
}: {
  trip: Trip | null;
  places: Place[];
  onClose: () => void;
  onSaved: () => void;
  onUnauthorized: () => void;
}) {
  const [title, setTitle] = useState(trip?.title ?? "");
  const [description, setDescription] = useState(trip?.description ?? "");
  const [route, setRoute] = useState<RouteCity[]>(trip?.cityRoute ?? []);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [placeCityKey, setPlaceCityKey] = useState("");
  const [addingPlaceCity, setAddingPlaceCity] = useState(false);
  const [provinceCode, setProvinceCode] = useState("");
  const [cityCode, setCityCode] = useState("");
  const provinces = useProvinces();
  const cities = useCities(provinceCode);

  const placeCityOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: PlaceCityOption[] = [];
    for (const place of places) {
      const name = place.city || place.province || place.name;
      const key = `${place.cityCode || place.provinceCode || "place"}-${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({ key, name, place });
    }
    return options.sort((first, second) => first.name.localeCompare(second.name, "zh-CN"));
  }, [places]);

  const provinceOptions = useMemo(
    () =>
      (provinces.data?.features ?? [])
        .map((feature) => ({
          code: normalizeAdcode(feature.properties?.adcode),
          name: String(feature.properties?.name ?? ""),
        }))
        .filter((option) => Boolean(option.code) && Boolean(option.name))
        .sort((first, second) => first.code.localeCompare(second.code)),
    [provinces.data],
  );

  const cityOptions = useMemo<CityOption[]>(
    () =>
      (cities.data?.features ?? [])
        .map((feature) => ({
          code: normalizeAdcode(feature.properties?.adcode),
          name: String(feature.properties?.name ?? ""),
          center: normalizeCenter(feature.properties, feature),
        }))
        .filter((option) => Boolean(option.code) && Boolean(option.name)),
    [cities.data],
  );

  const selectedProvince = provinceOptions.find((option) => option.code === provinceCode);
  const selectedCity = cityOptions.find((option) => option.code === cityCode);

  const addCity = (city: RouteCity): void => {
    setRoute((current) => {
      if (current.some((item) => routeKey(item.name) === routeKey(city.name))) {
        setRouteError(`「${city.name}」已经在连线中`);
        return current;
      }
      setRouteError(null);
      return [...current, city];
    });
  };

  const addFromPlace = async (): Promise<void> => {
    const option = placeCityOptions.find((item) => item.key === placeCityKey);
    if (!option) {
      setRouteError("请选择一个已有地点");
      return;
    }
    setAddingPlaceCity(true);
    setRouteError(null);
    const place = option.place;
    let cityCenter: [number, number] | null = null;
    try {
      const collection = await loadCities(provinceCodeOfPlace(place));
      const code = normalizeAdcode(place.cityCode);
      const feature = collection.features.find(
        (item) => normalizeAdcode(item.properties?.adcode) === code,
      );
      if (feature) cityCenter = normalizeCenter(feature.properties, feature);
    } catch {
      cityCenter = null;
    }
    addCity({
      name: option.name,
      lng: cityCenter ? cityCenter[0] : place.lng,
      lat: cityCenter ? cityCenter[1] : place.lat,
    });
    setPlaceCityKey("");
    setAddingPlaceCity(false);
  };

  const addFromAdministrative = (): void => {
    if (!selectedProvince) {
      setRouteError("先选择省份");
      return;
    }
    if (!selectedCity) {
      setRouteError("再选择城市");
      return;
    }
    if (!selectedCity.center) {
      setRouteError("这个城市缺少中心点，请改用已有地点添加");
      return;
    }
    addCity({
      name: selectedCity.name,
      lng: selectedCity.center[0],
      lat: selectedCity.center[1],
    });
    setCityCode("");
  };

  const moveCity = (index: number, direction: -1 | 1): void => {
    setRoute((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      if (!item) return current;
      next.splice(target, 0, item);
      return next;
    });
  };

  const save = async (): Promise<void> => {
    if (saving) return;
    setSubmitError(null);
    if (!title.trim()) {
      setTitleError("给这次旅行一个名字");
      return;
    }
    setSaving(true);
    const payload: Omit<Trip, "id"> = {
      title: title.trim(),
      description,
      cityRoute: route,
    };
    try {
      if (trip) {
        await api.updateTrip(trip.id, payload);
      } else {
        await api.createTrip(payload);
      }
      onSaved();
    } catch (reason: unknown) {
      if (reason instanceof ApiError && reason.status === 401) {
        onUnauthorized();
        return;
      }
      setSubmitError(reason instanceof ApiError ? reason.message : "保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      closeDisabled={saving}
      footer={
        <>
          <span className="modal__footer-note">
            {saving ? "正在保存…" : "城市连线为可选项，不影响简记浏览"}
          </span>
          <button className="btn btn--ghost" disabled={saving} onClick={onClose} type="button">
            取消
          </button>
          <button className="btn btn--primary" disabled={saving} onClick={() => void save()} type="button">
            {saving ? <Spinner size={16} label="正在保存" /> : null}
            {saving ? "正在保存" : trip ? "保存修改" : "创建旅行"}
          </button>
        </>
      }
      onClose={onClose}
      open
      size="lg"
      subtitle="旅行用于归组简记，也可以按顺序连接城市。"
      title={trip ? "编辑旅行" : "新建旅行"}
    >
      <div className="editor-form">
        {submitError ? <FormAlert message={submitError} /> : null}
        <div className="form-grid">
          <Field error={titleError ?? undefined} htmlFor="trip-title" label="旅行名称" required wide>
            <input
              autoFocus
              id="trip-title"
              maxLength={100}
              onChange={(event) => {
                setTitle(event.target.value);
                if (titleError) setTitleError(null);
              }}
              placeholder="例如：2026 江南旅行"
              value={title}
            />
          </Field>
          <Field htmlFor="trip-description" label="一段简介" wide>
            <textarea
              id="trip-description"
              maxLength={500}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="为什么出发、和谁一起，或者这次旅行的主题。"
              rows={3}
              value={description}
            />
          </Field>
        </div>

        <FormSection
          aside={
            <span className="form-section__count">
              {route.length > 0 ? `${route.length} 座城市` : "未配置"}
            </span>
          }
          description="按到达顺序添加城市；公开地图只会在筛选或选中该旅行时显示路线。"
          title="城市连线"
        >
          <div className="route-adders">
            <div className="route-adder">
              <label className="route-adder__label" htmlFor="route-place-city">
                <MapPinIcon />
                从已有地点添加
              </label>
              <div className="route-adder__row">
                <select
                  disabled={placeCityOptions.length === 0 || addingPlaceCity}
                  id="route-place-city"
                  onChange={(event) => setPlaceCityKey(event.target.value)}
                  value={placeCityKey}
                >
                  <option value="">
                    {placeCityOptions.length === 0 ? "还没有地点" : "选择地点所在城市"}
                  </option>
                  {placeCityOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.name} · {option.place.province}
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn--soft btn--sm"
                  disabled={!placeCityKey || addingPlaceCity}
                  onClick={() => void addFromPlace()}
                  type="button"
                >
                  {addingPlaceCity ? <Spinner size={14} label="正在添加" /> : <PlusIcon />}
                  添加
                </button>
              </div>
            </div>

            <div className="route-adder">
              <label className="route-adder__label" htmlFor="route-province">
                <RouteIcon />
                从行政区添加
              </label>
              <div className="route-adder__row route-adder__row--three">
                <select
                  disabled={provinces.loading || Boolean(provinces.error)}
                  id="route-province"
                  onChange={(event) => {
                    setProvinceCode(event.target.value);
                    setCityCode("");
                  }}
                  value={provinceCode}
                >
                  <option value="">{provinces.loading ? "加载省份…" : "选择省份"}</option>
                  {provinceOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.name}
                    </option>
                  ))}
                </select>
                <select
                  disabled={!provinceCode || cities.loading}
                  onChange={(event) => setCityCode(event.target.value)}
                  value={cityCode}
                >
                  <option value="">
                    {!provinceCode ? "先选省份" : cities.loading ? "加载城市…" : "选择城市"}
                  </option>
                  {cityOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.name}
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn--soft btn--sm"
                  disabled={!selectedCity || cities.loading}
                  onClick={addFromAdministrative}
                  type="button"
                >
                  <PlusIcon />
                  添加
                </button>
              </div>
              {provinces.error ? (
                <div className="route-adder__error">
                  <span>{provinces.error}</span>
                  <button className="text-btn" onClick={provinces.retry} type="button">
                    重试
                  </button>
                </div>
              ) : null}
              {cities.error ? (
                <div className="route-adder__error">
                  <span>{cities.error}</span>
                  <button className="text-btn" onClick={cities.retry} type="button">
                    重试
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {routeError ? <FormAlert message={routeError} /> : null}

          {route.length === 0 ? (
            <div className="route-empty">
              <RouteIcon />
              <div>
                <strong>还没有城市连线</strong>
                <p>不配置也可以保存。需要时再回来按顺序添加城市。</p>
              </div>
            </div>
          ) : (
            <ol className="route-list">
              {route.map((city, index) => (
                <li className="route-item" key={`${city.name}-${index}`}>
                  <span className="route-item__order">{index + 1}</span>
                  <span className="route-item__body">
                    <strong>{city.name}</strong>
                    <span>
                      {city.lng.toFixed(4)}, {city.lat.toFixed(4)}
                    </span>
                  </span>
                  <span className="route-item__actions">
                    <button
                      aria-label="城市上移"
                      className="icon-btn icon-btn--sm"
                      disabled={index === 0}
                      onClick={() => moveCity(index, -1)}
                      title="上移"
                      type="button"
                    >
                      <ArrowUpIcon />
                    </button>
                    <button
                      aria-label="城市下移"
                      className="icon-btn icon-btn--sm"
                      disabled={index === route.length - 1}
                      onClick={() => moveCity(index, 1)}
                      title="下移"
                      type="button"
                    >
                      <ArrowDownIcon />
                    </button>
                    <button
                      aria-label="移除城市"
                      className="icon-btn icon-btn--sm icon-btn--danger"
                      onClick={() =>
                        setRoute((current) => current.filter((_, itemIndex) => itemIndex !== index))
                      }
                      title="移除"
                      type="button"
                    >
                      <TrashIcon />
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </FormSection>
      </div>
    </Modal>
  );
}
