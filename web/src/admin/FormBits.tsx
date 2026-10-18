import type { ReactNode } from "react";
import { AlertIcon, CheckIcon } from "../icons";

export function FormAlert({
  message,
  tone = "error",
}: {
  message: string;
  tone?: "error" | "success" | "info";
}) {
  return (
    <div className={`form-alert form-alert--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <span className="form-alert__icon">
        {tone === "error" ? <AlertIcon /> : <CheckIcon />}
      </span>
      <span>{message}</span>
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  children,
  wide = false,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`field${wide ? " field--wide" : ""}${error ? " field--error" : ""}`}>
      <label htmlFor={htmlFor}>
        {label}
        {required ? <span className="field__required">必填</span> : null}
      </label>
      {children}
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field__hint">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
  aside,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="form-section">
      <header className="form-section__head">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}
