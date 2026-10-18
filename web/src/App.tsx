import { usePathname, navigate } from "./lib/router";
import { PublicPage } from "./public/PublicPage";
import { AdminPage } from "./admin/AdminPage";
import { Brand } from "./components/Brand";
import { ArrowLeftIcon } from "./icons";

export function App() {
  const pathname = usePathname().replace(/\/+$/, "") || "/";

  if (pathname === "/") return <PublicPage />;
  if (pathname === "/admin") return <AdminPage />;

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
