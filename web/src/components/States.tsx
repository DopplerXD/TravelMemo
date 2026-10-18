import type { ReactNode } from "react";
import { AlertIcon } from "../icons";

export function ErrorState({
  title = "加载失败",
  message,
  onRetry,
  retryLabel = "重试",
  compact = false,
  action,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className={`error-state${compact ? " error-state--compact" : ""}`} role="alert">
      <span className="error-state__icon">
        <AlertIcon />
      </span>
      <div className="error-state__body">
        <p className="error-state__title">{title}</p>
        <p className="error-state__message">{message}</p>
        {action}
      </div>
      {onRetry ? (
        <button className="btn btn--soft btn--sm" type="button" onClick={onRetry}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`empty-state${compact ? " empty-state--compact" : ""}`}>
      {icon ? <span className="empty-state__icon">{icon}</span> : null}
      <p className="empty-state__title">{title}</p>
      {description ? <p className="empty-state__description">{description}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
