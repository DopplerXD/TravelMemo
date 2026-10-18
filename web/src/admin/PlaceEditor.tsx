import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api";
import type { Place } from "../types";
import {
  normalizeAdcode,
  normalizeCenter,
  type AdministrativeCollection,
} from "../lib/geo";
import { useCities, useProvinces } from "../lib/useGeo";
import { Modal } from "../components/Modal";
import { Spinner } from "../components/Spinner";
import { MapPinIcon } from "../icons";
import { Field, FormAlert } from "./FormBits";
import { LocationPicker } from "./LocationPicker";

interface Option {
  code: string;
  name: string;
  center: [number, number] | null;
}

function toOptions(collection: AdministrativeCollection | null): Option[] {
  if (!collection) return [];
  return collection.features
    .map((feature) => ({
      code: normalizeAdcode(feature.properties?.adcode),
      name: String(feature.properties?.name ?? ""),
      center: normalizeCenter(feature.properties, feature),
    }))
    .filter((option) => Boolean(option.code) && Boolean(option.name))
    .sort((first, second) => first.code.localeCompare(second.code));
}

interface PlaceEditorProps {
  place: Place | null;
  onClose: () => void;
  onSaved: () => void;
  onUnauthorized: () => void;
}

interface PlaceErrors {
  name?: string;
  provinceCode?: string;
  province?: string;
  cityCode?: string;
  city?: string;
  lng?: string;
  lat?: string;
}

