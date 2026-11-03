"""Open data -> data/scenery.json: the real surroundings of Pyay Road (whole route).

    python3 tools/fetch_sources.py     # once, fills data/sources/ (git-ignored)
    python3 tools/scenery.py           # writes data/scenery.json

Nothing here is invented. Each item says where it came from:
  buildings  Overture Maps footprints (OSM + Microsoft ML). Height from OSM building:levels / height,
             data/landmarks.json overrides, else an estimate from footprint size (flag est=1).
  trees      one per crown found in the Meta/WRI 1 m canopy height map: real position, height, crown radius.
  areas      OSM water (Inya Lake), parks/gardens/pitches/grass, campus and temple compounds.
  walls      compound boundaries (OSM campuses, hospitals, schools, temples) where they face the road.
  billboards Mapillary-detected advertisements set back from the kerb.
All coordinates are local metres (x east, z south) like road.json.
"""
import json, math, os, re, sys
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data', 'sources')
LAT0, LON0 = 16.8534, 96.1407
KX = math.cos(math.radians(LAT0)) * 111320; KZ = 110574
CORRIDOR = 150      # m from the road centre: buildings and areas kept
TREE_CORRIDOR = 55  # m: trees kept (they're the heaviest thing to draw)
LANDMARK_CORRIDOR = 450  # m: named landmarks and parks you can see from the road


def xz(lat, lon): return ((lon - LON0) * KX, (LAT0 - lat) * KZ)


# ---------- road frame (same centerline and cross-section data as the game) ----------
road = json.load(open(os.path.join(ROOT, 'data', 'road.json')))
CLp = np.array(road['cl'], float)
seg = np.diff(CLp, axis=0); segL = np.hypot(seg[:, 0], seg[:, 1])
cum = np.concatenate([[0], np.cumsum(segL)]); cum *= road['len'] / cum[-1]
MED = np.array(road['med'], float); LAN = np.array(road['lanes'], float)
kM = road['len'] / ((len(MED) - 1) * 5)


def project(P):
    """nearest point on the centerline for many points: returns s, d (d > 0 = right of southbound)"""
    P = np.asarray(P, float).reshape(-1, 2); S = np.empty(len(P)); D = np.empty(len(P))
    A = CLp[:-1]; V = seg; L2 = segL ** 2
    for i in range(0, len(P), 2000):
        p = P[i:i + 2000, None, :]
        t = np.clip(((p - A) * V).sum(-1) / L2, 0, 1)
        q = A + t[..., None] * V; dist2 = ((p - q) ** 2).sum(-1)
        j = dist2.argmin(1); tj = t[np.arange(len(j)), j]
        S[i:i + 2000] = cum[j] + tj * (cum[j + 1] - cum[j])
        n = np.stack([-V[j, 1], V[j, 0]], 1) / segL[j, None]   # right normal of southbound travel
        D[i:i + 2000] = ((P[i:i + 2000] - q[np.arange(len(j)), j]) * n).sum(1)
    return S, D


def med_at(s): return MED[np.clip(np.round(np.asarray(s) / 5 / kM).astype(int), 0, len(MED) - 1)]
def curb_at(s):
    i = np.clip(np.round(np.asarray(s) / 5 / kM).astype(int), 0, len(MED) - 1)
    return MED[i] + LAN[i] * 3.5 + 0.5


def area(pts):
    p = np.asarray(pts); return abs(np.dot(p[:, 0], np.roll(p[:, 1], 1)) - np.dot(p[:, 1], np.roll(p[:, 0], 1))) / 2


def inside(pt, poly):
    x, y = pt; c = False
    for i in range(len(poly)):
        a, b = poly[i], poly[i - 1]
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]: c = not c
    return c


R1 = lambda v: round(float(v), 1)

# ---------- landmarks / overrides ----------
LM = json.load(open(os.path.join(ROOT, 'data', 'landmarks.json')))
osm = json.load(open(os.path.join(SRC, 'osm_context.json')))['elements']
nodes_named = [e for e in osm if e['type'] == 'node' and e.get('tags', {}).get('name')]
def node_name(e): t = e['tags']; return ' / '.join(v for k, v in t.items() if k.startswith('name'))

