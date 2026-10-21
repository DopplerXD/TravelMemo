export function mountProfile(app, db, protect) {
  db.exec("CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, data TEXT NOT NULL)");
  db.prepare("INSERT OR IGNORE INTO settings VALUES('profile', ?)").run(JSON.stringify({
    name: 'Xinchuan "Doppler" Yang',
    school: "CityU of HongKong",
    major: "Computer Science",
    blog: "https://www.dopplerxd.site",
    ryot: "http://120.48.53.155:9500/",
  }));
  const read = () => JSON.parse(db.prepare("SELECT data FROM settings WHERE key='profile'").get().data);
  app.get("/api/profile", (req, res) => res.json(read()));
  app.put("/api/profile", protect, (req, res) => {
    const input = req.body;
    const invalid = (message) => Object.assign(new Error(message), { status: 400 });
    if (!input || typeof input !== "object" || Array.isArray(input)) throw invalid("个人信息无效");
    const profile = {};
    for (const key of ["name", "school", "major", "blog", "ryot"]) {
      const value = input[key];
      if (typeof value !== "string" || value.length > (key === "blog" || key === "ryot" ? 2048 : 200))
        throw invalid("个人信息字段无效或过长");
      profile[key] = value.trim();
    }
    for (const key of ["blog", "ryot"]) {
      if (!profile[key]) continue;
      if (!/^https?:\/\//i.test(profile[key])) throw invalid("链接必须是有效的 HTTP 或 HTTPS 地址");
      let url;
      try { url = new URL(profile[key]); } catch { throw invalid("链接必须是有效的 HTTP 或 HTTPS 地址"); }
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
        throw invalid("链接必须是有效的 HTTP 或 HTTPS 地址，且不能包含账号密码");
    }
    db.prepare("UPDATE settings SET data=? WHERE key='profile'").run(JSON.stringify(profile));
    res.json(profile);
  });
}
