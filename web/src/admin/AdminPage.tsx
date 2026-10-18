import { useEffect, useState } from "react";
import { api, setCsrfToken } from "../api";
import { useCatalog } from "../lib/useCatalog";
import { navigate } from "../lib/router";
import { Brand } from "../components/Brand";
import { ErrorState } from "../components/States";
import { Spinner } from "../components/Spinner";
import { ArrowLeftIcon } from "../icons";
import { AdminLogin } from "./AdminLogin";
import { AdminShell } from "./AdminShell";

type SessionState = "checking" | "authenticated" | "anonymous";

export function AdminPage() {
  const [session, setSession] = useState<SessionState>("checking");
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionVersion, setSessionVersion] = useState(0);
  const catalog = useCatalog(session === "authenticated");

  useEffect(() => {
    let active = true;
    setSession("checking");
    setSessionError(null);
    api
      .session()
      .then((info) => {
        if (!active) return;
        if (info.authenticated) {
          setCsrfToken(info.csrfToken);
          setSession("authenticated");
        } else {
          setCsrfToken(undefined);
          setSession("anonymous");
        }
      })
      .catch(() => {
        if (!active) return;
        setSessionError("无法读取登录状态，请确认服务是否已启动");
        setSession("anonymous");
      });
    return () => {
      active = false;
    };
  }, [sessionVersion]);

  const logout = async (): Promise<void> => {
    await api.logout();
    setCsrfToken(undefined);
    setSession("anonymous");
  };

  const expireSession = (): void => {
    setCsrfToken(undefined);
    setSession("anonymous");
  };

  if (session === "checking") {
    return (
      <main className="session-gate">
        <Brand />
        <div className="session-gate__status">
          <Spinner size={22} label="正在确认登录状态" />
          <span>正在确认登录状态</span>
        </div>
      </main>
    );
  }

  if (sessionError) {
    return (
      <main className="session-gate">
        <Brand />
        <div className="session-gate__card">
          <ErrorState
            message={sessionError}
            onRetry={() => setSessionVersion((value) => value + 1)}
            title="无法连接管理服务"
          />
          <button className="text-btn" onClick={() => navigate("/")} type="button">
            <ArrowLeftIcon />
            返回公开地图
          </button>
        </div>
      </main>
    );
  }

  if (session === "anonymous") {
    return <AdminLogin onLoggedIn={() => setSession("authenticated")} />;
  }

  return (
    <AdminShell
      catalog={catalog.data}
      error={catalog.error}
      loading={catalog.loading}
      onLogout={logout}
      onSessionExpired={expireSession}
      reload={catalog.reload}
    />
  );
}
