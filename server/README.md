# TravelMemo server

Node.js 24 or newer. Run `npm ci`, then `npm start`. Run the HTTP integration suite with `npm test`.

Required environment: `ADMIN_USERNAME`, `ADMIN_PASSWORD` (at least 12 characters). Sessions expire after 24 hours. Configure a strong password before starting the service.

Optional environment:

| Variable | Default | Purpose |
| --- | --- | --- |
| PORT | 3001 | HTTP listener |
| DATA_DIR | server/data | SQLite database and media directory |
| STATIC_DIR | web/dist | Built frontend directory |
| COOKIE_SECURE | false | Set true for HTTPS deployment |
| TRUST_PROXY | false | Set 1 behind exactly one trusted reverse proxy; keep the app port private |
| MAP_TILE_URL | empty | WGS84/CGCS2000 WebMercator HTTPS XYZ tile URL |
| MAP_ATTRIBUTION | empty | Tile provider attribution |
| MAP_MAX_ZOOM | 18 | Maximum tile zoom |
| TDT_TOKEN | empty | Public browser token for Tianditu; restrict allowed domains at the provider |

`GET /api/map-config` returns `{tiles:string[],overlayTiles:string[],attribution:string,maxZoom:number}`. `MAP_TILE_URL` takes priority over Tianditu. With `TDT_TOKEN`, vector `vec_w` base tiles and `cia_w` label tiles are returned. With neither configured, both tile arrays are empty and the frontend can render local administrative boundaries.

The API follows `docs/API.md`. All mutation requests except login require an authenticated cookie and `X-CSRF-Token`; cross-origin login and mutation requests are rejected. Upload `file` as multipart form data to `/api/photos` (20 MB maximum, supported bitmap formats only). Image orientation is normalized; display images fit within 2048 pixels and thumbnails within 480 pixels. Original files and generated WebP images are persisted in DATA_DIR/media. Unlinked photos are retained to prevent accidental image loss.

For a consistent backup, stop the container/service and archive the entire DATA_DIR, including the SQLite WAL files if present and media directory. Restore that directory before starting the same or newer application version. Keep administrator environment values separately in secure deployment configuration. Never commit DATA_DIR.
