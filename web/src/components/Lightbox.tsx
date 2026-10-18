import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "../icons";
import type { Photo } from "../types";

export function Lightbox({
  photos,
  index,
  onIndexChange,
  onClose,
}: {
  photos: Photo[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const count = photos.length;
  const current = photos[index];

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowLeft" && count > 1) {
        event.preventDefault();
        onIndexChange((index - 1 + count) % count);
      } else if (event.key === "ArrowRight" && count > 1) {
        event.preventDefault();
        onIndexChange((index + 1) % count);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [count, index, onClose, onIndexChange]);

  useEffect(() => {
    if (index < 0 || index >= count) onIndexChange(0);
  }, [count, index, onIndexChange]);

  if (!current) return null;

  return createPortal(
    <div
      aria-label="照片浏览"
      aria-modal="true"
      className="lightbox"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
    >
      <div className="lightbox__top">
        <span className="lightbox__brand">TravelMemo · 照片</span>
        <span className="lightbox__index">
          {index + 1} <span>/ {count}</span>
        </span>
        <button
          aria-label="关闭照片浏览"
          className="icon-btn icon-btn--on-dark lightbox__close"
          onClick={onClose}
          ref={closeRef}
          type="button"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="lightbox__stage">
        {count > 1 ? (
          <button
            aria-label="上一张照片"
            className="icon-btn icon-btn--on-dark lightbox__nav lightbox__nav--prev"
            onClick={() => onIndexChange((index - 1 + count) % count)}
            type="button"
          >
            <ChevronLeftIcon />
          </button>
        ) : null}
        <img
          alt={current.alt || ""}
          className="lightbox__image"
          draggable={false}
          key={current.id}
          src={current.url}
        />
        {count > 1 ? (
          <button
            aria-label="下一张照片"
            className="icon-btn icon-btn--on-dark lightbox__nav lightbox__nav--next"
            onClick={() => onIndexChange((index + 1) % count)}
            type="button"
          >
            <ChevronRightIcon />
          </button>
        ) : null}
      </div>

      {current.alt ? (
        <p className="lightbox__caption">{current.alt}</p>
      ) : (
        <p className="lightbox__caption lightbox__caption--muted">
          使用方向键切换照片，Esc 关闭
        </p>
      )}
    </div>,
    document.body,
  );
}
