import { useEffect, useState } from "react";
import type { EntrySummary, Place, Trip } from "../types";
import { formatDateRange, parseDate, pluralPhotos } from "../lib/date";
import { useEntryDetail } from "../lib/useEntryDetail";
import {
  CalendarIcon,
  CloseIcon,
  ImageIcon,
  MapPinIcon,
  RouteIcon,
} from "../icons";
import { ErrorState } from "../components/States";
import { Spinner } from "../components/Spinner";
import { Lightbox } from "../components/Lightbox";

export function EntryDetail({
  entryId,
  summary,
  place,
  trip,
  placeEntryCount,
  onClose,
  onShowPlaceEntries,
  onSelectTrip,
}: {
  entryId: string;
  summary?: EntrySummary;
  place?: Place;
  trip?: Trip;
  placeEntryCount: number;
  onClose: () => void;
  onShowPlaceEntries: () => void;
  onSelectTrip: (tripId: string) => void;
}) {
  const { entry, loading, error, retry } = useEntryDetail(entryId);
  const [brokenPhotos, setBrokenPhotos] = useState<Set<string>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const shown = entry ?? summary;
  const date = parseDate(shown?.date ?? "");

  useEffect(() => {
    setBrokenPhotos(new Set());
    setLightboxIndex(null);
  }, [entryId]);

  return (
    <section aria-label="简记详情" className="detail-panel floating-panel">
      <header className="detail-panel__head">
        <div className="detail-panel__heading">
          <p className="eyebrow">简记</p>
          <h2>{shown?.title ?? "正在打开简记"}</h2>
        </div>
        <button
          aria-label="关闭简记详情"
          className="icon-btn"
          onClick={onClose}
          type="button"
        >
          <CloseIcon />
        </button>
      </header>

      <div className="detail-panel__scroll">
        <div className="detail-meta">
          <span>
            <CalendarIcon />
            {formatDateRange(shown?.date, shown?.endDate ?? shown?.date)}
            {date.weekday && (!shown?.endDate || shown.endDate === shown.date) ? ` · ${date.weekday}` : ""}
          </span>
          {place ? (
            <button className="detail-meta__link" onClick={onShowPlaceEntries} type="button">
              <MapPinIcon />
              {place.name}
              {placeEntryCount > 1 ? ` · ${placeEntryCount} 次记录` : ""}
            </button>
          ) : (
            <span>
              <MapPinIcon />
              地点已移除
            </span>
          )}
        </div>

        {trip ? (
          <button
            className="trip-pill"
            onClick={() => onSelectTrip(trip.id)}
            title={`只看「${trip.title}」`}
            type="button"
          >
            <RouteIcon />
            <span>{trip.title}</span>
          </button>
        ) : null}

        {loading && !entry ? (
          <div className="detail-loading">
            <div className="detail-loading__status">
              <Spinner size={16} label="正在加载正文" />
              正在加载正文
            </div>
            <span className="skeleton skeleton--lg" />
            <span className="skeleton skeleton--md" />
            <span className="skeleton skeleton--md" />
            <span className="skeleton skeleton--sm" />
          </div>
        ) : error && !entry ? (
          <ErrorState
            compact
            message={error}
            onRetry={retry}
            title="正文没有打开"
          />
        ) : entry ? (
          <>
            {entry.body ? (
              <div className="entry-body">{entry.body}</div>
            ) : (
              <p className="entry-body entry-body--muted">这条简记只留下了照片。</p>
            )}

            {entry.photos.length > 0 ? (
              <div className="entry-photos">
                <div className="entry-photos__head">
                  <span>
                    <ImageIcon />
                    {pluralPhotos(entry.photos.length)}
                  </span>
                  <span className="entry-photos__hint">点击查看大图</span>
                </div>
                <div className="entry-photos__grid">
                  {entry.photos.map((photo, index) => (
                    <button
                      aria-label={photo.alt ? `查看照片：${photo.alt}` : `查看第 ${index + 1} 张照片`}
                      className="photo-tile"
                      key={photo.id}
                      onClick={() => setLightboxIndex(index)}
                      type="button"
                    >
                      {brokenPhotos.has(photo.id) ? (
                        <span className="photo-tile__fallback">
                          <ImageIcon />
                          <span>照片暂时无法显示</span>
                        </span>
                      ) : (
                        <img
                          alt={photo.alt || ""}
                          loading="lazy"
                          onError={() =>
                            setBrokenPhotos((current) => new Set(current).add(photo.id))
                          }
                          src={photo.thumbnailUrl}
                        />
                      )}
                      <span className="photo-tile__zoom">查看</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      {entry && lightboxIndex !== null ? (
        <Lightbox
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
          photos={entry.photos}
        />
      ) : null}
    </section>
  );
}
