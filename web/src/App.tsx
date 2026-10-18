import { lazy, Suspense } from "react";
import { usePathname, navigate, parsePublicRoute } from "./lib/router";
import { PublicPage } from "./public/PublicPage";
import { Brand } from "./components/Brand";
import { Spinner } from "./components/Spinner";
import { ArrowLeftIcon } from "./icons";

// The admin console (forms, editors, uploads) is only needed after login, so it
// is split into its own chunk instead of weighing down the public map entry.
const AdminPage = lazy(() =>
  import("./admin/AdminPage").then((module) => ({ default: module.AdminPage })),
);

function AdminLoading() {
  return (
    <main className="session-gate">
      <Brand />
      <div className="session-gate__status">
        <Spinner size={22} label="正在打开管理后台" />
        <span>正在打开管理后台</span>
      </div>
    </main>
  );
}

export function App() {
  const pathname = usePathname().replace(/\/+$/, "") || "/";
  const publicRoute = parsePublicRoute(pathname);

  if (publicRoute) return <PublicPage route={publicRoute} />;
  if (pathname === "/admin") {
    return (
      <Suspense fallback={<AdminLoading />}>
        <AdminPage />
      </Suspense>
    );
  }

  return (
    <main className="not-found">
      <Brand />
      <p className="eyebrow">404</p>
      <h1>这条路线不存在</h1>
      <p>页面可能已被移动，回到地图继续浏览吧。</p>
      <button
        className="btn btn--primary"
        onClick={() => navigate("/")}
        type="button"
      >
        <ArrowLeftIcon />
        回到地图
      </button>
    </main>
  );
}
