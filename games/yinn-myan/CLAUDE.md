# Yinn Myan (ယာဉ်မြန်) — project context for Claude Code

Read this before changing anything. It records what the owner wants, what has been decided, and where the code stands.

## Owner and goal

- Owner: Aung Khant Min (Yangon). Hobby project published on his GitHub Pages site `aungkhantmin21.github.io`; this game lives in `games/yinn-myan/`.
- **Yinn Myan (ယာဉ်မြန်, "fast vehicle")** — formerly "Pyay Road" — is a street-racing game set on the real Pyay Road in Yangon, Myanmar. Its message: street racing is not as easy or fun as people think. Crashes cost real money and real damage, and racing is bad for the environment. But the player should feel they are driving real Yangon cars on the actual road.
- **Quality target: Real Racing 3.** The owner explicitly rejected the current look as "block pieces moving on a blocky road" and "a clone of OpenTaxi" (a Yangon taxi web game, game.drnyeinchan.com/opentaxi). It must be **our own game** with real-world fidelity. We may not fully reach RR3, but every decision should aim at it.
- **The environment must match the real street exactly**: buildings, signboards, junctions, the flyover, as they really are. Approximate or invented scenery is not acceptable for the first milestone.

## Decisions already made (don't re-ask)

| Topic | Decision |
|---|---|
| Orientation | Landscape only; show a "rotate your phone" overlay in portrait (English + Burmese) |
| Platforms | Phone (touch) and laptop (keyboard) |
| Camera | Chase camera behind the car (v1) |
| Steering | **Analog touch only**: a thumb pad; the further you slide, the harder you turn. Keyboard arrows/WASD ramp to full lock in ~0.3 s |
| Assists | "Stability + traction" (default) or "Off". **No auto-steering / lane-keeping ever**; the owner found it felt like autopilot and it drove into the median |
| Cars (first 5) | Toyota Mark II (JZX110 Tourer V, JDM special), Toyota Crown (S180 Royal Saloon), BYD Atto 3 (EV), Toyota Probox (as Yangon taxi), Daihatsu Hijet truck. More later. JDM cars are the "special" ones |
| Platform | Real project in this repo, served by GitHub Pages (not a single-file artifact long term) |
| **No build step** | The github.io repo stays plain HTML/CSS/JS: **no Vite, bundler, npm or package.json in the repo.** Native ES modules + an import map, Three.js from a CDN pinned to an exact version (like the official three.js examples). Offline tools (gltf-transform, KTX2/Basis encoders, Blender) are fine as long as only their **output** is committed |
| Size budget | Every committed file < 100 MB; the whole game < ~300 MB. Check with `python3 tools/check_sizes.py` |
| Assets | Use real assets: CC-licensed car models, Poly Haven CC0 HDRIs and PBR textures, Mapillary street imagery for reference. Never Google Street View (terms forbid it) |
| Name / folder | **Yinn Myan (ယာဉ်မြန်)**, folder `games/yinn-myan/` (renamed from Pyay Road, 2026-11-03). localStorage keys still `pyay-*` so saved choices survive |
| Hledan flyover | **Drivable both ways: on the deck and on the street underneath** (owner, 2026-11-03). Inner southbound lane leads up the ramp; the deck skips the Hledan signals |
| First milestone | **Hledan junction → Hanthawaddy junction (~1.5 km, road s ≈ 3230 → 4850 m)** at the highest quality possible, one car first, then extend. Note: the flyover's up-ramp starts at s 2751, so the deck route needs the stretch from ~s 2650 (asked the owner whether to extend the start) |

## Owner's working preferences

- Wants things to feel real, not gamey; pushes back on anything that looks generic or templated.
- Likes nostalgic/local detail (Burmese signage, Yangon taxis with red plates and roof TAXI sign, YBS bus stops, sagging overhead cables, rooftop water tanks).
- Plays on a phone; performance must stay smooth (he noticed small stutters at speed and worries about traffic later).
- Explain plainly; give him concrete steps when he has to do something (settings, accounts).

