import { useTheme } from "../lib/theme";
import { MoonIcon, SunIcon } from "../icons";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const next = theme === "dark" ? "亮色" : "暗色";
  return (
    <button
      aria-label={`切换到${next}模式`}
      className={`theme-toggle${className ? ` ${className}` : ""}`}
      onClick={toggleTheme}
      title={`切换到${next}模式`}
      type="button"
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
