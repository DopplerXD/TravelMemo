# TravelMemo

以中国地图、时间线和照片记录旅行。访客免登录浏览，管理员在线编辑，保存即公开。

## 本地运行

需要 Node.js 24 或更高版本。

```sh
cp .env.example .env
# 在 .env 设置 ADMIN_USERNAME 和至少 12 字符的 ADMIN_PASSWORD
npm ci
npm run install:all
npm run dev
```

浏览 `http://127.0.0.1:5173`，管理入口 `/admin`。初始内容为空。先建立地点和旅行分组，再添加简记；一个地点可复用于多次旅行。生产运行前执行 `npm run build`，然后 `npm start`，访问 `http://127.0.0.1:8015`。开发和生产均使用同一个数据目录，勿将测试内容写入真实数据。

`npm run check` 执行后端集成测试、地图样式校验和前端类型检查、生产构建；安装 Google Chrome 后，`npm run test:e2e` 验证电脑和手机的实际浏览、编辑、上传及地图配置，测试使用独立临时数据库。

展示页提供 `/trips`、`/places`、`/timeline`、`/stats`，品牌入口返回全国地图。亮暗主题首次跟随系统，手动切换后在浏览器中记忆，管理页共用主题设置。

接口见 [docs/API.md](docs/API.md)，需求见 [PRD.md](PRD.md)。

## 云服务器部署

在北京百度云 BCE 轻量应用服务器安装 Docker 与 Compose，复制源码和 `.env`，设置强密码：

```sh
docker compose up -d --build
docker compose ps
curl -f http://127.0.0.1:8015/api/health
```

应用默认以无域名直连方式监听 `0.0.0.0:8015`，访问 `http://服务器IP:8015`，云防火墙放行 8015/tcp。该模式为明文 HTTP，仅适合个人使用且密码足够强，并建议配合 IP 白名单或 Tailscale 等私有网络。若改用 Nginx/Caddy 反向代理，把 `compose.yaml` 的端口改回 `127.0.0.1:8015:8015`，并设置 `COOKIE_SECURE=true`；可信反向代理恰好一层时设置 `TRUST_PROXY=1`，代理需覆盖 `X-Forwarded-Proto` 并传递正确客户端 IP。首次本地 HTTP 调试保持两项为 false。不要将管理密码提交到仓库。

Nginx 站点核心配置：

```nginx
client_max_body_size 25m;
location / {
    proxy_pass http://127.0.0.1:8015;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

`travelmemo-data` 数据卷保存 SQLite、原始照片及网页图片。更新使用 `git pull` 后 `docker compose up -d --build`，保留数据卷。普通停止用 `docker compose down`；`down -v` 会删除旅行数据，不应作为更新步骤。

### 地图配置

全国与省市足迹使用本地行政区文件。街道细节需要在 `.env` 设置 `TDT_TOKEN`（天地图浏览器服务令牌），或 `MAP_TILE_URL`（WGS84/CGCS2000 WebMercator XYZ 瓦片）及 `MAP_ATTRIBUTION`，修改后重建容器配置：`docker compose up -d --force-recreate`。服务商令牌需限制站点域名，不能填写私有服务端密钥。数据来源、坐标及已知粒度限制见 [docs/GEOGRAPHY.md](docs/GEOGRAPHY.md)。

无地图令牌时，行政区足迹、地点标点和旅行连线仍可使用。上线时需从北京服务器和手机网络验证瓦片、缩略图及上传，开发机器无法代替这一环境验收。

### HEIC 照片

支持上传苹果 HEIC 照片，服务端自动生成 WebP 展示图和缩略图，原始 HEIC 仅保留在数据卷中。单张上限 20 MiB、5000 万像素；HEIC 转换一次处理一张，忙碌时可稍后重试。

Docker 镜像已包含解码工具。已有部署需执行 `docker compose up -d --build`，仅重启旧容器不会安装新依赖。非 Docker 开发需安装 `heif-convert` 及 HEVC 解码支持：Debian/Ubuntu 使用 `sudo apt-get install libheif-examples`，macOS 使用 `brew install libheif`。安装后执行 `heif-convert --help` 确认命令可用。运行 `REQUIRE_HEIC=1 npm test --prefix server` 可强制验证 HEIC 解码与上传；测试使用合成色块图片，不含个人照片。

### 备份和恢复

```sh
sh scripts/backup.sh
```

脚本会短暂停止应用，将整个数据卷打包到 `backups/` 并启动原服务。请将备份文件另存至服务器之外；`.env` 单独保管。

恢复前停止服务，先备份现有数据，再在 `compose.yaml` 中把 `travelmemo-data` 的卷名更换为新名称（例如 `travelmemo-restored`，同时修改底部 volumes 声明），随后：

```sh
sh scripts/restore.sh backups/travelmemo-YYYYMMDD-HHMMSS.tar.gz
```

恢复脚本只接受空数据卷，避免覆盖已有记录。恢复后核对简记数量、照片和管理员登录。

## 开发协作

`main` 由主控负责集成、部署和验收；`feat/backend` 由 6.1-sol 负责 `server/`，`feat/frontend` 通过 pi CLI 的 deepseek-flash 负责 `web/`。各分支使用独立工作树，按接口约定分别提交，再由主控合并；导航与主题改版由 pi CLI 在 `feat/travelmap-navigation` 完成。前端展示页参考 TravelMap，管理页结合其配色与 Apple Design 的反馈、材质、排版和减少动态效果支持。