# ---------- buildings ----------
SHOPLESS = {'school', 'hospital', 'university', 'college', 'religious', 'temple', 'monastery', 'church', 'mosque', 'government', 'civic', 'public', 'parking', 'garage', 'industrial', 'warehouse', 'hotel'}
buildings = []
ov = json.load(open(os.path.join(SRC, 'overture_buildings.json')))
for b in ov:
    g = b['g']; ring = g['coordinates'][0] if g['type'] == 'Polygon' else g['coordinates'][0][0]
    pts = [xz(la, lo) for lo, la in ring]
    if len(pts) > 3 and math.dist(pts[0], pts[-1]) < 0.3: pts = pts[:-1]
    if len(pts) < 3: continue
    s, d = project(pts)
    if s.max() < -30 or s.min() > road['len'] + 30: continue
    gap = np.abs(d) - curb_at(s)
    A = area(pts); name = b.get('name') or ''
    landmark = any('match' in o and name and re.search(o['match'], name) for o in LM['buildings'])
    if gap.min() > (LANDMARK_CORRIDOR if landmark else CORRIDOR): continue   # too far
    if gap.min() < 1.0:  # some corners traced onto the carriageway: cut them back; drop the building only if most of it is on the road
        keepv = [p_ for p_, g_ in zip(pts, gap) if g_ >= 1.0]
        if len(keepv) < 3 or area(keepv) < 0.4 * A: continue
        pts = keepv; s, d = project(pts); gap = np.abs(d) - curb_at(s); A = area(pts)
    floors, height, est, label, src = b.get('floors'), b.get('height'), 0, None, b['src']
    for o in LM['buildings']:
        hit = ('match' in o and name and re.search(o['match'], name)) or \
              ('poi' in o and any(re.search(o['poi'], node_name(e)) and inside(xz(e['lat'], e['lon']), pts) for e in nodes_named))
        if hit:
            floors = o.get('floors', floors); height = o.get('height', height); label = o.get('label', name) or None; break
    if height: h = float(height)
    elif floors: h = 3.6 + max(0, floors - 1) * 3.1
    else:  # no data: Yangon low-rise by footprint size
        est = 1; floors = 1 if A < 50 else 2 if A < 160 else 3 if A < 600 else 4
        h = 3.6 + (floors - 1) * 3.1
    cls = (b.get('cls') or '').lower()
    shop = int(gap.min() < 10 and h < 22 and A < 1800 and cls not in SHOPLESS)
    o = dict(p=[[R1(x), R1(z)] for x, z in pts], h=R1(h), f=int(floors or 0), shop=shop)
    if est: o['est'] = 1
    if label or name: o['n'] = label or name
    if 'Microsoft' in src: o['ms'] = 1
    buildings.append(o)
print('buildings', len(buildings), '| estimated heights', sum(1 for b in buildings if b.get('est')), '| named', sum(1 for b in buildings if b.get('n')))

