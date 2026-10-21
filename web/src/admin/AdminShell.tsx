import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api";
import type { AdminTab, Catalog, Place, Trip } from "../types";
import { parseDate, pluralPhotos } from "../lib/date";
import { navigate } from "../lib/router";
import { Brand } from "../components/Brand";
import { ThemeToggle } from "../components/ThemeToggle";
import { ConfirmDialog } from "../components/Modal";
import { EmptyState, ErrorState } from "../components/States";
import { Spinner } from "../components/Spinner";
import {
  CalendarIcon,
  CheckIcon,
  CloseIcon,
  CompassIcon,
  EditIcon,
  ImageIcon,
  LockIcon,
  LogoutIcon,
  MapPinIcon,
  PlusIcon,
  RouteIcon,
  TrashIcon,
} from "../icons";
import { EntryEditor } from "./EntryEditor";
import { PlaceEditor } from "./PlaceEditor";
import { TripEditor } from "./TripEditor";
import { ProfileEditor } from "./ProfileEditor";

type EditorState =
  | { type: "entry"; id: string | null }
  | { type: "trip"; trip: Trip | null }
  | { type: "place"; place: Place | null }
  | null;

interface DeleteState {
  type: AdminTab;
  id: string;
  title: string;
}

interface ToastState {
  id: number;
  tone: "success" | "error";
  message: string;
}

const TAB_COPY: Record<AdminTab | "profile", { title: string; eyebrow: string; description: string; action: string }> = {
  profile: { title: "个人信息", eyebrow: "Info", description: "维护公开个人信息，保存后立即更新。", action: "" },
  entries: {
    title: "旅行简记",
    eyebrow: "简记",
    description: "按日期记录地点、正文和照片，保存后立即公开。",
    action: "新建简记",
  },
  trips: {
    title: "旅行分组",
    eyebrow: "旅行",
    description: "把简记归入一次旅行，可选地为城市排序并连线。",
    action: "新建旅行",
  },
  places: {
    title: "地点",
    eyebrow: "地点",
    description: "地点可以重复使用，同一地点的不同日期会分别保留。",
    action: "新建地点",
  },
};