## What exists now (v7: v6 ported to ES modules, 2026-11-03)

`index.html` loads `js/main.js` as a native module. Three.js **0.186.1** comes from jsDelivr via the import map in `index.html` (`three` and `three/addons/`). Bump the version there only, in one place, and pick a release at least a couple of weeks old. Serve the folder over HTTP to run it locally (`python3 -m http.server` in `games/yinn-myan/`); `file://` won't load modules.

The port kept the physics, audio, input and road code line for line. `tests/sim.py` gives the same numbers as v6 (Mark II 0–100 7.4 s; 0.91/0.91/0.95 g at 40/80/120 km/h, slip ≤ 3.4°). The scene looks the same, except colours are now colour-managed (hex colours display as their sRGB value).

### Source layout

```
index.html                 page shell + import map
css/game.css               HUD, menus, touch controls
js/main.js                 game shell: state machine, HUD, menu, loop, boot, test hooks (window.__pyay / __yinn)
js/core/util.js            $, clamp, lerp, fmtKs, seeded RNG, isTouch
js/data/cars.js            car specs + engine-sound profiles
js/sim/road.js             road model from data/road.json (frameAt, project, gapAt, cross-section)
js/sim/vehicle.js          physics, collisions, damage; reports impacts via events (no UI/render code)
js/sim/deck.js             elevated decks as a second drivable layer (Hledan flyover)
js/input/controls.js       keyboard + analog thumb pad
js/audio/audio.js          audio graph; js/audio/engine-worklet.js imports js/audio/dsp.js (synth)
js/render/stage.js         renderer, scene, camera, sky, PMREM env, sun        (v6 look; to be rebuilt)
js/render/textures.js      procedural canvas textures                          (v6; to be replaced by PBR sets)
js/render/world.js         generated scenery + bakeStatic() 240 m cells         (v6; milestone 1 replaces s 3230–4850)
js/render/car-model.js     code-built placeholder cars                         (v6; to be replaced by glTF)
js/render/scenery.js       real surroundings from data/scenery.json (buildings, canopy trees, lake/parks/compounds, walls, billboards, labels)
data/scenery.json          generated by tools/scenery.py from open data (whole road); data/landmarks.json = hand-checked heights/names
data/sources/              git-ignored cache from tools/fetch_sources.py (Overture, OSM context, canopy PNG, Mapillary features)
data/road.json             processed road data;  data/route.json, data/osm/pyay_road_raw.json (OSM, ODbL)
data/mapillary/            coverage.json + COVERAGE.md (Mapillary reference survey)
tools/route.py, process.py, plot.py    OSM -> road.json (offline, Python)
tools/mapillary_coverage.py            Mapillary coverage along a stretch of s
tools/check_sizes.py                   asset budget check
tools/fetch_sources.py, scenery.py     open data -> data/scenery.json (see 'Scenery from open data')
tests/sim.py               headless physics/handling checks (Playwright; serves the folder itself)
tests/deck.py              flyover drives: inner lane takes the deck, middle lane stays under, side entry hits the ramp wall
legacy/v6.html             the old single-file build (r128), kept for comparison; legacy/src + build.py made it
```

Regenerate road data: `python3 tools/route.py data/osm/pyay_road_raw.json data/route.json && python3 tools/process.py data/osm/pyay_road_raw.json data/route.json data/road.json` (no page build step any more).

### Coordinates and road model

