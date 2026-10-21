import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import type { Profile } from "../types";
import { ErrorState } from "../components/States";
import { Spinner } from "../components/Spinner";

const FIELDS = [["name", "Name"], ["school", "School"], ["major", "Major"], ["blog", "Blog"], ["ryot", "Ryot"]] as const;

export function ProfileEditor({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    void api.profile(controller.signal).then(setProfile).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof ApiError ? reason.message : "个人信息加载失败");
    });
    return () => controller.abort();
  }, [attempt]);
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!profile || busy) return;
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      setProfile(await api.updateProfile(profile));
      setSaved(true);
    } catch (reason: unknown) {
      if (reason instanceof ApiError && reason.status === 401) onUnauthorized();
      else setError(reason instanceof ApiError ? reason.message : "保存失败，请稍后重试");
    } finally { setBusy(false); }
  };
  if (!profile) return error ? <ErrorState title="个人信息加载失败" message={error} onRetry={() => setAttempt(attempt + 1)} /> : <Spinner label="正在加载个人信息" />;
  return (
    <form className="profile-editor" onSubmit={(event) => void submit(event)} aria-label="编辑个人信息">
      <fieldset disabled={busy}>
        {FIELDS.map(([key, label]) => (
          <label className="field" key={key}>
            <span>{label}</span>
            <input name={key} type={key === "blog" || key === "ryot" ? "url" : "text"} maxLength={key === "blog" || key === "ryot" ? 2048 : 200} value={profile[key]} onChange={(event) => { setProfile({ ...profile, [key]: event.target.value }); setSaved(false); }} />
          </label>
        ))}
      </fieldset>
      {error ? <p className="field__error" role="alert">{error}</p> : null}
      {saved ? <p className="profile-editor__success" role="status">个人信息已保存</p> : null}
      <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? "正在保存" : "保存个人信息"}</button>
    </form>
  );
}
