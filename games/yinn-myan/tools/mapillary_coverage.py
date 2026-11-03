"""Mapillary coverage report for a stretch of Pyay Road.

usage: python3 tools/mapillary_coverage.py S0 S1 [block_m] > data/mapillary/coverage.json
Token: env MAPILLARY_TOKEN or git-ignored mapillary_token.txt. Never commit it.
"""
import json, math, os, sys, time, urllib.request, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
LAT0, LON0 = 16.8534, 96.1407
KX = math.cos(math.radians(LAT0)) * 111320
KZ = 110574

def token():
    t = os.environ.get('MAPILLARY_TOKEN')
    if not t:
        t = open(os.path.join(ROOT, 'mapillary_token.txt')).read().strip()
    return t

def to_ll(x, z): return LAT0 - z / KZ, LON0 + x / KX
def to_xz(lat, lon): return (lon - LON0) * KX, (LAT0 - lat) * KZ

def centerline():
    d = json.load(open(os.path.join(ROOT, 'data/road.json')))
    cl = d['cl']; n = len(cl); L = d['len']
    # cumulative arclength (game resamples to 1 m; use the same scaling)
    acc = [0.0]
    for i in range(1, n):
        acc.append(acc[-1] + math.dist(cl[i - 1], cl[i]))
    k = L / acc[-1]
    return [(a * k, p) for a, p in zip(acc, cl)], d

def project(cl, x, z, s_hint=None):
    best = None
    for i in range(len(cl) - 1):
        (s0, a), (s1, b) = cl[i], cl[i + 1]
        dx, dz = b[0] - a[0], b[1] - a[1]
        l2 = dx * dx + dz * dz
        t = max(0, min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2))
        px, pz = a[0] + t * dx, a[1] + t * dz
        dist2 = (x - px) ** 2 + (z - pz) ** 2
        if best is None or dist2 < best[0]:
            l = math.sqrt(l2); nx, nz = -dz / l, dx / l   # right normal
            d = (x - px) * nx + (z - pz) * nz
            best = (dist2, s0 + t * (s1 - s0), d)
    return best[1], best[2]

def get(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'yinn-myan-game/0.1 coverage script'})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:
            print('retry', i, e, file=sys.stderr); time.sleep(2 + 3 * i)
    raise SystemExit('failed: ' + url.split('access_token')[0])

def main():
    s0, s1 = float(sys.argv[1]), float(sys.argv[2])
    tok = token()
    cl, road = centerline()
    seg = [p for s, p in cl if s0 - 60 <= s <= s1 + 60]
    xs = [p[0] for p in seg]; zs = [p[1] for p in seg]
    pad = 70
    # query in tiles (API limits bbox to ~0.01 deg^2 and 2000 results)
    imgs = {}
    zstep = 250
    z = min(zs) - pad
    while z < max(zs) + pad:
        sub = [p for p in seg if z - pad <= p[1] <= z + zstep + pad]
        if sub:
            x0 = min(p[0] for p in sub) - pad; x1 = max(p[0] for p in sub) + pad
            la1, lo0 = to_ll(x0, z); la0, lo1 = to_ll(x1, z + zstep)
            bbox = f'{lo0:.6f},{la0:.6f},{lo1:.6f},{la1:.6f}'
            url = ('https://graph.mapillary.com/images?' + urllib.parse.urlencode({
                'access_token': tok, 'bbox': bbox, 'limit': 2000,
                'fields': 'id,captured_at,compass_angle,computed_compass_angle,geometry,computed_geometry,is_pano,sequence,camera_type,creator'}))
            r = get(url)
            for im in r.get('data', []):
                imgs[im['id']] = im
            print(f'tile z={z:.0f}: {len(r.get("data", []))} imgs', file=sys.stderr)
        z += zstep
    out = []
    for im in imgs.values():
        g = (im.get('computed_geometry') or im['geometry'])['coordinates']
        x, zz = to_xz(g[1], g[0])
        s, d = project(cl, x, zz)
        if not (s0 - 30 <= s <= s1 + 30) or abs(d) > 45: continue
        out.append({'id': im['id'], 's': round(s, 1), 'd': round(d, 1),
                    'heading': im.get('computed_compass_angle', im.get('compass_angle')),
                    'pano': im.get('is_pano', False), 'cam': im.get('camera_type'),
                    'date': time.strftime('%Y-%m-%d', time.gmtime(im['captured_at'] / 1000)),
                    'seq': im.get('sequence'), 'by': (im.get('creator') or {}).get('username')})
    out.sort(key=lambda o: o['s'])
    json.dump({'s0': s0, 's1': s1, 'images': out}, sys.stdout, indent=0)

if __name__ == '__main__':
    main()