export function PlaceEditor({ place, onClose, onSaved, onUnauthorized }: PlaceEditorProps) {
  const provinces = useProvinces();
  const [provinceCode, setProvinceCode] = useState(place?.provinceCode ?? "");
  const cities = useCities(provinceCode);
  const [name, setName] = useState(place?.name ?? "");
  const [provinceName, setProvinceName] = useState(place?.province ?? "");
  const [cityCode, setCityCode] = useState(place?.cityCode ?? "");
  const [cityName, setCityName] = useState(place?.city ?? "");
  const [lng, setLng] = useState(place ? String(place.lng) : "");
  const [lat, setLat] = useState(place ? String(place.lat) : "");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<PlaceErrors>({});
  const [pickerOpen, setPickerOpen] = useState(false);

  const provinceOptions = useMemo(() => toOptions(provinces.data), [provinces.data]);
  const cityOptions = useMemo(() => toOptions(cities.data), [cities.data]);
  const provinceFallback = Boolean(provinces.error) || (!provinces.loading && !provinces.data);
  const cityFallback = Boolean(cities.error) || (!cities.loading && !cities.data && Boolean(provinceCode));

  useEffect(() => {
    if (!provinceCode || !provinceOptions.length) return;
    const option = provinceOptions.find((item) => item.code === provinceCode);
    if (option) setProvinceName(option.name);
  }, [provinceCode, provinceOptions]);

  useEffect(() => {
    if (!cityCode || !cityOptions.length) return;
    const option = cityOptions.find((item) => item.code === cityCode);
    if (option) setCityName(option.name);
  }, [cityCode, cityOptions]);

  useEffect(() => {
    if (!cities.data || cityCode || cityOptions.length !== 1) return;
    const only = cityOptions[0];
    if (!only) return;
    setCityCode(only.code);
    setCityName(only.name);
    if (only.center && !lng && !lat) {
      setLng(only.center[0].toFixed(6));
      setLat(only.center[1].toFixed(6));
    }
  }, [cities.data, cityCode, cityOptions, lat, lng]);

  const chooseProvince = (code: string): void => {
    setProvinceCode(code);
    const option = provinceOptions.find((item) => item.code === code);
    setProvinceName(option?.name ?? "");
    setCityCode("");
    setCityName("");
    setErrors((current) => ({ ...current, provinceCode: undefined, province: undefined }));
  };

  const chooseCity = (code: string): void => {
    setCityCode(code);
    const option = cityOptions.find((item) => item.code === code);
    setCityName(option?.name ?? "");
    if (option?.center && (!lng || !lat)) {
      setLng(option.center[0].toFixed(6));
      setLat(option.center[1].toFixed(6));
    }
    setErrors((current) => ({ ...current, cityCode: undefined, city: undefined }));
  };

  const useCityCenter = (): void => {
    const option = cityOptions.find((item) => item.code === cityCode);
    if (!option?.center) return;
    setLng(option.center[0].toFixed(6));
    setLat(option.center[1].toFixed(6));
  };

  const validate = (): boolean => {
    const next: PlaceErrors = {};
    if (!name.trim()) next.name = "填写地点名称";
    if (!/^\d{6}$/.test(provinceCode)) next.provinceCode = "省份代码应为六位数字";
    if (!provinceName.trim()) next.province = "请选择或填写省份";
    if (!/^\d{6}$/.test(cityCode)) next.cityCode = "城市代码应为六位数字";
    if (!cityName.trim()) next.city = "请选择或填写城市";
    const lngNumber = Number(lng);
    const latNumber = Number(lat);
    if (!Number.isFinite(lngNumber) || lngNumber < 70 || lngNumber > 140) {
      next.lng = "经度应在 70 到 140 之间";
    }
    if (!Number.isFinite(latNumber) || latNumber < 0 || latNumber > 56) {
      next.lat = "纬度应在 0 到 56 之间";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async (): Promise<void> => {
    if (saving) return;
    setSubmitError(null);
    if (!validate()) return;
    setSaving(true);
    const payload: Omit<Place, "id"> = {
      name: name.trim(),
      province: provinceName.trim(),
      provinceCode,
      city: cityName.trim(),
      cityCode,
      lng: Number(lng),
      lat: Number(lat),
    };
    try {
      if (place) {
        await api.updatePlace(place.id, payload);
      } else {
        await api.createPlace(payload);
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

  const canUsePicker = Number.isFinite(Number(lng)) && Number.isFinite(Number(lat));

  return (
    <Modal
      closeDisabled={saving}
      footer={
        <>
          <span className="modal__footer-note">
            {saving ? "正在保存…" : "地点可被多条简记重复使用"}
          </span>
          <button className="btn btn--ghost" disabled={saving} onClick={onClose} type="button">
            取消
          </button>
          <button className="btn btn--primary" disabled={saving} onClick={() => void save()} type="button">
            {saving ? <Spinner size={16} label="正在保存" /> : null}
            {saving ? "正在保存" : place ? "保存修改" : "创建地点"}
          </button>
        </>
      }
      onClose={onClose}
      open
      size="lg"
      subtitle="省市代码来自本地行政区数据，坐标使用 WGS84。"
      title={place ? "编辑地点" : "新建地点"}
    >
      <div className="editor-form">
        {submitError ? <FormAlert message={submitError} /> : null}

        <div className="form-grid">
          <Field error={errors.name} htmlFor="place-name" label="地点名称" required wide>
            <input
              autoFocus
              id="place-name"
              maxLength={100}
              onChange={(event) => {
                setName(event.target.value);
                if (errors.name) setErrors((current) => ({ ...current, name: undefined }));
              }}
              placeholder="例如：玄武湖公园"
              value={name}
            />
          </Field>

          {provinceFallback ? (
            <>
              <Field error={errors.province} htmlFor="place-province-name" label="省份名称" required>
                <input
                  id="place-province-name"
                  onChange={(event) => setProvinceName(event.target.value)}
                  placeholder="例如：江苏省"
                  value={provinceName}
                />
              </Field>
              <Field
                error={errors.provinceCode}
                htmlFor="place-province-code"
                hint="六位行政区代码"
                label="省份代码"
                required
              >
                <input
                  id="place-province-code"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setProvinceCode(event.target.value.replace(/\D/g, ""))}
                  placeholder="320000"
                  value={provinceCode}
                />
              </Field>
            </>
          ) : (
            <Field
              error={errors.provinceCode ?? errors.province}
              htmlFor="place-province"
              label="省份"
              required
            >
              <select
                disabled={provinces.loading}
                id="place-province"
                onChange={(event) => chooseProvince(event.target.value)}
                value={provinceCode}
              >
                <option value="">{provinces.loading ? "正在加载省份…" : "选择省份"}</option>
                {provinceOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.name} · {option.code}
                  </option>
                ))}
              </select>
              {provinces.loading ? (
                <span className="field__loading">
                  <Spinner size={13} label="正在加载省份" />
                  正在加载省份数据
                </span>
              ) : null}
            </Field>
          )}

          <Field
            error={errors.cityCode ?? errors.city}
            htmlFor="place-city"
            hint={cityCode ? `已选城市代码 ${cityCode}` : "先选择省份"}
            label="城市"
            required
          >
            {cityFallback || provinceFallback ? (
              <div className="field__stack">
                <input
                  aria-label="城市名称"
                  onChange={(event) => setCityName(event.target.value)}
                  placeholder="例如：南京市"
                  value={cityName}
                />
                <input
                  aria-label="城市代码"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setCityCode(event.target.value.replace(/\D/g, ""))}
                  placeholder="城市代码 320100"
                  value={cityCode}
                />
              </div>
            ) : (
              <select
                disabled={!provinceCode || cities.loading}
                id="place-city"
                onChange={(event) => chooseCity(event.target.value)}
                value={cityCode}
              >
                <option value="">
                  {!provinceCode ? "先选择省份" : cities.loading ? "正在加载城市…" : "选择城市"}
                </option>
                {cityOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.name} · {option.code}
                  </option>
                ))}
              </select>
            )}
            {cities.loading ? (
              <span className="field__loading">
                <Spinner size={13} label="正在加载城市" />
                正在加载城市数据
              </span>
            ) : null}
          </Field>
        </div>

        {provinceFallback ? (
          <div className="inline-callout inline-callout--warning">
            <p>行政区数据暂不可用，可以使用手动方式填写六位代码。</p>
            <button className="btn btn--soft btn--sm" onClick={provinces.retry} type="button">
              重新加载
            </button>
          </div>
        ) : null}
        {cityFallback && !provinceFallback ? (
          <div className="inline-callout inline-callout--warning">
            <p>城市边界数据暂未加载，可以手动填写城市名称与代码。</p>
            <button className="btn btn--soft btn--sm" onClick={cities.retry} type="button">
              重试
            </button>
          </div>
        ) : null}
        {provinces.error ? <FormAlert message={provinces.error} /> : null}
        {cities.error && !provinceFallback ? <FormAlert message={cities.error} /> : null}

        <div className="coordinate-block">
          <div className="coordinate-block__head">
            <div>
              <h3>经纬度</h3>
              <p>在地图上选点，或直接输入 WGS84 坐标。</p>
            </div>
            <div className="coordinate-block__actions">
              <button
                className="btn btn--soft btn--sm"
                disabled={!cityCode}
                onClick={useCityCenter}
                type="button"
              >
                使用城市中心
              </button>
              <button
                className="btn btn--soft btn--sm"
                onClick={() => setPickerOpen(true)}
                type="button"
              >
                <MapPinIcon />
                地图选点
              </button>
            </div>
          </div>
          <div className="form-grid form-grid--coords">
            <Field error={errors.lng} htmlFor="place-lng" label="经度 Lng" required>
              <input
                id="place-lng"
                inputMode="decimal"
                onChange={(event) => {
                  setLng(event.target.value);
                  if (errors.lng) setErrors((current) => ({ ...current, lng: undefined }));
                }}
                placeholder="118.796877"
                step="0.000001"
                type="number"
                value={lng}
              />
            </Field>
            <Field error={errors.lat} htmlFor="place-lat" label="纬度 Lat" required>
              <input
                id="place-lat"
                inputMode="decimal"
                onChange={(event) => {
                  setLat(event.target.value);
                  if (errors.lat) setErrors((current) => ({ ...current, lat: undefined }));
                }}
                placeholder="32.060255"
                step="0.000001"
                type="number"
                value={lat}
              />
            </Field>
          </div>
        </div>
      </div>

      <LocationPicker
        initial={
          canUsePicker
            ? { lng: Number(lng), lat: Number(lat) }
            : null
        }
        onClose={() => setPickerOpen(false)}
        onConfirm={(coords) => {
          setLng(coords.lng.toFixed(6));
          setLat(coords.lat.toFixed(6));
          setPickerOpen(false);
        }}
        open={pickerOpen}
      />
    </Modal>
  );
}
