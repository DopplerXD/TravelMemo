export function Spinner({
  size = 18,
  label = "加载中",
}: {
  size?: number;
  label?: string;
}) {
  return (
    <span
      className="spinner"
      role="status"
      aria-label={label}
      style={{ width: size, height: size }}
    />
  );
}

export function LoadingBlock({ label = "正在加载" }: { label?: string }) {
  return (
    <div className="loading-block">
      <Spinner size={22} label={label} />
      <span>{label}</span>
    </div>
  );
}
