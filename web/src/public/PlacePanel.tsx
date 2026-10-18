import type { EntrySummary, Place, Trip } from "../types";
import { parseDate, pluralPhotos } from "../lib/date";
import {
  CalendarIcon,
  CloseIcon,
  ImageIcon,
  MapPinIcon,
  RouteIcon,
} from "../icons";
import { EmptyState } from "../components/States";

export function PlacePanel({
  place,
  entries,
  tripsById,
  selectedEntryId,
  onClose,
  onSelectEntry,
}: {
  place: Place;
  entries: EntrySummary[];
  tripsById: Map<string, Trip>;
  selectedEntryId: string | null;
  onClose: () => void;
  onSelectEntry: (entry: EntrySummary) => void;
}) {
  return (
    <section aria-label="地点记录" className="detail-panel floating-panel place-panel">
      <header className="detail-panel__head">
        <div className="detail-panel__heading">
          <p className="eyebrow">地点</p>
          <h2>{place.name}</h2>
          <p className="place-panel__location">
            {place.province}
            {place.city && place.city !== place.province ? ` · ${place.city}` : ""}
          </p>
        </div>
        <button aria-label="关闭地点记录" className="icon-btn" onClick={onClose} type="button">
          <CloseIcon />
        </button>
      </header>

      <div className="detail-panel__scroll">
        <div className="place-panel__summary">
          <span className="place-panel__pin">
            <MapPinIcon />
          </span>
          <div>
            <strong>{entries.length > 0 ? `${entries.length} 次到访记录` : "还没有简记"}</strong>
            <p>同一地点的不同日期与旅行会分别保留。</p>
          </div>
        </div>

        {entries.length === 0 ? (
          <EmptyState
            compact
            description="删除筛选或添加一条简记后再来看看。"
            icon={<CalendarIcon />}
            title="这里还没有记录"
          />
        ) : (
          <div className="place-records">
            {entries.map((entry) => {
              const date = parseDate(entry.date);
              const trip = entry.tripId ? tripsById.get(entry.tripId) : undefined;
              const cover = entry.photos[0];
              return (
                <button
                  aria-current={entry.id === selectedEntryId ? "true" : undefined}
                  className={`place-record${entry.id === selectedEntryId ? " place-record--active" : ""}`}
                  key={entry.id}
                  onClick={() => onSelectEntry(entry)}
                  type="button"
                >
                  <span className="place-record__date">
                    <span>{date.year}</span>
                    <strong>{date.monthDay}</strong>
                  </span>
                  <span className="place-record__body">
                    <span className="place-record__title">{entry.title}</span>
                    <span className="place-record__meta">
                      {trip ? (
                        <span>
                          <RouteIcon />
                          {trip.title}
                        </span>
                      ) : (
                        <span className="place-record__meta-muted">未归入旅行</span>
                      )}
                      {entry.photos.length > 0 ? (
                        <span>
                          <ImageIcon />
                          {pluralPhotos(entry.photos.length)}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  {cover ? (
                    <img
                      alt={cover.alt || ""}
                      className="place-record__cover"
                      loading="lazy"
                      src={cover.thumbnailUrl}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
