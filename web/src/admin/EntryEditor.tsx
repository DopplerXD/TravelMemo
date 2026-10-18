import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api";
import type { Entry, Photo, Place, Trip } from "../types";
import { parseDate, todayIso } from "../lib/date";
import { useEntryDetail } from "../lib/useEntryDetail";
import { Modal } from "../components/Modal";
import { Spinner } from "../components/Spinner";
import { ErrorState } from "../components/States";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ImageIcon,
  PlusIcon,
  TrashIcon,
} from "../icons";
import { Field, FormAlert, FormSection } from "./FormBits";

interface EntryEditorProps {
  entryId: string | null;
  places: Place[];
  trips: Trip[];
  onClose: () => void;
  onSaved: () => void;
  onNeedPlace: () => void;
  onUnauthorized: () => void;
}

interface FieldErrors {
  title?: string;
  date?: string;
  placeId?: string;
}

export function EntryEditor({
  entryId,
  places,
  trips,
  onClose,
  onSaved,
  onNeedPlace,
  onUnauthorized,
}: EntryEditorProps) {
  const { entry, loading, error, retry } = useEntryDetail(entryId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayIso());
  const [placeId, setPlaceId] = useState("");
  const [tripId, setTripId] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setTitle(entry.title);
    setDate(entry.date);
    setPlaceId(entry.placeId);
    setTripId(entry.tripId ?? "");
    setBody(entry.body);
    setPhotos(entry.photos);
  }, [entry]);

  useEffect(() => {
    if (!entryId && places.length > 0) {
      setPlaceId((current) =>
        current && places.some((place) => place.id === current) ? current : places[0]?.id ?? "",
      );
    }
  }, [entryId, places]);

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!title.trim()) next.title = "写下一个标题，方便以后回看";
    if (!date || !parseDate(date).isValid) next.date = "请选择有效日期";
    if (!placeId) next.placeId = "请选择这条简记发生的地点";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleFiles = async (files: FileList | File[] | null): Promise<void> => {
    const list = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
    if (list.length === 0) {
      setUploadError("请选择图片文件（JPG、PNG、WebP 等）");
      return;
    }
    setUploadError(null);
    setUploading(true);
    setUploadDone(0);
    setUploadTotal(list.length);
    for (let index = 0; index < list.length; index += 1) {
      const file = list[index];
      if (!file) continue;
      try {
        const photo = await api.uploadPhoto(file);
        setPhotos((current) => [...current, photo]);
      } catch (reason: unknown) {
        if (reason instanceof ApiError && reason.status === 401) {
          onUnauthorized();
          return;
        }
        setUploadError(
          reason instanceof ApiError
            ? `${file.name}：${reason.message}`
            : `${file.name}：上传失败，请重试`,
        );
      } finally {
        setUploadDone(index + 1);
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const movePhoto = (index: number, direction: -1 | 1): void => {
    setPhotos((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      if (!item) return current;
      next.splice(target, 0, item);
      return next;
    });
  };

  const updateAlt = (photoId: string, alt: string): void => {
    setPhotos((current) =>
      current.map((photo) => (photo.id === photoId ? { ...photo, alt } : photo)),
    );
  };

  const save = async (): Promise<void> => {
    if (saving || uploading) return;
    setSubmitError(null);
    if (!validate()) return;
    setSaving(true);
    const payload: Omit<Entry, "id"> = {
      title: title.trim(),
      date,
      placeId,
      tripId: tripId || null,
      body,
      photos,
    };
    try {
      if (entryId) {
        await api.updateEntry(entryId, payload);
      } else {
        await api.createEntry(payload);
      }
      onSaved();
    } catch (reason: unknown) {
      if (reason instanceof ApiError && reason.status === 401) {
        onUnauthorized();
        return;
      }
      setSubmitError(
        reason instanceof ApiError ? reason.message : "保存失败，请稍后重试",
      );
    } finally {
      setSaving(false);
    }
  };

  const editing = Boolean(entryId);
  const busy = saving || uploading;

  if (editing && loading && !entry) {
    return (
      <Modal onClose={onClose} open size="lg" title="打开简记">
        <div className="modal-loading">
          <Spinner size={22} label="正在加载简记" />
          <span>正在加载简记正文与照片</span>
        </div>
      </Modal>
    );
  }

  if (editing && error && !entry) {
    return (
      <Modal
        footer={
          <button className="btn btn--ghost" onClick={onClose} type="button">
            关闭
          </button>
        }
        onClose={onClose}
        open
        size="sm"
        title="无法打开简记"
      >
        <ErrorState compact message={error} onRetry={retry} title="加载失败" />
      </Modal>
    );
  }

  return (
    <Modal
      closeDisabled={busy}
      footer={
        <>
          <span className="modal__footer-note">
            {busy ? "正在保存，请稍候…" : "保存后访客立即可见"}
          </span>
          <button className="btn btn--ghost" disabled={busy} onClick={onClose} type="button">
            取消
          </button>
          <button className="btn btn--primary" disabled={busy} onClick={() => void save()} type="button">
            {saving ? <Spinner size={16} label="正在保存" /> : null}
            {saving ? "正在保存" : editing ? "保存修改" : "创建简记"}
          </button>
        </>
      }
      onClose={onClose}
      open
      size="lg"
      subtitle={editing ? "修改会立即同步到公开页面。" : "记录日期、地点、文字和照片。"}
      title={editing ? "编辑简记" : "新建简记"}
    >
      <div className="editor-form">
        {submitError ? <FormAlert message={submitError} /> : null}
        {places.length === 0 ? (
          <div className="inline-callout">
            <p>还没有可关联的地点。先创建一个地点，再回来写简记。</p>
            <button className="btn btn--soft btn--sm" onClick={onNeedPlace} type="button">
              <PlusIcon />
              去添加地点
            </button>
          </div>
        ) : null}

        <div className="form-grid">
          <Field error={fieldErrors.title} htmlFor="entry-title" label="标题" required wide>
            <input
              autoFocus
              id="entry-title"
              maxLength={120}
              onChange={(event) => {
                setTitle(event.target.value);
                if (fieldErrors.title) setFieldErrors((current) => ({ ...current, title: undefined }));
              }}
              placeholder="例如：雨后的玄武湖"
              value={title}
            />
          </Field>

          <Field error={fieldErrors.date} htmlFor="entry-date" label="日期" required>
            <input
              id="entry-date"
              onChange={(event) => {
                setDate(event.target.value);
                if (fieldErrors.date) setFieldErrors((current) => ({ ...current, date: undefined }));
              }}
              type="date"
              value={date}
            />
          </Field>

          <Field error={fieldErrors.placeId} htmlFor="entry-place" label="地点" required>
            <select
              disabled={places.length === 0}
              id="entry-place"
              onChange={(event) => {
                setPlaceId(event.target.value);
                if (fieldErrors.placeId) {
                  setFieldErrors((current) => ({ ...current, placeId: undefined }));
                }
              }}
              value={placeId}
            >
              <option value="">选择地点</option>
              {places.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name} · {place.province}
                  {place.city && place.city !== place.province ? ` / ${place.city}` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field htmlFor="entry-trip" label="旅行分组" hint="可选，不归入旅行也能正常浏览。">
            <select
              id="entry-trip"
              onChange={(event) => setTripId(event.target.value)}
              value={tripId}
            >
              <option value="">不归入旅行</option>
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.title}
                </option>
              ))}
            </select>
          </Field>

          <Field htmlFor="entry-body" label="正文" wide>
            <textarea
              id="entry-body"
              maxLength={20000}
              onChange={(event) => setBody(event.target.value)}
              placeholder="写下当天发生了什么、看到的风景，或者一段想记住的感觉。"
              rows={8}
              value={body}
            />
            <p className="field__counter">{body.length} / 20000</p>
          </Field>
        </div>

        <FormSection
          aside={
            <span className="form-section__count">
              {photos.length > 0 ? `${photos.length} 张` : "可稍后补充"}
            </span>
          }
          description="支持多选上传，可调整顺序和照片描述。"
          title="照片"
        >
          <div
            className={`photo-drop${dragActive ? " photo-drop--active" : ""}${uploading ? " photo-drop--busy" : ""}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragActive(false);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              void handleFiles(event.dataTransfer.files);
            }}
          >
            <input
              accept="image/*"
              hidden
              multiple
              onChange={(event) => void handleFiles(event.target.files)}
              ref={fileInputRef}
              type="file"
            />
            <span className="photo-drop__icon">
              {uploading ? <Spinner size={20} label="正在上传" /> : <ImageIcon />}
            </span>
            <div>
              <strong>{uploading ? `正在上传 ${uploadDone} / ${uploadTotal}` : "拖入照片，或选择文件"}</strong>
              <p>图片会生成适合网页展示的缩略图，原图按需加载。</p>
            </div>
            <button
              className="btn btn--soft btn--sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <PlusIcon />
              选择照片
            </button>
          </div>
          {uploading ? (
            <div className="upload-progress" role="status">
              <span style={{ width: `${uploadTotal > 0 ? (uploadDone / uploadTotal) * 100 : 0}%` }} />
            </div>
          ) : null}
          {uploadError ? <FormAlert message={uploadError} /> : null}

          {photos.length > 0 ? (
            <ol className="photo-editor-list">
              {photos.map((photo, index) => (
                <li className="photo-editor" key={photo.id}>
                  <div className="photo-editor__preview">
                    <img alt={photo.alt || ""} loading="lazy" src={photo.thumbnailUrl} />
                    <span>{index + 1}</span>
                  </div>
                  <div className="photo-editor__info">
                    <label className="photo-editor__alt">
                      <span>照片描述</span>
                      <input
                        maxLength={160}
                        onChange={(event) => updateAlt(photo.id, event.target.value)}
                        placeholder="为照片补充一句描述（可选）"
                        value={photo.alt}
                      />
                    </label>
                    <span className="photo-editor__dims">
                      {photo.width} × {photo.height}
                    </span>
                  </div>
                  <div className="photo-editor__actions">
                    <button
                      aria-label="照片前移"
                      className="icon-btn icon-btn--sm"
                      disabled={index === 0}
                      onClick={() => movePhoto(index, -1)}
                      title="前移"
                      type="button"
                    >
                      <ArrowUpIcon />
                    </button>
                    <button
                      aria-label="照片后移"
                      className="icon-btn icon-btn--sm"
                      disabled={index === photos.length - 1}
                      onClick={() => movePhoto(index, 1)}
                      title="后移"
                      type="button"
                    >
                      <ArrowDownIcon />
                    </button>
                    <button
                      aria-label="移除照片"
                      className="icon-btn icon-btn--sm icon-btn--danger"
                      onClick={() =>
                        setPhotos((current) => current.filter((item) => item.id !== photo.id))
                      }
                      title="移除"
                      type="button"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="photo-empty">还没有照片。没有照片的简记也可以正常保存。</p>
          )}
        </FormSection>
      </div>
    </Modal>
  );
}
