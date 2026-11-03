"""Download the open reference data for the Pyay Road corridor into data/sources/ (git-ignored cache).

    python3 tools/fetch_sources.py            # everything
    python3 tools/fetch_sources.py canopy osm # only some

Needs: duckdb (Overture), rasterio + numpy + pillow (canopy). Mapillary token in mapillary_token.txt.

Sources and licences (credit all of them in the game's credits screen):
  overture  Overture Maps buildings, release 2026-10-21.0 (OSM + Microsoft ML footprints) - ODbL
  osm       OpenStreetMap via Overpass: land use, parks, water, campuses, walls, roundabouts, POIs - ODbL
  canopy    Meta / WRI high-resolution canopy height map (1 m, 2024) - CC BY 4.0
  mapillary Mapillary detected map features (billboards, poles, street lights, signs) - CC BY-SA 4.0
"""
import json, math, os, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'sources')
BBOX = dict(w=96.12847, s=16.78063, e=96.14592, n=16.85566)  # whole road + 250 m
UA = 'yinn-myan-game/0.1 (hobby game; open data fetch)'
OVERTURE = 's3://overturemaps-us-west-2/release/2026-10-21.0/theme=buildings/type=building/*'


def overture():
    import duckdb
    con = duckdb.connect()
    con.sql("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2';")
    b = BBOX
    rows = con.sql(f"""SELECT id, height, num_floors, class, names.primary, sources[1].dataset, ST_AsGeoJSON(geometry)
        FROM read_parquet('{OVERTURE}', hive_partitioning=1)
        WHERE bbox.xmin > {b['w']} AND bbox.xmax < {b['e']} AND bbox.ymin > {b['s']} AND bbox.ymax < {b['n']}""").fetchall()
    data = [dict(id=r[0], height=r[1], floors=r[2], cls=r[3], name=r[4], src=r[5], g=json.loads(r[6])) for r in rows]
    json.dump(data, open(os.path.join(OUT, 'overture_buildings.json'), 'w'))
    print('overture:', len(data), 'buildings')


def osm():
    b = BBOX; bb = f"({b['s']},{b['w']},{b['n']},{b['e']})"
    q = f"""[out:json][timeout:120];(
      way["landuse"]{bb}; relation["landuse"]{bb};
      way["leisure"]{bb}; relation["leisure"]{bb};
      way["natural"]{bb}; relation["natural"]{bb};
      way["amenity"]{bb}; relation["amenity"]{bb};
      way["barrier"]{bb};
      way["junction"="roundabout"]{bb};
      way["building"]["name"]{bb}; relation["building"]["name"]{bb};
      node["name"]{bb};
      node["natural"="tree"]{bb};
    );out geom;"""
    req = urllib.request.Request('https://overpass-api.de/api/interpreter', data=urllib.parse.urlencode({'data': q}).encode(), headers={'User-Agent': UA})
    d = json.load(urllib.request.urlopen(req, timeout=300))
    json.dump(d, open(os.path.join(OUT, 'osm_context.json'), 'w'))
    print('osm:', len(d['elements']), 'elements')


def canopy():
    import numpy as np, rasterio
    from rasterio.windows import from_bounds
    from rasterio.warp import transform_bounds
    from PIL import Image
    def quadkey(lat, lon, z):
        x = (lon + 180) / 360; s = math.sin(math.radians(lat)); y = 0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)
        n = 2 ** z; tx, ty = int(x * n), int(y * n); q = ''
        for i in range(z, 0, -1):
            m = 1 << (i - 1); q += str((1 if tx & m else 0) + (2 if ty & m else 0))
        return q
    b = BBOX
    qks = {quadkey(la, lo, 9) for la in (b['s'], b['n']) for lo in (b['w'], b['e'])}
    assert len(qks) == 1, f'corridor spans several canopy tiles: {qks}'
    qk = qks.pop()
    url = f'/vsicurl/https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm/{qk}.tif'
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif'):
        with rasterio.open(url) as ds:
            bounds = transform_bounds('EPSG:4326', ds.crs, b['w'], b['s'], b['e'], b['n'])
            win = from_bounds(*bounds, ds.transform).round_offsets().round_lengths()
            a = ds.read(1, window=win)
            t = ds.window_transform(win)
    Image.fromarray(a).save(os.path.join(OUT, 'canopy_height_m.png'))  # uint8 metres, EPSG:3857
    json.dump(dict(tile=qk, crs='EPSG:3857', transform=list(t)[:6], shape=a.shape), open(os.path.join(OUT, 'canopy_height_m.json'), 'w'))
    print('canopy:', a.shape, 'px, tile', qk)


def mapillary():
    tok = os.environ.get('MAPILLARY_TOKEN') or open(os.path.join(ROOT, 'mapillary_token.txt')).read().strip()
    b = BBOX; feats = {}
    n = 6; dlat = (b['n'] - b['s']) / n
    for i in range(n):  # the API wants small boxes
        box = f"{b['w']},{b['s'] + i * dlat},{b['e']},{b['s'] + (i + 1) * dlat}"
        u = 'https://graph.mapillary.com/map_features?' + urllib.parse.urlencode({'access_token': tok, 'bbox': box, 'fields': 'id,object_value,geometry,first_seen_at,last_seen_at', 'limit': 2000})
        for k in range(4):
            try:
                r = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': UA}), timeout=90)); break
            except Exception as e:
                print('retry', e); time.sleep(3 + 3 * k)
        for f in r.get('data', []): feats[f['id']] = f
    json.dump(list(feats.values()), open(os.path.join(OUT, 'mapillary_features.json'), 'w'))
    print('mapillary:', len(feats), 'features')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    todo = sys.argv[1:] or ['overture', 'osm', 'canopy', 'mapillary']
    for name in todo:
        globals()[name]()