- Local metres: origin at the Parami junction (lat 16.8534, lon 96.1407); x = east, z = **south** (positive going toward downtown). `P(lat,lon) = ((lon-96.1407)*cos(16.8534°)*111320, (16.8534-lat)*110574)`.
- The player drives the **southbound** carriageway (Myanmar drives on the right). The road centerline is the southbound carriageway shifted left by `median + lanes*3.5/2`, so the driven side keeps its exact OSM shape. OSM node corners are relaxed with Laplacian smoothing (real kerbs are arcs).
- In game, the centerline is resampled to **exactly 1 m per index**, so `s` (metres along the road) == array index. `frameAt(s)` gives position, tangent `(tx,tz)` and right normal `(nx,nz)=(-tz,tx)`. Lateral `d` is positive to the right.
- Cross-section per metre: `MED` (median half-width, taper-limited to 1 m per 20 m), `LANES` (lanes each way, 2–4), `CURB` (= MED + LANES*3.5 + 0.5, smoothed), `walkAt` = curb + 4 m sidewalk. Raised median when MED > 0.45, otherwise painted double yellow.
- `gapAt(s, side)`: junction mouths (side ±1) and median openings (side 0, only at crossroads or signalled junctions).
- **Decks (`road.json` → `decks`, `js/sim/deck.js`)**: `process.py` chains one-way OSM bridge ways (layer ≥ 1) and stores each southbound chain as offsets from the main centerline every 5 m (`dc`), plus the northbound chain beside it (`nb`). Hledan flyover: southbound deck s 2751 → 3773 (1 lane, OSM ways 515812988, 274922221, 221165644), northbound s 2762 → 3955 (2 lanes). The flyover stands on the median (OSM median is ~12 m wide there), so both carriageways below stay clear.
  - A deck is a lateral strip `[left(s), right(s)]` at height `y(s)`: `MOUTH` 6 m level with the street at each end, then smoothstep ramps (`rampUp`/`rampDown`, 170 m) to `H` 6.8 m. **H and ramp lengths are placeholders until measured from photos.** At the mouths the strip is one lane + 0.2 m wide, starting at the median kerb, and widens to lane + 0.6 m shoulders 40 m in.
  - Where both directions are at full height (s ≈ 2938–3597) they're one slab with a double yellow line and no barrier, as in the 2015/2017 Mapillary photos. The ramps are separate, with parapets on both sides.
  - The car has `layer` (0 street / 1 deck), `y` and `grade`. `updateSurface()` switches layer only at the mouths (the car centre inside the strip). On the deck only its parapets collide. On the street, a ramp below `CLEARANCE_Y` 4.4 m is a solid wall (`ramp` impact). Gravity along the grade is in `physics()`. Red-light checks and the signal HUD are skipped on the deck.
  - `world.js` `buildDecks()` draws from the same functions (surface, slab underside, parapets, ramp walls, piers on the median, lane paint). The Myaynigone overpass is still the old flat scenery slab, not drivable.
- Total length 8.3 km (Parami → City Mall @ St. John). Landmarks along s: Kan Rd ~1946, Inya Rd ~2325, Insein Rd / Hledan ~3237–3273, Hanthawaddy / U Wisara ~4776–4829, Myaynigone ~5706–5888, Ahlone Rd ~7123, finish ~8280.

### Physics (`js/sim/vehicle.js`, `physics()`)

- Bicycle model with weight transfer, Pacejka-like tyre `mu*Fz*sin(1.45*atan(12*alpha))` (peak ~9°, keeps ~75% when sliding), combined slip (drive/brake force eats lateral grip), rear grip x1.08 (road-car understeer balance), 240 Hz substeps.
- Steering ratio narrows with speed: `dMax = min(0.6, atan(wb*0.95*mu*g/v²)*1.2 + 0.008)`, input curve `x*(0.45+0.55|x|)`. Measured: full lock ≈ 0.85–0.95 g at 40/80/120 km/h with assists on, slip < 4°.
- Engine: real torque curves, gear ratios, torque converter (auto), turbo lag (1JZ-GTE), JDM 180 km/h limiter (Mark II, Crown), EV constant-torque/constant-power + regen + 160 km/h limit. Measured 0–100: Mark II ~6.5–7.4 s, Crown ~8.0, Atto 3 ~7.8, Probox ~11.4, Hijet ~22.
- Damage: impact energy ∝ v²; repair bill scales with car value (placeholder values in Ks); 100% = written off. Fines for red lights; fuel/kWh and CO₂ tracked.