export function AdminShell({
  catalog,
  loading,
  error,
  reload,
  onLogout,
  onSessionExpired,
}: {
  catalog: Catalog | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  onLogout: () => Promise<void>;
  onSessionExpired: () => void;
}) {
  const [tab, setTab] = useState<AdminTab | "profile">("entries");
  const [editor, setEditor] = useState<EditorState>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteState | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const entries = catalog?.entries ?? [];
  const trips = catalog?.trips ?? [];
  const places = catalog?.places ?? [];

  const placesById = useMemo(
    () => new Map(places.map((place) => [place.id, place])),
    [places],
  );
  const tripsById = useMemo(() => new Map(trips.map((trip) => [trip.id, trip])), [trips]);

  const sortedEntries = useMemo(
    () =>
      [...entries].sort(
        (first, second) =>
          second.date.localeCompare(first.date) || second.id.localeCompare(first.id),
      ),
    [entries],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (tone: ToastState["tone"], message: string): void => {
    setToast({ id: Date.now(), tone, message });
  };

  const handleError = (reason: unknown, fallback: string): void => {
    if (reason instanceof ApiError && reason.status === 401) {
      onSessionExpired();
      return;
    }
    showToast("error", reason instanceof ApiError ? reason.message : fallback);
  };

  const logout = async (): Promise<void> => {
    if (logoutBusy) return;
    setLogoutBusy(true);
    try {
      await onLogout();
    } catch (reason: unknown) {
      showToast("error", reason instanceof ApiError ? reason.message : "退出登录失败");
      setLogoutBusy(false);
    }
  };

  const openNew = (): void => {
    if (tab === "entries") setEditor({ type: "entry", id: null });
    if (tab === "trips") setEditor({ type: "trip", trip: null });
    if (tab === "places") setEditor({ type: "place", place: null });
  };

  const saved = (message: string): void => {
    setEditor(null);
    showToast("success", message);
    reload();
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === "entries") await api.deleteEntry(deleteTarget.id);
      if (deleteTarget.type === "trips") await api.deleteTrip(deleteTarget.id);
      if (deleteTarget.type === "places") await api.deletePlace(deleteTarget.id);
      showToast(
        "success",
        deleteTarget.type === "entries"
          ? "简记已删除，公开页面已同步更新"
          : deleteTarget.type === "trips"
            ? "旅行分组已删除"
            : "地点已删除",
      );
      setDeleteTarget(null);
      reload();
    } catch (reason: unknown) {
      if (reason instanceof ApiError && reason.status === 401) {
        onSessionExpired();
        return;
      }
      setDeleteTarget(null);
      handleError(reason, "删除失败，请稍后重试");
    } finally {
      setDeleting(false);
    }
  };

  const tabCounts: Record<AdminTab, number> = {
    entries: entries.length,
    trips: trips.length,
    places: places.length,
  };

  const copy = TAB_COPY[tab];
  const refreshing = loading && Boolean(catalog);

  return (
    <div className="admin-page">
      <header className="admin-topbar">
        <div className="admin-topbar__brand">
          <Brand compact />
          <span className="admin-topbar__divider" />
          <span className="admin-topbar__label">
            <LockIcon />
            管理后台
          </span>
        </div>
        <div className="admin-topbar__actions">
          <ThemeToggle className="admin-theme" />
          <a
            className="btn btn--ghost btn--sm"
            href="/"
            onClick={(event) => {
              event.preventDefault();
              navigate("/");
            }}
          >
            <CompassIcon />
            查看网站
          </a>
          <button
            className="btn btn--ghost btn--sm"
            disabled={logoutBusy}
            onClick={() => void logout()}
            type="button"
          >
            {logoutBusy ? <Spinner size={14} label="正在退出" /> : <LogoutIcon />}
            {logoutBusy ? "正在退出" : "退出登录"}
          </button>
        </div>
      </header>

      <div className="admin-layout">
        <aside className="admin-side floating-panel">
          <div className="admin-side__intro">
            <p className="eyebrow">TravelMemo</p>
            <h2>内容管理</h2>
            <p>保存后立即同步到公开地图。</p>
          </div>
          <nav aria-label="管理内容分类" className="admin-tabs">
            {(["entries", "trips", "places", "profile"] as const).map((item) => {
              const itemCopy = TAB_COPY[item];
              return (
                <button
                  aria-current={tab === item ? "page" : undefined}
                  className={`admin-tab${tab === item ? " admin-tab--active" : ""}`}
                  key={item}
                  onClick={() => setTab(item)}
                  type="button"
                >
                  <span className="admin-tab__icon">
                    {item === "entries" ? <CalendarIcon /> : null}
                    {item === "trips" ? <RouteIcon /> : null}
                    {item === "places" ? <MapPinIcon /> : null}
                    {item === "profile" ? <CompassIcon /> : null}
                  </span>
                  <span className="admin-tab__label">{itemCopy.title}</span>
                  {item !== "profile" ? <span className="admin-tab__count">{tabCounts[item]}</span> : null}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="admin-content">
          <header className="admin-content__head">
            <div>
              <p className="eyebrow">{copy.eyebrow}</p>
              <h1>{copy.title}</h1>
              <p>{copy.description}</p>
            </div>
            {tab !== "profile" ? <button className="btn btn--primary" onClick={openNew} type="button">
              <PlusIcon />
              {copy.action}
            </button> : null}
          </header>

          {refreshing ? <div className="admin-progress" aria-label="正在刷新内容" /> : null}

          {tab === "profile" ? <ProfileEditor onUnauthorized={onSessionExpired} /> : error && !catalog ? (
            <ErrorState
              message={error}
              onRetry={reload}
              title="内容加载失败"
            />
          ) : loading && !catalog ? (
            <div className="admin-list" aria-label="正在加载管理内容">
              {[0, 1, 2].map((item) => (
                <div className="admin-row admin-row--skeleton" key={item}>
                  <span className="skeleton skeleton--dot" />
                  <span className="admin-row__skeleton-lines">
                    <span className="skeleton skeleton--lg" />
                    <span className="skeleton skeleton--sm" />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <>
              {error ? (
                <ErrorState
                  compact
                  message={error}
                  onRetry={reload}
                  title="部分内容可能不是最新"
                />
              ) : null}

              {tab === "entries" ? (
                sortedEntries.length === 0 ? (
                  <EmptyState
                    description="添加地点后，用一条简记开始记录。"
                    icon={<CalendarIcon />}
                    title="还没有简记"
                    action={
                      <button className="btn btn--primary btn--sm" onClick={openNew} type="button">
                        <PlusIcon />
                        新建简记
                      </button>
                    }
                  />
                ) : (
                  <div className="admin-list">
                    {sortedEntries.map((entry) => {
                      const place = placesById.get(entry.placeId);
                      const trip = entry.tripId ? tripsById.get(entry.tripId) : undefined;
                      const date = parseDate(entry.date);
                      return (
                        <article className="admin-row" key={entry.id}>
                          <div className="admin-row__date">
                            <span>{date.year}</span>
                            <strong>{date.monthDay}</strong>
                          </div>
                          <div className="admin-row__main">
                            <h3>{entry.title}</h3>
                            <div className="admin-row__meta">
                              <span>
                                <MapPinIcon />
                                {place?.name ?? "地点已移除"}
                              </span>
                              {trip ? (
                                <span>
                                  <RouteIcon />
                                  {trip.title}
                                </span>
                              ) : (
                                <span className="admin-row__muted">未归入旅行</span>
                              )}
                              {entry.photos.length > 0 ? (
                                <span>
                                  <ImageIcon />
                                  {pluralPhotos(entry.photos.length)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="admin-row__actions">
                            <button
                              className="btn btn--soft btn--sm"
                              onClick={() => setEditor({ type: "entry", id: entry.id })}
                              type="button"
                            >
                              <EditIcon />
                              编辑
                            </button>
                            <button
                              aria-label={`删除简记 ${entry.title}`}
                              className="icon-btn icon-btn--danger"
                              onClick={() =>
                                setDeleteTarget({
                                  type: "entries",
                                  id: entry.id,
                                  title: entry.title,
                                })
                              }
                              title="删除"
                              type="button"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )
              ) : null}

              {tab === "trips" ? (
                trips.length === 0 ? (
                  <EmptyState
                    description="旅行分组可以留空，也可以配置城市顺序连线。"
                    icon={<RouteIcon />}
                    title="还没有旅行分组"
                    action={
                      <button className="btn btn--primary btn--sm" onClick={openNew} type="button">
                        <PlusIcon />
                        新建旅行
                      </button>
                    }
                  />
                ) : (
                  <div className="admin-list">
                    {trips.map((trip) => (
                      <article className="admin-row" key={trip.id}>
                        <div className="admin-row__tripmark">
                          <RouteIcon />
                        </div>
                        <div className="admin-row__main">
                          <h3>{trip.title}</h3>
                          <div className="admin-row__meta">
                            <span>
                              {trip.cityRoute.length > 0
                                ? `${trip.cityRoute.length} 座城市连线`
                                : "未配置城市连线"}
                            </span>
                            {trip.cityRoute.length > 0 ? (
                              <span className="admin-row__route">
                                {trip.cityRoute.map((city) => city.name).join(" → ")}
                              </span>
                            ) : null}
                          </div>
                          {trip.description ? (
                            <p className="admin-row__description">{trip.description}</p>
                          ) : null}
                        </div>
                        <div className="admin-row__actions">
                          <button
                            className="btn btn--soft btn--sm"
                            onClick={() => setEditor({ type: "trip", trip })}
                            type="button"
                          >
                            <EditIcon />
                            编辑
                          </button>
                          <button
                            aria-label={`删除旅行 ${trip.title}`}
                            className="icon-btn icon-btn--danger"
                            onClick={() =>
                              setDeleteTarget({ type: "trips", id: trip.id, title: trip.title })
                            }
                            title="删除"
                            type="button"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )
              ) : null}

              {tab === "places" ? (
                places.length === 0 ? (
                  <EmptyState
                    description="省市与坐标会用于地图填色和标点。"
                    icon={<MapPinIcon />}
                    title="还没有地点"
                    action={
                      <button className="btn btn--primary btn--sm" onClick={openNew} type="button">
                        <PlusIcon />
                        新建地点
                      </button>
                    }
                  />
                ) : (
                  <div className="admin-list">
                    {places.map((place) => (
                      <article className="admin-row" key={place.id}>
                        <div className="admin-row__pin">
                          <MapPinIcon />
                        </div>
                        <div className="admin-row__main">
                          <h3>{place.name}</h3>
                          <div className="admin-row__meta">
                            <span>{place.province}</span>
                            {place.city && place.city !== place.province ? (
                              <span>{place.city}</span>
                            ) : null}
                            <span className="admin-row__muted">
                              {place.lng.toFixed(4)}, {place.lat.toFixed(4)}
                            </span>
                          </div>
                        </div>
                        <div className="admin-row__actions">
                          <button
                            className="btn btn--soft btn--sm"
                            onClick={() => setEditor({ type: "place", place })}
                            type="button"
                          >
                            <EditIcon />
                            编辑
                          </button>
                          <button
                            aria-label={`删除地点 ${place.name}`}
                            className="icon-btn icon-btn--danger"
                            onClick={() =>
                              setDeleteTarget({ type: "places", id: place.id, title: place.name })
                            }
                            title="删除"
                            type="button"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )
              ) : null}
            </>
          )}
        </section>
      </div>

      {editor?.type === "entry" ? (
        <EntryEditor
          entryId={editor.id}
          onClose={() => setEditor(null)}
          onNeedPlace={() => {
            setEditor({ type: "place", place: null });
            setTab("places");
          }}
          onSaved={() => saved("简记已保存，访客现在可以看到")}
          onUnauthorized={onSessionExpired}
          places={places}
          trips={trips}
        />
      ) : null}

      {editor?.type === "trip" ? (
        <TripEditor
          onClose={() => setEditor(null)}
          onSaved={() => saved("旅行分组已保存")}
          onUnauthorized={onSessionExpired}
          places={places}
          trip={editor.trip}
        />
      ) : null}

      {editor?.type === "place" ? (
        <PlaceEditor
          onClose={() => setEditor(null)}
          onSaved={() => saved("地点已保存，可用于新的简记")}
          onUnauthorized={onSessionExpired}
          place={editor.place}
        />
      ) : null}

      <ConfirmDialog
        busy={deleting}
        message={
          deleteTarget?.type === "trips"
            ? `确定删除「${deleteTarget.title}」吗？仍有关联简记的旅行无法删除，请先调整简记的旅行分组。`
            : deleteTarget?.type === "places"
              ? `确定删除「${deleteTarget.title}」吗？仍被简记使用的地点无法删除，请先调整相关简记。`
              : `确定删除「${deleteTarget?.title ?? ""}」吗？照片和正文会一并从公开页面移除。`
        }
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={() => void confirmDelete()}
        open={Boolean(deleteTarget)}
        title="删除确认"
      />

      {toast ? (
        <div
          className={`toast toast--${toast.tone}`}
          key={toast.id}
          role={toast.tone === "error" ? "alert" : "status"}
        >
          <span className="toast__icon">
            {toast.tone === "success" ? <CheckIcon /> : <CloseIcon />}
          </span>
          <span>{toast.message}</span>
          <button
            aria-label="关闭提示"
            className="icon-btn icon-btn--sm toast__close"
            onClick={() => setToast(null)}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>
      ) : null}
    </div>
  );
}
