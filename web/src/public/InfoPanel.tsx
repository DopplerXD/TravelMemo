import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import type { Profile } from "../types";
import { ErrorState } from "../components/States";
import { Spinner } from "../components/Spinner";

export const PROFILE_FIELDS = [
  ["name", "Name"], ["school", "School"], ["major", "Major"], ["blog", "Blog"], ["ryot", "Ryot"],
] as const;

export function InfoPanel() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    void api.profile(controller.signal).then(setProfile).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof ApiError ? reason.message : "个人信息加载失败");
    });
    return () => controller.abort();
  }, [attempt]);
  return (
    <section aria-label="个人信息" className="center-panel info-view floating-panel">
      <header className="info-view__head"><h1>Info</h1></header>
      <div className="info-view__body">
        {error ? <ErrorState message={error} onRetry={() => setAttempt(attempt + 1)} title="个人信息加载失败" /> : !profile ? <Spinner label="正在加载个人信息" /> : (
          <dl className="profile-details">
            {PROFILE_FIELDS.map(([key, label]) => profile[key] ? (
              <div className="profile-details__row" key={key}>
                <dt>{label}</dt>
                <dd>{key === "blog" || key === "ryot" ? <a href={profile[key]} target="_blank" rel="noopener noreferrer">{profile[key]}</a> : profile[key]}</dd>
              </div>
            ) : null)}
          </dl>
        )}
      </div>
    </section>
  );
}
