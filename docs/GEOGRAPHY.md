# 地图数据

本地边界来自 [阿里云 DataV.GeoAtlas](https://datav.aliyun.com/portal/school/atlas/atlas_aigc) 的 areas_v3（原始来源为高德，官方注明 2021.5 数据，仅供学习交流）。本项目保留来源记录，个人开发使用；公开部署前应确认地图数据使用条件并按需要替换为获授权的数据。刷新命令：`python3 scripts/fetch-geography.py`。脚本下载失败会非零退出，不会静默替换为虚构轮廓。

数据统一为 WGS84：将来源的高德 GCJ-02 坐标通过迭代近似逆变换转换，包括轮廓和中心点。这是显示级近似，不用于测量或导航。底图必须采用 WGS84/CGCS2000 的 WebMercator XYZ 瓦片，不能直接叠加 GCJ-02 或 BD-09 瓦片。手工录入经纬度同样使用 WGS84。原始南海附加线存于 outlines.json。

- provinces.json：34 个省级区域，全国首屏仅加载此文件。
- cities/{provinceCode}.json：按省懒加载的地级行政区及省直管区域。
- 直辖市以自身作为城市单位；港澳台在当前来源缺乏可靠地级细分，首版保持省级整体，不把区县冒充地级城市。

运行时 `/api/map-config` 配置街道底图。`TDT_TOKEN` 使用天地图 vec_w 与 cia_w；也可指定 `MAP_TILE_URL`、`MAP_ATTRIBUTION`、`MAP_MAX_ZOOM` 对接有权使用的同坐标系服务。浏览器地图令牌本身公开，需在服务商后台限制域名与额度。不配置底图时，省市足迹、标点和城市连线仍可用；街道细节需配置底图后显示。当前开发环境的网络检查不能代替北京服务器的实际加载验收。
