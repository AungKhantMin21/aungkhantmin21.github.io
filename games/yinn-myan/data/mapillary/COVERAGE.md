# Mapillary coverage: Hledan → Hanthawaddy (s 3230–4850)

Fetched 2026-11-03 with `tools/mapillary_coverage.py 3230 4850` → `coverage.json`
(image id, s, lateral d (+ = west / southbound side), heading, date, sequence). The bbox
query was checked against full sequence listings and no images are missing.

**Summary:** 142 images in 12 sequences, all **2013–2018** (nothing in the last 8 years).
Mostly low-res dashboard phone shots with a lot of sky. Between s 3230 and 3774 almost
everything was shot **on the Hledan flyover deck** (2015-07 and 2017-03), so the flyover is
covered but the ground-level shopfronts underneath are not. The 20 panoramas (2018) are on
side streets (Thiri Mingala Rd, Hanthawaddy), not on Pyay Road.

| Block (s, m) | Landmarks | Pyay Rd photos | What they show | Owner photos needed? |
|---|---|---|---|---|
| 3230–3330 | Hledan junction, Insein Rd, University Ave, signals | 11 (+9 side street) | Flyover deck 2017, junction approach 2015 | **Yes**: junction at ground level, all four corners, Hledan Centre |
| 3330–3430 | Marla Myaing Yeiktha | 8 | Flyover deck only | **Yes**: both frontages under the flyover |
| 3430–3530 | Thiri Mingala Rd | 7 | Flyover deck | **Yes**: frontages and the Thiri Mingala junction |
| 3530–3630 | Pyay Yeik Thar Rd | 6 | Flyover deck | **Yes** |
| 3630–3730 | TTC Yeik Thar St, flyover ramps down | 7 | Flyover deck/ramp | **Yes**: the ramp ends and the frontages |
| 3730–3830 | Pyay Rd junction | 2 | Flyover end | **Yes** |
| 3830–3930 | Nar Nat Taw Rd, 473/475 Home | 4 | Ground level, 2015/2018 | **Yes**: too sparse, out of date |
| 3930–4030 | 471 Home | 4 | Ground level | **Yes**: too sparse |
| 4030–4130 | signal ~4105 | 1 | — | **Yes: no coverage** |
| 4130–4230 | | 2 | — | **Yes: no coverage** |
| 4230–4330 | Sike Pyoe Yayy bus stops, signal ~4303 | 1 | — | **Yes: no coverage** |
| 4330–4430 | | 2 | — | **Yes: no coverage** |
| 4430–4530 | | 1 | — | **Yes: no coverage** |
| 4530–4630 | | 1 | — | **Yes: no coverage** |
| 4630–4730 | | 2 | — | **Yes: no coverage** |
| 4730–4830 | Hanthawaddy / U Wisara junction | 4 (+20 side street) | Junction approach 2018 | **Yes**: corners at ground level |
| 4830–4850 | | 3 | 2016–17 | Partly |

"No coverage" = one northbound-lane phone photo per 100 m (one 2015-07-10 drive), mostly
trees and sky. Nothing on that stretch shows the southbound (west) frontage.

## What this means

Mapillary is good enough for the **flyover** (deck shape, parapets, lamp posts, chevrons,
the red/white kerb) and for skyline massing near Hledan. It cannot give us building-by-building
frontages or current signboards anywhere on the stretch, and the photos it has are 8+ years old.
To make the street match reality, nearly the whole 1.6 km needs new photos.

## How to photograph it (owner)

1. Walk or ride each side once; take one photo **every 10–15 m** facing straight at the
   frontage, plus one looking along the road every ~50 m. Landscape orientation, daytime, no zoom.
2. Keep **location on** in the camera (GPS in the EXIF). That is how I place each photo on the road.
3. At each junction (Hledan, Thiri Mingala, Nar Nat Taw, ~4105, ~4303, Hanthawaddy) take a
   slow 360° turn from each corner.
4. Close-ups of every signboard you want readable in the game.
5. Optional but best: upload them to Mapillary with the Mapillary app (it records the track and
   puts them back in the public dataset). Or drop them into `data/photos/` (git-ignored). I'll
   read the GPS from the files.
