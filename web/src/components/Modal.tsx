import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertIcon, CloseIcon } from "../icons";
import { Spinner } from "./Spinner";

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "md",
  closeDisabled = false,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  closeDisabled?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => setEntered(true), 20);
    window.setTimeout(() => closeRef.current?.focus(), 30);

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && !closeDisabled) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [open, onClose, closeDisabled]);

  if (!open) return null;

  return createPortal(
    <div
      className={`modal-layer${entered ? " modal-layer--entered" : ""}`}
      role="presentation"
    >
      <div
        className="modal-scrim"
        onClick={() => {
          if (!closeDisabled) onClose();
        }}
      />
      <div
        aria-labelledby="modal-title"
        aria-modal="true"
        className={`modal modal--${size}`}
        ref={panelRef}
        role="dialog"
      >
        <header className="modal__header">
          <div className="modal__heading">
            <h2 id="modal-title">{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button
            aria-label="关闭"
            className="icon-btn modal__close"
            disabled={closeDisabled}
            onClick={onClose}
            ref={closeRef}
            type="button"
          >
            <CloseIcon />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer ? <footer className="modal__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "删除",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      closeDisabled={busy}
      footer={
        <>
          <button
            className="btn btn--ghost"
            disabled={busy}
            onClick={onCancel}
            type="button"
          >
            取消
          </button>
          <button
            className="btn btn--danger"
            disabled={busy}
            onClick={onConfirm}
            type="button"
          >
            {busy ? <Spinner size={16} label="正在删除" /> : null}
            {busy ? "正在删除" : confirmLabel}
          </button>
        </>
      }
      onClose={onCancel}
      open={open}
      size="sm"
      title={title}
    >
      <div className="confirm-message">
        <span className="confirm-message__icon">
          <AlertIcon />
        </span>
        <p>{message}</p>
      </div>
    </Modal>
  );
}
