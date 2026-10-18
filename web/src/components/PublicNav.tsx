import type { PublicView } from "../lib/router";
import { navigate } from "../lib/router";
import { BrandMark, LockIcon } from "../icons";
import { ThemeToggle } from "../components/ThemeToggle";

const TABS: Array<{ view: Exclude<PublicView, "map">; label: string; path: string }> = [
  { view: "trips", label: "Trips", path: "/trips" },
  { view: "places", label: "Places", path: "/places" },
  { view: "timeline", label: "Timeline", path: "/timeline" },
  { view: "stats", label: "Stats", path: "/stats" },
];

export function PublicNav({
  activeView,
  detailId,
}: {
  activeView: PublicView;
  detailId: string | null;
}) {
  const selectTab = (view: Exclude<PublicView, "map">, path: string): void => {
    if (activeView !== view) {
      navigate(path);
      return;
    }
    // A second click on the open tab returns to the map. Inside a detail view
    // it first steps back to that section's list, keeping the route reversible.
    navigate(detailId ? path : "/");
  };

  return (
    <nav aria-label="主导航" className="public-nav floating-panel">
      <button
        aria-label="返回地图"
        className="public-nav__brand"
        onClick={() => navigate("/")}
        type="button"
      >
        <BrandMark className="public-nav__mark" />
        <span className="public-nav__wordmark">TravelMemo</span>
      </button>

      <span aria-hidden className="public-nav__divider" />

      <div className="public-nav__tabs">
        {TABS.map((tab) => {
          const active = activeView === tab.view;
          return (
            <button
              aria-current={active ? "page" : undefined}
              className={`public-nav__tab${active ? " public-nav__tab--active" : ""}`}
              key={tab.view}
              onClick={() => selectTab(tab.view, tab.path)}
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <span aria-hidden className="public-nav__divider" />

      <div className="public-nav__actions">
        <ThemeToggle className="public-nav__icon-btn" />
        <a
          aria-label="管理后台"
          className="public-nav__icon-btn public-nav__admin"
          href="/admin"
          onClick={(event) => {
            event.preventDefault();
            navigate("/admin");
          }}
          title="管理后台"
        >
          <LockIcon />
        </a>
      </div>
    </nav>
  );
}
