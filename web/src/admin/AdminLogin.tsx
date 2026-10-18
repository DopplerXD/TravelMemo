import { useState } from "react";
import { api, ApiError, setCsrfToken } from "../api";
import type { SessionInfo } from "../types";
import { navigate } from "../lib/router";
import { Brand } from "../components/Brand";
import { Spinner } from "../components/Spinner";
import { FormAlert } from "./FormBits";
import { ArrowLeftIcon, LockIcon } from "../icons";

export function AdminLogin({
  onLoggedIn,
}: {
  onLoggedIn: (session: SessionInfo) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    if (busy) return;
    if (!username.trim() || !password) {
      setError("请输入管理员账号和密码");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await api.login(username.trim(), password);
      setCsrfToken(session.csrfToken);
      onLoggedIn(session);
    } catch (reason: unknown) {
      setError(
        reason instanceof ApiError
          ? reason.status === 401
            ? "账号或密码不正确"
            : reason.message
          : "登录失败，请稍后重试",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-page__glow login-page__glow--blue" />
      <div className="login-page__glow login-page__glow--pink" />
      <div className="login-page__map" aria-hidden>
        <svg viewBox="0 0 900 600" preserveAspectRatio="none">
          <path
            d="M60 420 C180 330 250 470 360 360 S560 210 700 300 810 210 870 260"
            fill="none"
            stroke="rgba(24,119,242,.16)"
            strokeWidth="2"
            strokeDasharray="7 9"
          />
          <circle cx="60" cy="420" r="6" fill="rgba(24,119,242,.24)" />
          <circle cx="360" cy="360" r="6" fill="rgba(243,140,175,.42)" />
          <circle cx="700" cy="300" r="6" fill="rgba(24,119,242,.24)" />
        </svg>
      </div>

      <div className="login-card">
        <div className="login-card__brand">
          <Brand />
        </div>
        <div className="login-card__heading">
          <span className="login-card__lock">
            <LockIcon />
          </span>
          <p className="eyebrow">管理员入口</p>
          <h1>继续写旅行简记</h1>
          <p>登录后可以添加、编辑和整理公开内容。</p>
        </div>

        <form
          className="login-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {error ? <FormAlert message={error} /> : null}
          <label className="field">
            <span>账号</span>
            <input
              autoComplete="username"
              autoFocus
              disabled={busy}
              onChange={(event) => {
                setUsername(event.target.value);
                if (error) setError(null);
              }}
              placeholder="输入管理员账号"
              value={username}
            />
          </label>
          <label className="field">
            <span>密码</span>
            <input
              autoComplete="current-password"
              disabled={busy}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) setError(null);
              }}
              placeholder="输入密码"
              type="password"
              value={password}
            />
          </label>
          <button className="btn btn--primary login-form__submit" disabled={busy} type="submit">
            {busy ? <Spinner size={16} label="正在登录" /> : null}
            {busy ? "正在登录" : "登录管理后台"}
          </button>
        </form>

        <button
          className="login-card__back text-btn"
          onClick={() => navigate("/")}
          type="button"
        >
          <ArrowLeftIcon />
          返回公开地图
        </button>
      </div>
    </main>
  );
}