### Rendering

- Three.js 0.186.1 (ES modules), ACES tone mapping, sRGB output, colour management on, PMREM environment from a procedural sky shader, PCF soft shadows following the car (texel-snapped), fog hides the 500 m far plane.
- All static geometry is **baked into 240 m cells** at load (`bakeStatic()`) so frustum culling works; ~100–200 draw calls per frame.
- Adaptive quality governor lowers pixel ratio → shadow map → shadows → view distance if fps < 54.
- Cars are code-built extrusions (body with wheel arches, glass, pillars). **This is the main visual weakness** — replace with real models.
- Buildings: 301 real OSM footprints (extruded, procedural facade textures) + procedural shophouses filling gaps. **Not faithful to reality yet** — this is the owner's top complaint.

### Audio

`js/audio/dsp.js`: per-cylinder firing pulses at real crank angles (I6, V6, I4, I3) into an exhaust-pipe comb resonator + formant filters + saturation; turbo whistle/blow-off; EV motor/gear whine; road, wind, tyre noise. Allocation-free (no GC on the audio thread).

## Next: the RR3-quality rebuild (milestone 1, Hledan → Hanthawaddy)

Suggested plan; confirm with the owner before big moves.

1. ~~Project setup~~ **done (v7)**: native ES modules + import map, no build step (owner rejected Vite).
2. **Rendering pipeline**: glTF/GLB loading (meshopt/DRACO decoders from `three/addons/` + CDN), KTX2 textures (encoded offline, only the .ktx2 files committed), real HDRI sky (Poly Haven, CC0), PBR materials from Poly Haven / ambientCG (asphalt, concrete, plaster, rust, tiles), post-processing (SMAA/TAA, SSAO/GTAO, bloom, subtle motion blur, colour grading). Mobile quality tiers.
3. **Cars**: CC-licensed models (Sketchfab or similar) for the five cars; credit authors in an in-game credits screen. Start with the Mark II. Proper wheels, brake lights, interior visible through glass.
4. **Environment that matches reality**: use Mapillary images (API v4, needs the owner's client token `MLY|...`) along s 3230–4850 as reference. Look at the photos and model each building's massing, colour, balconies, shutters and Burmese signboards; the Hledan flyover and junction layouts; YBS shelters; trees where they really are. Where Mapillary has no coverage, list the exact blocks and ask the owner for phone photos.
5. **Handling polish** with analog thumb steering (owner chose analog touch only).
6. Later: Yangon traffic (instanced, LOD), the car market (buy with cash; JDM rarities), more of the road.

## Access and setup status

- **Pushing to the repo**: in the previous (claude.ai) session, GitHub pushes were refused until the Claude GitHub App is installed on `aungkhantmin21.github.io` (github.com/apps/claude/installations/select_target). In Claude Code on the owner's machine, normal git with his credentials works.
- **Network**: the claude.ai sandbox could not reach overpass-api.de, Poly Haven or Mapillary. On the owner's machine these should work directly. Overpass returns HTTP 406 to bare browser requests; use overpass-turbo.eu or send a descriptive User-Agent from scripts.
- **Mapillary token**: in git-ignored `mapillary_token.txt` (or env `MAPILLARY_TOKEN`); works from the owner's machine. Never commit it.
- **Mapillary coverage (fetched 2026-11-03)**: see `data/mapillary/COVERAGE.md`. Thin and old (2013–2018); s 3230–3774 is mostly shot from the flyover deck, s 4030–4730 has about 1 photo per 100 m. The owner's own photos are needed for almost every frontage. Put them in git-ignored `data/photos/` with GPS EXIF.

## Scenery from open data (2026-11-03, owner: "generate the map for now; recent changes don't matter, but it must match reality overall")

`python3 tools/fetch_sources.py` (needs duckdb + rasterio, e.g. in a venv) then `python3 tools/scenery.py` (numpy, scipy, pillow). The game uses `scenery.json` and no longer generates shophouses or random trees (the v6 path in world.js is only a fallback if the file is missing).
- **Buildings**: 1768 Overture footprints within 150 m of the kerb (450 m for landmarks). Corners traced onto the carriageway are clipped. Height: OSM levels/height, `data/landmarks.json`, else estimated from footprint size (`est:1`, 1584 of them). Facade textures and paint colours are still procedural; the data has none.
- **Trees**: the Meta/WRI canopy (≥ 4 m) is filled tallest-first with crowns that just touch, within 55 m of the road: about 4700 trees, median height 7 m. Crowns over the carriageway keep their position, with the trunk moved onto the pavement.
- **Areas**: OSM water (Inya Lake), parks/pitches/gardens (incl. People's Park, the Hanthawaddy roundabout island), and campus/hospital/temple compounds with 2.2 m walls where they face the road.
- **Billboards**: 35 from 252 Mapillary advertisement detections (one per 30 m per side), shown as plain panels (what they show today is unknown).
- **Key places checked** (owner's list): Hledan Center 9 fl, M Tower 27 fl / 111 m (override), Sein Gay Har 12, Vantage Tower 16, Novotel 12, Kan Thar Yar 8, Junction Square 4, Jasmine Palace 23, Yangon Region Hluttaw 4, Taw Win Centre 10, City Mall 4, TTC campus, University of Medicine 1 compound, People's Park, Inya Lake. KMD and 6½ Mile have only OSM points (labels).
- Credits line in the menu (`.credits`) is required by ODbL / CC BY. Keep it.
- Known gaps: the old v6 road model (lane counts/kerbs) isn't checked against photos; the Hanthawaddy roundabout is only a green island, not a real roundabout road; facade colours/signboards are unknown; the Meta canopy may underestimate big rain trees.

## Reference sources without owner photos (surveyed 2026-11-03)

The owner can't photograph the whole road. These sources were checked for the stretch's bbox (lon 96.13007–96.13538, lat 16.81227–16.83274):

| Source | What it gives here | Licence |
|---|---|---|
| Overture Maps buildings (release 2026-10-21.0, S3 + DuckDB) | 706 footprints (510 current OSM + 196 Microsoft ML), 139 with floor counts. Within 16 m of the kerb only 32% (west) / 6% (east) of frontage has a building; the rest is really trees, compounds and campuses | ODbL |
| Meta/WRI 1 m canopy height (`dataforgood-fb-data` S3, tile 132201222, read as a COG via rasterio) | Individual tree crowns and heights (up to 25 m), 32% canopy cover; Pyay Road clearly visible | CC BY 4.0 |
| Mapillary detected map features | 222 points: 112 poles, 27 advertisements/billboards, 25 utility poles, 22 street lights, 8 store signs | CC BY-SA |
| Wikimedia Commons geosearch | Geotagged photos on the stretch: Hledan Centre/junction (2021), Yangon University of Education Pyay Road, TTC, Hanthawaddy Roundabout | per file, mostly CC |
| OSM via Overpass (current) | 7 roundabout ways (Hanthawaddy), schools/TTC/university, religious sites, pitches, gardens; only 6 mapped trees, no walls | ODbL |
| KartaView | API returned nothing | — |

Facade and signboard detail can only come from the 2015–18 Mapillary and Commons photos, or from the owner describing/reviewing rendered views.

## Licensing notes

- OSM data: © OpenStreetMap contributors, ODbL — show attribution in the game's credits.
- Poly Haven / ambientCG: CC0. Sketchfab models: check each licence (CC-BY needs credit; avoid NC if the game might ever be commercial).
- Real brand/model names: fine for a hobby project; if it ever goes public/commercial, consider lookalike names and remove logos.