# ---------- trees from the canopy height map ----------
meta = json.load(open(os.path.join(SRC, 'canopy_height_m.json')))
chm = np.asarray(Image.open(os.path.join(SRC, 'canopy_height_m.png'))).astype(np.float32)
a, b_, c, d_, e, f = meta['transform']   # affine, EPSG:3857
px = abs(a) * math.cos(math.radians(LAT0))  # ground metres per pixel
sm = ndimage.gaussian_filter(chm, 0.8)
# Fill the mapped canopy with crowns: every pixel >= 3 m is a candidate; take the tallest first and
# accept it unless an accepted crown already covers it (spacing grows with tree height). Crowns whose
# centre is over the carriageway (big trees overhang Pyay Road) get their trunk moved to the pavement.
rows, cols = np.nonzero(sm >= 4)
X = c + (cols + 0.5) * a; Y = f + (rows + 0.5) * e
lon = np.degrees(X / 6378137.0); lat = np.degrees(2 * np.arctan(np.exp(Y / 6378137.0)) - math.pi / 2)
P = np.stack([(lon - LON0) * KX, (LAT0 - lat) * KZ], 1)
s, dd = project(P)
cb = curb_at(s); md = med_at(s)
inband = (s > -40) & (s < road['len'] + 40) & (np.abs(dd) < TREE_CORRIDOR)
H = sm[rows, cols]
order = [i for i in np.argsort(-H) if inband[i]]
cell = 6.0; grid = {}; trees = []
for i in order:
    h = float(H[i]); rad = float(np.clip(0.32 * h + 1.6, 2.2, 8.5))
    x, z = float(P[i, 0]), float(P[i, 1]); gx, gz = int(x // cell), int(z // cell)
    clash = False
    for ax in range(gx - 3, gx + 4):
        for az in range(gz - 3, gz + 4):
            for (tx, tz, tr) in grid.get((ax, az), ()):
                if (tx - x) ** 2 + (tz - z) ** 2 < (0.85 * (tr + rad)) ** 2: clash = True; break  # crowns just touch
            if clash: break
        if clash: break
    if clash: continue
    grid.setdefault((gx, gz), []).append((x, z, rad))
    gap = abs(dd[i]) - cb[i]; tx, tz = x, z
    in_median = md[i] > 1.6 and abs(dd[i]) < md[i] - 0.8
    if gap < 0.3 and not in_median:
        if gap < -8: continue  # mid-road blob: not a trunk position
        push = (0.3 + 1.2) - gap  # trunk onto the pavement, crown stays where the map has it
        sgn = 1 if dd[i] > 0 else -1; j = int(np.clip(np.searchsorted(cum, s[i]) - 1, 0, len(segL) - 1))
        n = np.array([-seg[j, 1], seg[j, 0]]) / segL[j]; tx, tz = x + n[0] * sgn * push, z + n[1] * sgn * push
    elif abs(dd[i]) < md[i] - 0.3 and not in_median: continue  # thin painted median
    trees.append([R1(tx), R1(tz), R1(h), R1(rad), R1(x - tx), R1(z - tz)])
print('trees', len(trees), '| median height %.1f m' % np.median([t_[2] for t_ in trees]), '| moved off the carriageway', sum(1 for t_ in trees if t_[4] or t_[5]))

# ---------- areas (water, green, compounds) from OSM ----------
def rings_of(el):
    """outer rings as lists of (x,z); relations: join member ways end to end"""
    if el['type'] == 'way':
        g = el.get('geometry') or []
        if len(g) > 3 and (g[0]['lat'], g[0]['lon']) == (g[-1]['lat'], g[-1]['lon']): return [[xz(p['lat'], p['lon']) for p in g[:-1]]]
        return []
    segs = [[(p['lat'], p['lon']) for p in m['geometry']] for m in el.get('members', []) if m.get('role') == 'outer' and m.get('geometry')]
    out = []
    while segs:
        ring = segs.pop(0)
        while ring[0] != ring[-1]:
            for k, sg in enumerate(segs):
                if sg[0] == ring[-1]: ring += sg[1:]; segs.pop(k); break
                if sg[-1] == ring[-1]: ring += sg[::-1][1:]; segs.pop(k); break
            else: break
        if ring[0] == ring[-1] and len(ring) > 3: out.append([xz(la, lo) for la, lo in ring[:-1]])
    return out

def kind_of(t):
    if t.get('natural') == 'water' or t.get('water') or t.get('landuse') in ('reservoir', 'basin'): return 'water'
    if t.get('leisure') in ('park', 'garden', 'pitch', 'golf_course', 'playground', 'recreation_ground') or \
       t.get('landuse') in ('grass', 'recreation_ground', 'flowerbed', 'forest', 'meadow', 'village_green', 'cemetery') or \
       t.get('natural') in ('wood', 'scrub', 'grassland'): return 'green'
    if t.get('amenity') in ('university', 'college', 'school', 'hospital', 'place_of_worship', 'kindergarten') or t.get('landuse') in ('religious', 'military', 'education'): return 'compound'
    return None

areas, walls = [], []
for el in osm:
    t = el.get('tags', {}); k = kind_of(t)
    if not k or el['type'] == 'node': continue
    for ring in rings_of(el):
        if len(ring) < 3: continue
        s, d = project(ring); gap = np.abs(d) - curb_at(s)
        nm = t.get('name:en') or t.get('name') or ''
        reach = 400 if k == 'water' else LANDMARK_CORRIDOR if (nm and k == 'green') else CORRIDOR
        if gap.min() > reach or s.max() < -50 or s.min() > road['len'] + 50: continue
        A = area(ring)
        if k != 'water' and A > (1.5e6 if nm else 400000): continue  # whole-district polygons
        if gap.min() < 1.0 and k != 'water':  # polygon reaches into the road (traced to the road centre): keep only its part off the road
            ring = [p for p, gg in zip(ring, gap) if gg >= 1.0]
            if len(ring) < 3: continue
        areas.append(dict(k=k, n=nm, p=[[R1(x), R1(z)] for x, z in ring]))
        if k == 'compound':  # boundary wall where the compound faces Pyay Road
            sR, dR = project(ring); gR = np.abs(dR) - curb_at(sR)
            run = []
            for i in range(len(ring) + 1):
                j = i % len(ring)
                ok = 1.0 <= gR[j] <= 40
                if ok: run.append([R1(ring[j][0]), R1(ring[j][1])])
                if (not ok or i == len(ring)) and len(run) >= 2: walls.append(dict(n=nm, p=run)); run = []
                elif not ok: run = []
print('areas', len(areas), {k: sum(1 for a_ in areas if a_['k'] == k) for k in ('water', 'green', 'compound')}, '| walls', len(walls))

# ---------- billboards (Mapillary detections) ----------
mf = json.load(open(os.path.join(SRC, 'mapillary_features.json')))
ads = [f_ for f_ in mf if f_['object_value'] in ('object--sign--advertisement', 'object--billboard')]
billboards = []
if ads:
    P = np.array([xz(f_['geometry']['coordinates'][1], f_['geometry']['coordinates'][0]) for f_ in ads])
    s, d = project(P); cb = curb_at(s)
    for i in np.argsort(s):
        gap = abs(d[i]) - cb[i]
        if not (-8 <= gap <= 35): continue  # detections are triangulated from phone photos: a few metres off is normal
        if any(abs(bb[2] - s[i]) < 30 and (bb[3] > 0) == (d[i] > 0) for bb in billboards): continue
        dd_ = d[i] if gap >= 4 else np.sign(d[i]) * (cb[i] + 4.5)  # stands behind the pavement, never on it
        j = int(np.clip(np.searchsorted(cum, s[i]) - 1, 0, len(segL) - 1)); n = np.array([-seg[j, 1], seg[j, 0]]) / segL[j]
        q = CLp[j] + (seg[j] / segL[j]) * (s[i] - cum[j]) + n * dd_
        billboards.append([R1(q[0]), R1(q[1]), R1(s[i]), R1(dd_)])
print('billboards', len(billboards), 'from', len(ads), 'advert detections')

# ---------- POI labels (landmarks without a footprint) ----------
pois = []
for o in LM.get('pois', []):
    for e_ in nodes_named:
        if re.search(o['match'], node_name(e_)):
            x, z = xz(e_['lat'], e_['lon']); pois.append(dict(n=o['label'], x=R1(x), z=R1(z))); break

out = dict(
    about='Generated by tools/scenery.py from open data. Credits: Overture Maps Foundation & OpenStreetMap contributors (ODbL); Microsoft ML building footprints (ODbL); '
          'Meta & World Resources Institute high-resolution canopy height maps (CC BY 4.0); Mapillary (CC BY-SA 4.0).',
    buildings=buildings, trees=trees, areas=areas, walls=walls, billboards=billboards, pois=pois)
path = os.path.join(ROOT, 'data', 'scenery.json')
json.dump(out, open(path, 'w'), ensure_ascii=False, separators=(',', ':'))
print('wrote', path, os.path.getsize(path) // 1024, 'KB')
