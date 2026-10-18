#!/usr/bin/env python3
"""Refresh the locally served DataV administrative boundaries."""
import concurrent.futures
import json
import math
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1] / 'web/public/geo'
SOURCE = 'https://geo.datav.aliyun.com/areas_v3/bound/'


def offset(lng, lat):
    if not (72.004 <= lng <= 137.8347 and 0.8293 <= lat <= 55.8271):
        return 0, 0
    x, y = lng - 105, lat - 35
    dlat = -100 + 2*x + 3*y + .2*y*y + .1*x*y + .2*math.sqrt(abs(x))
    dlat += (20*math.sin(6*x*math.pi) + 20*math.sin(2*x*math.pi))*2/3
    dlat += (20*math.sin(y*math.pi) + 40*math.sin(y*math.pi/3))*2/3
    dlat += (160*math.sin(y*math.pi/12) + 320*math.sin(y*math.pi/30))*2/3
    dlng = 300 + x + 2*y + .1*x*x + .1*x*y + .1*math.sqrt(abs(x))
    dlng += (20*math.sin(6*x*math.pi) + 20*math.sin(2*x*math.pi))*2/3
    dlng += (20*math.sin(x*math.pi) + 40*math.sin(x*math.pi/3))*2/3
    dlng += (150*math.sin(x*math.pi/12) + 300*math.sin(x*math.pi/30))*2/3
    rad = lat / 180 * math.pi
    magic = 1 - .00669342162296594323 * math.sin(rad)**2
    dlat = dlat*180 / ((6378245*(1-.00669342162296594323))/(magic*math.sqrt(magic))*math.pi)
    dlng = dlng*180 / (6378245/math.sqrt(magic)*math.cos(rad)*math.pi)
    return dlng, dlat


def wgs(point):
    lng, lat = point[:2]
    x, y = lng, lat
    for _ in range(5):
        dx, dy = offset(x, y)
        x, y = lng-dx, lat-dy
    return [round(x, 6), round(y, 6)]


def coordinates(value):
    if value and isinstance(value[0], (float, int)):
        return wgs(value)
    return [coordinates(v) for v in value]


def download(code):
    request = urllib.request.Request(SOURCE + code + '_full.json', headers={'User-Agent': 'TravelMemo/1.0'})
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.load(response)


def normalize(feature):
    prop = feature['properties']
    feature['properties'] = {k: prop[k] for k in ('adcode', 'name', 'level') if k in prop}
    feature['properties']['adcode'] = str(prop['adcode'])
    for key in ('center', 'centroid'):
        if prop.get(key):
            feature['properties'][key] = wgs(prop[key])
    feature['geometry']['coordinates'] = coordinates(feature['geometry']['coordinates'])
    return feature


def save(name, features):
    path = ROOT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({'type': 'FeatureCollection', 'features': features}, ensure_ascii=False, separators=(',', ':')) + '\n')


def main():
    raw = download('100000')
    provinces = [f for f in raw['features'] if str(f['properties'].get('adcode', '')).isdigit()]
    outlines = [f for f in raw['features'] if not str(f['properties'].get('adcode', '')).isdigit()]
    normalized = [normalize(json.loads(json.dumps(f))) for f in provinces]
    save('provinces.json', normalized)
    save('outlines.json', [normalize(f) for f in outlines])
    single = {'110000', '120000', '310000', '500000', '710000', '810000', '820000'}
    def fetch_city(province):
        code = str(province['properties']['adcode'])
        if code in single:
            features = [normalize(province)]
            features[0]['properties']['level'] = 'city'
        else:
            features = [normalize(f) for f in download(code)['features']]
        save('cities/' + code + '.json', features)
        return code, len(features)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for code, count in pool.map(fetch_city, provinces):
            print(code, count)


if __name__ == '__main__':
    main()
