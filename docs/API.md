# 实现边界与接口约定

后端 Node.js 24 + Express + node:sqlite + sharp，目录 server/。前端 React + TypeScript + Vite + MapLibre，目录 web/。各有 package.json。同源部署，开发代理 /api 和 /media 至 3001。主控负责根目录部署、地图数据、集成验收。所有 id 为字符串，日期 YYYY-MM-DD，经纬度 WGS84，provinceCode/cityCode 为六位行政区代码字符串。

Trip: {id,title,description,cityRoute:[{name,lng,lat}]}。
Place: {id,name,province,provinceCode,city,cityCode,lng,lat}。
Photo: {id,url,thumbnailUrl,width,height,alt}。
Entry: {id,title,date,placeId,tripId:string|null,body,photos:Photo[]}。

GET /api/health → {ok:true}
GET /api/catalog → {trips:Trip[],places:Place[],entries:Omit<Entry,'body'>[]}，无正文。
GET /api/entries/:id → Entry。
GET /api/session → {authenticated:boolean,csrfToken?:string}。
POST /api/login {username,password} → {authenticated:true,csrfToken}，HttpOnly session cookie。
POST /api/logout → {ok:true}。
POST /api/trips、/api/places、/api/entries → 创建后对象；PUT /api/{collection}/:id → 更新后对象；DELETE → {ok:true}。
POST /api/photos multipart 字段 file → Photo（单张，前端多次调用）。
写请求除 login 要求 X-CSRF-Token。POST/PUT 不传 id。Entry photos 传完整 Photo[]，alt 可编辑。删除被引用地点/分组返回409。错误 {error:string} 加正确 HTTP 状态。单一管理员由 ADMIN_USERNAME/ADMIN_PASSWORD 配置。数据库初始为空，不注入假旅行。覆盖空状态、加载与失败。

主控提供 web/public/geo/provinces.json 与 web/public/geo/cities/{provinceCode}.json。GeoJSON properties 有 adcode、name、center。按省懒加载城市，用真实行政区轮廓。全国用本地矢量底图，具体街道底图由主控后续整合配置。Map 需独立组件，省市两级足迹填色、地图时间线联动、标点聚合、分组过滤和可选城市连线。管理页按 TravelMap 配色与 apple-design 技能实现。

backend 分支只改 server/；frontend 分支只改 web/，不覆盖主控 geo 数据。验证后分阶段提交并报告 SHA、验证及问题。主控在 main 集成，禁止提交密钥、依赖、数据库和上传图片。
