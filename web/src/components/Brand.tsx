import { BrandMark } from "../icons";
import { navigate } from "../lib/router";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a
      className={`brand${compact ? " brand--compact" : ""}`}
      href="/"
      onClick={(event) => {
        event.preventDefault();
        navigate("/");
      }}
      aria-label="TravelMemo 首页"
    >
      <BrandMark className="brand__mark" />
      <span className="brand__text">
        <span className="brand__name">TravelMemo</span>
        {compact ? null : <span className="brand__sub">中国旅行简记</span>}
      </span>
    </a>
  );
}
